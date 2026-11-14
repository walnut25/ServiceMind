"""Unit tests for UI fixture bookkeeping: page tracking and failure screenshots."""

from __future__ import annotations

import dataclasses
from pathlib import Path

import pytest

from fixtures import ui_fixtures

pytestmark = pytest.mark.unit


class FakePage:
    def __init__(self, *, closed: bool = False, broken: bool = False) -> None:
        self.closed = closed
        self.broken = broken
        self.screenshots: list[Path] = []

    def is_closed(self) -> bool:
        return self.closed

    def screenshot(self, *, path: str, full_page: bool = True) -> None:
        if self.broken:
            raise RuntimeError("browser crashed")
        target = Path(path)
        target.write_bytes(b"png")
        self.screenshots.append(target)


@pytest.fixture(autouse=True)
def isolated_state(monkeypatch, tmp_path):
    """Fresh registry and a writable screenshot directory per test."""
    monkeypatch.setattr(ui_fixtures, "_ACTIVE_PAGES", [])
    monkeypatch.setattr(ui_fixtures, "SCREENSHOT_DIR", tmp_path)
    monkeypatch.setattr(ui_fixtures, "settings", dataclasses.replace(ui_fixtures.settings, ui_screenshots=True))
    return tmp_path


class TestPageRegistry:
    def test_track_and_untrack(self):
        page = FakePage()

        ui_fixtures.track(page)
        assert ui_fixtures.active_page_count() == 1

        ui_fixtures.untrack(page)
        assert ui_fixtures.active_page_count() == 0

    def test_tracking_is_idempotent(self):
        page = FakePage()

        ui_fixtures.track(page)
        ui_fixtures.track(page)

        assert ui_fixtures.active_page_count() == 1

    def test_untracking_an_unknown_page_is_safe(self):
        ui_fixtures.untrack(FakePage())

        assert ui_fixtures.active_page_count() == 0

    def test_registry_does_not_grow_across_tests(self):
        for _ in range(20):
            page = FakePage()
            ui_fixtures.track(page)
            ui_fixtures.untrack(page)

        assert ui_fixtures.active_page_count() == 0


class TestFailureScreenshots:
    def test_captures_open_pages(self, isolated_state):
        page = FakePage()
        ui_fixtures.track(page)

        ui_fixtures.screenshot_active_pages("test_failure")

        assert len(page.screenshots) == 1
        assert page.screenshots[0].name == "test_failure-0.png"
        assert page.screenshots[0].parent == isolated_state

    def test_skips_closed_pages(self):
        page = FakePage(closed=True)
        ui_fixtures.track(page)

        ui_fixtures.screenshot_active_pages("test_failure")

        assert page.screenshots == []

    def test_multiple_pages_are_numbered(self):
        first, second = FakePage(), FakePage()
        ui_fixtures.track(first)
        ui_fixtures.track(second)

        ui_fixtures.screenshot_active_pages("multi")

        assert [p.name for p in first.screenshots] == ["multi-0.png"]
        assert [p.name for p in second.screenshots] == ["multi-1.png"]

    def test_broken_page_does_not_mask_the_failure(self):
        page = FakePage(broken=True)
        ui_fixtures.track(page)

        ui_fixtures.screenshot_active_pages("broken")  # must not raise

    def test_screenshots_can_be_disabled(self, monkeypatch, tmp_path):
        monkeypatch.setattr(ui_fixtures, "settings", dataclasses.replace(ui_fixtures.settings, ui_screenshots=False))
        page = FakePage()
        ui_fixtures.track(page)

        ui_fixtures.screenshot_active_pages("disabled")

        assert page.screenshots == []
