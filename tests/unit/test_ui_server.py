"""Unit tests for the static SPA server used by the UI tests.

The server is a test harness (production uses nginx), so it is verified here in
milliseconds instead of through a browser job in CI: static files, the history
fallback, API proxying and upstream failures.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

from utils.ui_server import StaticAppServer

pytestmark = pytest.mark.unit


class _RecordingBackend:
    """Minimal upstream that records what the proxy forwards."""

    def __init__(self) -> None:
        self.requests: list[dict] = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self.thread = threading.Thread(
            target=self.server.serve_forever,
            kwargs={"poll_interval": 0.05},
            daemon=True,
        )

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}"

    def _handler(self):
        backend = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # keep the test output clean
                pass

            def _respond(self, status: int, payload: dict) -> None:
                body = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def _record(self, method: str) -> None:
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else b""
                backend.requests.append(
                    {
                        "method": method,
                        "path": self.path,
                        "authorization": self.headers.get("Authorization"),
                        "body": body.decode() if body else None,
                    }
                )
                self._respond(200, {"method": method, "path": self.path})

            def do_GET(self):  # noqa: N802 - stdlib naming
                self._record("GET")

            def do_POST(self):  # noqa: N802
                self._record("POST")

        return Handler

    def start(self) -> "_RecordingBackend":
        self.thread.start()
        return self

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    (tmp_path / "index.html").write_text('<!doctype html><div id="root"></div>', encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('app')", encoding="utf-8")
    return tmp_path


@pytest.fixture
def backend() -> _RecordingBackend:
    server = _RecordingBackend().start()
    yield server
    server.stop()


@pytest.fixture
def spa(dist: Path, backend: _RecordingBackend) -> StaticAppServer:
    server = StaticAppServer(dist, backend.url, port=0).start()
    yield server
    server.stop()


def get(url: str) -> tuple[int, str, str]:
    import urllib.error
    import urllib.request

    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers.get("Content-Type", ""), exc.read().decode()


class TestStaticFiles:
    def test_serves_index(self, spa: StaticAppServer):
        status, content_type, body = get(spa.url + "/")

        assert status == 200
        assert "text/html" in content_type
        assert 'id="root"' in body

    def test_serves_assets(self, spa: StaticAppServer):
        status, content_type, body = get(spa.url + "/assets/app.js")

        assert status == 200
        assert "javascript" in content_type
        assert "console.log" in body

    def test_missing_asset_is_404_not_the_fallback(self, spa: StaticAppServer):
        status, _, _ = get(spa.url + "/assets/missing.js")

        assert status == 404

    @pytest.mark.parametrize("path", ["/tickets/1", "/knowledge", "/tickets/12?tab=audit"])
    def test_history_fallback_serves_index(self, spa: StaticAppServer, path):
        status, content_type, body = get(spa.url + path)

        assert status == 200
        assert "text/html" in content_type
        assert 'id="root"' in body


class TestProxy:
    def test_get_is_forwarded(self, spa: StaticAppServer, backend: _RecordingBackend):
        status, content_type, body = get(spa.url + "/api/v1/tickets?size=5")

        assert status == 200
        assert "application/json" in content_type
        assert json.loads(body)["path"] == "/api/v1/tickets?size=5"
        assert backend.requests[-1]["method"] == "GET"

    def test_actuator_is_forwarded(self, spa: StaticAppServer, backend: _RecordingBackend):
        get(spa.url + "/actuator/health")

        assert backend.requests[-1]["path"] == "/actuator/health"

    def test_post_forwards_body_and_authorization(self, spa: StaticAppServer, backend: _RecordingBackend):
        import urllib.request

        request = urllib.request.Request(
            spa.url + "/api/v1/tickets",
            data=json.dumps({"title": "x"}).encode(),
            headers={"Content-Type": "application/json", "Authorization": "Bearer token-123"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            assert response.status == 200

        forwarded = backend.requests[-1]
        assert forwarded["method"] == "POST"
        assert forwarded["authorization"] == "Bearer token-123"
        assert json.loads(forwarded["body"]) == {"title": "x"}

    def test_unreachable_backend_returns_502(self, dist: Path):
        server = StaticAppServer(dist, "http://127.0.0.1:1", port=0).start()
        try:
            status, _, body = get(server.url + "/api/v1/tickets")
        finally:
            server.stop()

        assert status == 502
        assert "unreachable" in body


class TestLifecycle:
    def test_url_requires_a_running_server(self, dist: Path, backend: _RecordingBackend):
        server = StaticAppServer(dist, backend.url, port=0)

        with pytest.raises(AssertionError):
            _ = server.url

    def test_start_fails_without_a_build(self, tmp_path: Path, backend: _RecordingBackend):
        missing = tmp_path / "does-not-exist"

        with pytest.raises(AssertionError, match="frontend build not found"):
            StaticAppServer(missing, backend.url, port=0).start()
