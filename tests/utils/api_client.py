"""HTTP client used by every API test.

Design goals:
- one place that knows the base URL, timeout and auth header;
- every call is logged with method, path, status and duration;
- failures keep the request and response payloads so a CI failure is
  diagnosable without re-running;
- no implicit retries: a flaky endpoint must show up as a flaky test.

Authentication isolation
------------------------
A client may share its ``requests.Session`` (connection pool, transport
configuration) with other clients, but the token is *per client* and is applied
to every request individually. The session never carries an ``Authorization``
header, so ``with_token()`` and ``without_auth()`` cannot leak credentials into
each other or into a concurrently running test.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Mapping

import requests

from config.settings import Settings, settings as default_settings
from utils.logger import get_logger, truncate

logger = get_logger("api")

DEFAULT_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "servicemind-automation/1.0",
}


@dataclass
class ApiResponse:
    """Thin wrapper around ``requests.Response`` with assertion helpers."""

    response: requests.Response
    method: str
    url: str
    elapsed_ms: float
    request_headers: Mapping[str, str] = field(default_factory=dict)

    @property
    def status(self) -> int:
        return self.response.status_code

    @property
    def headers(self) -> Mapping[str, str]:
        return self.response.headers

    @property
    def text(self) -> str:
        return self.response.text

    def json(self) -> Any:
        try:
            return self.response.json()
        except ValueError:
            return None

    @property
    def problem_title(self) -> str | None:
        body = self.json()
        return body.get("title") if isinstance(body, dict) else None

    @property
    def problem_detail(self) -> str | None:
        body = self.json()
        return body.get("detail") if isinstance(body, dict) else None

    def describe(self) -> str:
        # Auth headers are redacted: failure dumps end up in CI logs.
        headers = {
            key: ("Bearer ***" if key.lower() == "authorization" else value)
            for key, value in self.request_headers.items()
        }
        return (
            f"{self.method} {self.url} -> {self.status} ({self.elapsed_ms:.0f}ms)\n"
            f"request headers: {headers}\n"
            f"body: {truncate(self.text)}"
        )


class ApiClient:
    """HTTP client whose authentication state is per instance, never per session."""

    def __init__(
        self,
        token: str | None = None,
        *,
        settings: Settings = default_settings,
        session: requests.Session | None = None,
    ) -> None:
        self.settings = settings
        self.session = session or requests.Session()
        self._token = token

        # Transport defaults belong to the session; credentials never do.
        for name, value in DEFAULT_HEADERS.items():
            self.session.headers.setdefault(name, value)
        self.session.headers.pop("Authorization", None)

    # -- authentication state -------------------------------------------------
    @property
    def token(self) -> str | None:
        """The token used when a request does not pass one explicitly."""
        return self._token

    def with_token(self, token: str | None) -> "ApiClient":
        """Return a new client on the same transport with its own token.

        The original client keeps its token and the shared session is untouched.
        """
        return ApiClient(token, settings=self.settings, session=self.session)

    def without_auth(self) -> "ApiClient":
        """Return an unauthenticated client; other clients are unaffected."""
        return self.with_token(None)

    # -- core request ---------------------------------------------------------
    def request(
        self,
        method: str,
        path: str,
        *,
        json: Any | None = None,
        params: Mapping[str, Any] | None = None,
        data: Any | None = None,
        headers: Mapping[str, str] | None = None,
        token: str | None = None,
        timeout: int | None = None,
    ) -> ApiResponse:
        url = self._build_url(path)
        request_headers = self._headers_for(token)
        if headers:
            # Explicit headers win, e.g. a lowercase "bearer" scheme in a test.
            request_headers.update(headers)

        started = time.perf_counter()
        response = self.session.request(
            method=method,
            url=url,
            json=json,
            data=data,
            params=params,
            headers=request_headers,
            timeout=timeout if timeout is not None else self.settings.request_timeout,
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        wrapped = ApiResponse(
            response=response,
            method=method.upper(),
            url=url,
            elapsed_ms=elapsed_ms,
            request_headers=request_headers,
        )

        logger.info("%s %s -> %s (%.0fms)", method.upper(), url, wrapped.status, elapsed_ms)
        if wrapped.status >= 400:
            logger.warning("response body: %s", truncate(wrapped.text))
        return wrapped

    def _headers_for(self, token: str | None) -> dict[str, str]:
        effective = self._token if token is None else token
        if not effective:
            return {}
        return {"Authorization": f"Bearer {effective}"}

    def get(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> ApiResponse:
        return self.request("DELETE", path, **kwargs)

    # -- convenience ----------------------------------------------------------
    def login(self, username: str, password: str) -> ApiResponse:
        return self.request(
            "POST",
            "/auth/login",
            json={"username": username, "password": password},
        )

    def health(self) -> ApiResponse:
        return self.request("GET", "/actuator/health", timeout=5)

    def _build_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        if path.startswith("/actuator") or path.startswith("/v3"):
            return self.settings.base_url.rstrip("/") + path
        return self.settings.api_root + ("" if path.startswith("/") else "/") + path
