"""Framework unit tests: fast, deterministic, no backend or browser."""

from __future__ import annotations

import json
from typing import Any

import pytest


class FakeResponse:
    """Minimal stand-in for ``requests.Response``."""

    def __init__(
        self,
        status_code: int = 200,
        payload: Any | None = None,
        *,
        text: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}
        if text is not None:
            self.text = text
        elif payload is None:
            self.text = ""
        else:
            self.text = json.dumps(payload, ensure_ascii=False)

    def json(self) -> Any:
        if self._payload is None:
            raise ValueError("no JSON body")
        return self._payload


class FakeSession:
    """Records every request and returns a canned response."""

    def __init__(self, response: FakeResponse | None = None) -> None:
        self.headers: dict[str, str] = {}
        self.calls: list[dict[str, Any]] = []
        self.response = response or FakeResponse()

    def request(self, **kwargs: Any) -> FakeResponse:
        self.calls.append(kwargs)
        return self.response

    @property
    def last_call(self) -> dict[str, Any]:
        assert self.calls, "no request was made"
        return self.calls[-1]


@pytest.fixture
def fake_response() -> FakeResponse:
    return FakeResponse(payload={"ok": True})


@pytest.fixture
def fake_session(fake_response: FakeResponse) -> FakeSession:
    return FakeSession(fake_response)
