"""Locator helpers that survive Ant Design's rendering quirks.

Ant Design inserts a space between exactly two CJK characters inside a button
("登录" renders as "登 录"), so an exact accessible-name lookup fails. These
helpers build whitespace-tolerant matchers instead of weakening the assertion.
"""

from __future__ import annotations

import re

from playwright.sync_api import Locator, Page


def _loose(text: str) -> re.Pattern[str]:
    """Match the text allowing optional whitespace between every character."""
    return re.compile(r"\s*".join(re.escape(char) for char in text))


def button(page: Page, label: str, *, exact: bool = True) -> Locator:
    """Role-based button locator tolerant to Ant Design's inserted spaces."""
    pattern = _loose(label) if exact else re.compile(re.escape(label))
    return page.get_by_role("button", name=pattern)


def menuitem(page: Page, label: str) -> Locator:
    return page.get_by_role("menuitem", name=_loose(label))


def text(page: Page, value: str) -> Locator:
    return page.get_by_text(value)


def tag(page: Page, value: str) -> Locator:
    """Status/priority Tag inside an Ant Design table or card."""
    return page.locator(".ant-tag", has_text=value)
