"""Playwright fixtures: SPA server, browser, contexts and screenshot-on-failure."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from config.settings import TESTS_ROOT, settings
from utils.logger import get_logger
from utils.ui_server import StaticAppServer

logger = get_logger("fixtures.ui")

SCREENSHOT_DIR = Path(TESTS_ROOT) / "reports" / "screenshots"
_ACTIVE_PAGES: list = []


def track(page) -> None:
    _ACTIVE_PAGES.append(page)


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
    server = StaticAppServer(settings.frontend_dist, settings.base_url).start()
    logger.info("serving %s on %s", settings.frontend_dist, server.url)
    yield server.url
    server.stop()


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright

    options: dict = {"headless": settings.ui_headless}
    if settings.ui_browser_channel:
        options["channel"] = settings.ui_browser_channel

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**options)
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
    yield page


@pytest.fixture
def authenticated_page(ui_context):
    """Factory: (token, path) -> page already sitting on that route."""
    pages = []

    def factory(token: str, path: str = "/dashboard"):
        context = ui_context(token)
        page = context.new_page()
        track(page)
        page.goto(path)
        pages.append(page)
        return page

    yield factory


def ui_login(page, username: str, password: str) -> None:
    from utils.ui_locators import button

    page.goto("/login")
    page.get_by_placeholder("用户名").fill(username)
    page.get_by_placeholder("密码").fill(password)
    button(page, "登录").click()
    page.wait_for_url("**/dashboard")
