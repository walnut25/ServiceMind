"""Guards for tests that cannot tolerate concurrent execution."""

from __future__ import annotations

import pytest


def require_no_xdist(request: pytest.FixtureRequest) -> None:
    """Fail loudly when a ``serial`` test is collected by an xdist worker.

    Tests that assemble one response from several queries cannot tolerate
    concurrent writes. Deselecting them silently would let a parallel run look
    green while never executing them, so they fail with instructions instead.
    """
    if hasattr(request.config, "workerinput"):
        pytest.fail(
            "this test builds one response from several queries and must not run "
            "alongside concurrent writes. Run it in its own invocation:\n"
            '  pytest tests/api -m "not serial" -n auto\n'
            "  pytest tests/api -m serial",
            pytrace=False,
        )
