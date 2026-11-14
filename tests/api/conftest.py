"""API tests need a running backend and database."""

from __future__ import annotations

import pytest


@pytest.fixture(scope="session", autouse=True)
def _require_backend(backend_health) -> None:
    """Reuse the shared health gate before any API test runs."""
    return None
