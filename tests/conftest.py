"""Pytest entry point: path setup, shared fixtures and a fail-fast health gate."""

from __future__ import annotations

import sys
import time
from pathlib import Path

TESTS_ROOT = Path(__file__).resolve().parent
if str(TESTS_ROOT) not in sys.path:
    sys.path.insert(0, str(TESTS_ROOT))

import pytest
import requests

from config.settings import settings
from utils.db_helper import DbHelper
from utils.logger import get_logger

# Re-export fixtures so they are discoverable from every test module.
from fixtures.auth_fixtures import (  # noqa: F401
    admin_client,
    admin_token,
    admin_user,
    agent_client,
    agent_token,
    anonymous_client,
    requester_client,
    requester_factory,
    requester_token,
    staff_accounts,
)
from fixtures.ticket_fixtures import (  # noqa: F401
    article_factory,
    ticket,
    ticket_factory,
)
from fixtures.user_fixtures import user_factory  # noqa: F401
from fixtures.ui_fixtures import (  # noqa: F401
    authenticated_page,
    browser,
    screenshot_active_pages,
    ui_context,
    ui_login,
    ui_page,
    ui_server,
)

logger = get_logger("conftest")


def pytest_configure(config: pytest.Config) -> None:
    logger.info(
        "run against %s (api prefix %s, run_id=%s)",
        settings.base_url,
        settings.api_prefix,
        settings.run_id,
    )


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):
    """Attach a browser screenshot to every failing UI test."""
    report = yield
    if report.when == "call" and report.failed and "ui" in item.keywords:
        screenshot_active_pages(item.name)
    return report


def _wait_for_backend() -> None:
    deadline = time.time() + settings.health_timeout
    last_error: str | None = None
    while time.time() < deadline:
        try:
            response = requests.get(settings.health_url, timeout=5)
            if response.status_code == 200 and response.json().get("status") == "UP":
                logger.info("backend is UP at %s", settings.health_url)
                return
            last_error = f"status={response.status_code} body={response.text[:200]}"
        except requests.RequestException as exc:  # not up yet
            last_error = str(exc)
        time.sleep(2)
    pytest.exit(
        f"Backend did not become healthy within {settings.health_timeout}s at "
        f"{settings.health_url} (last error: {last_error}).\n"
        "Start it with: docker compose up -d mysql app   (or java -jar ...)",
        returncode=3,
    )


@pytest.fixture(scope="session", autouse=True)
def backend_available() -> None:
    """Fail once, clearly, instead of producing 60 confusing connection errors."""
    _wait_for_backend()


@pytest.fixture(scope="session")
def db():
    """Read-only MySQL access for assertions the HTTP API cannot express.

    Skips (not silently passes) when database checks are disabled or the
    database is unreachable, so a skipped check is always visible in the report.
    """
    helper = DbHelper(settings)
    if not helper.available:
        pytest.skip("database assertions disabled or unreachable")
    yield helper
    helper.close()
