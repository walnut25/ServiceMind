"""Playwright fixtures: SPA server, browser, contexts and screenshot-on-failure."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
import requests

from config.settings import TESTS_ROOT, settings
from utils.logger import get_logger
from utils.ui_server import StaticAppServer

logger = get_logger("fixtures.ui")

# QA_SCREENSHOT_DIR keeps failure artifacts writable on a read-only checkout.
SCREENSHOT_DIR = Path(os.getenv("QA_SCREENSHOT_DIR") or (TESTS_ROOT / "reports" / "screenshots"))

# Pages that belong to the currently running test. Entries are registered when a
# page is created and dropped by that test's teardown, so the list never grows
# across the session. The failure hook runs before teardown, which is why the
# screenshot still sees the page it needs.
_ACTIVE_PAGES: list = []


def track(page) -> None:
    if page not in _ACTIVE_PAGES:
        _ACTIVE_PAGES.append(page)


def untrack(page) -> None:
    try:
        _ACTIVE_PAGES.remove(page)
    except ValueError:
        pass


def active_page_count() -> int:
    """Exposed for the framework unit tests."""
    return len(_ACTIVE_PAGES)


def screenshot_active_pages(test_name: str) -> None:
    """Capture every live page when a UI test fails (best effort)."""
    if not settings.ui_screenshots:
        return
    try:
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as exc:  # read-only workspace: keep the failure, lose the image
        logger.warning("cannot create screenshot dir: %s", exc)
        return
    for index, page in enumerate(list(_ACTIVE_PAGES)):
        try:
            if page.is_closed():
                continue
            target = SCREENSHOT_DIR / f"{test_name}-{index}.png"
            page.screenshot(path=str(target), full_page=True)
            logger.warning("failure screenshot saved to %s", target)
        except Exception as exc:  # pragma: no cover - diagnostics must not mask the failure
            logger.warning("could not capture screenshot: %s", exc)


def token_init_script(token: str) -> str:
    """The SPA keeps the JWT in sessionStorage, which storageState cannot carry."""
    return f"window.sessionStorage.setItem('accessToken', {json.dumps(token)});"


@pytest.fixture(scope="session")
def ui_server() -> str:
    """Base URL for the browser tests.

    By default a small static server serves ``frontend/dist`` and proxies
    ``/api`` to the backend. ``UI_EXTERNAL_SERVER=true`` skips it and uses
    ``UI_BASE_URL`` instead, e.g. the nginx container.
    """
    if settings.ui_external_server:
        url = settings.ui_base_url.rstrip("/")
        try:
            response = requests.get(url, timeout=5)
        except requests.RequestException as exc:
            pytest.exit(f"UI_EXTERNAL_SERVER is enabled but {url} is unreachable: {exc}", returncode=3)
        if response.status_code >= 400:
            pytest.exit(f"UI_EXTERNAL_SERVER is enabled but {url} answered {response.status_code}", returncode=3)
        logger.info("using external UI server at %s", url)
        yield url
        return

    server = StaticAppServer(settings.frontend_dist, settings.base_url, port=settings.ui_port)
    try:
        server.start()
    except OSError as exc:
        logger.warning("port %s unavailable (%s); using an ephemeral port", settings.ui_port, exc)
        server = StaticAppServer(settings.frontend_dist, settings.base_url, port=0).start()

    logger.info("serving %s on %s", settings.frontend_dist, server.url)
    yield server.url
    server.stop()


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright

    options: dict = {"headless": settings.ui_headless}
    if settings.ui_browser_channel:
        options["channel"] = settings.ui_browser_channel
    label = settings.ui_browser_channel or "bundled Chromium"

    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(**options)
        except Exception as exc:  # pragma: no cover - environment dependent
            pytest.exit(
                f"cannot launch {label}: {exc}\n"
                "Install the bundled browser with 'python -m playwright install chromium', "
                "or set UI_BROWSER_CHANNEL=chrome to reuse an installed Chrome.",
                returncode=3,
            )
        yield browser
        browser.close()


@pytest.fixture
def ui_context(browser, ui_server: str):
    """Factory for isolated browser contexts; optionally pre-seeded with a token."""
    contexts = []

    def factory(token: str | None = None):
        context = browser.new_context(
            base_url=ui_server,
            viewport={"width": 1440, "height": 900},
        )
        context.set_default_timeout(settings.ui_timeout_ms)
        if token:
            context.add_init_script(token_init_script(token))
        contexts.append(context)
        return context

    yield factory
    for context in contexts:
        context.close()


@pytest.fixture
def ui_page(ui_context):
    """Anonymous page for login-flow tests."""
    context = ui_context()
    page = context.new_page()
    track(page)
    try:
        yield page
    finally:
        untrack(page)


@pytest.fixture
def authenticated_page(ui_context):
    """Factory: (token, path) -> page already sitting on that route."""
    pages = []

    def factory(token: str, path: str = "/dashboard"):
        context = ui_context(token)
        page = context.new_page()
        track(page)
        pages.append(page)
        page.goto(path)
        return page

    yield factory
    for page in pages:
        untrack(page)


def ui_login(page, username: str, password: str) -> None:
    from utils.ui_locators import button

    page.goto("/login")
    page.get_by_placeholder("用户名").fill(username)
    page.get_by_placeholder("密码").fill(password)
    button(page, "登录").click()
    page.wait_for_url("**/dashboard")
