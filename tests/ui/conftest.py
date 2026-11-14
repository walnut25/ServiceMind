"""UI tests need a running backend, a frontend build and a browser."""

from __future__ import annotations

import pytest


@pytest.fixture(scope="session", autouse=True)
def _require_backend(backend_health) -> None:
    """Reuse the shared health gate before any browser test runs."""
    return None
