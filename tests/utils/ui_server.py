"""Serve the built React SPA and proxy /api to the backend.

The project ships nginx in production and Vite's dev-server proxy locally, but
UI tests must run without writing into the repository (Vite caches into
node_modules) and without Docker. This tiny server reproduces the production
contract: static files, SPA history fallback, and same-origin /api + /actuator
proxying.
"""

from __future__ import annotations

import threading
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROXY_PREFIXES = ("/api/", "/actuator/")


class _Handler(SimpleHTTPRequestHandler):
    backend: str = "http://127.0.0.1:8081"

    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib signature
        pass

    # -- routing -----------------------------------------------------------
    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if self.path.startswith(PROXY_PREFIXES):
            self._proxy("GET")
        else:
            self._serve_static()

    def do_POST(self) -> None:  # noqa: N802
        self._proxy("POST")

    def do_PUT(self) -> None:  # noqa: N802
        self._proxy("PUT")

    def do_PATCH(self) -> None:  # noqa: N802
        self._proxy("PATCH")

    def do_DELETE(self) -> None:  # noqa: N802
        self._proxy("DELETE")

    # -- static ------------------------------------------------------------
    def _serve_static(self) -> None:
        path = self.translate_path(self.path)
        if not Path(path).exists() and "." not in Path(self.path).name:
            # SPA history fallback: /tickets/12 must return index.html
            self.path = "/index.html"
        super().do_GET()

    # -- proxy -------------------------------------------------------------
    def _proxy(self, method: str) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() in {"authorization", "content-type", "accept"}
        }
        request = urllib.request.Request(
            url=self.backend.rstrip("/") + self.path,
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as upstream:
                payload = upstream.read()
                self._respond(upstream.status, upstream.headers.get("Content-Type"), payload)
        except urllib.error.HTTPError as exc:
            payload = exc.read()
            self._respond(exc.code, exc.headers.get("Content-Type"), payload)
        except urllib.error.URLError as exc:
            self._respond(502, "text/plain", f"upstream unreachable: {exc}".encode())

    def _respond(self, status: int, content_type: str | None, payload: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type or "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class StaticAppServer:
    """Threaded static server with API proxy, started on a free port."""

    def __init__(self, dist_dir: Path, backend: str, port: int = 0):
        self.dist_dir = Path(dist_dir)
        self.backend = backend
        self.port = port
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def url(self) -> str:
        assert self._server is not None, "server is not running"
        return f"http://127.0.0.1:{self._server.server_address[1]}"

    def start(self) -> "StaticAppServer":
        assert self.dist_dir.is_dir(), (
            f"frontend build not found at {self.dist_dir}; run 'npm run build' in frontend/"
        )
        handler = partial(_Handler, directory=str(self.dist_dir))
        self._server = ThreadingHTTPServer(("127.0.0.1", self.port), handler)
        self._server.daemon_threads = True
        _Handler.backend = self.backend
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        return self

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
