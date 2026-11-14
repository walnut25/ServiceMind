"""Unique, self-describing test data.

The API has no DELETE endpoints, so tests never aim to "clean everything up".
Instead every object is created with a run-scoped unique name, tests only ever
touch what they created, and a fresh database volume is used in CI.
"""

from __future__ import annotations

import secrets
import time
from typing import Any

from config.settings import settings

_counter = 0


def unique_suffix() -> str:
    global _counter
    _counter += 1
    return f"{settings.run_id}_{int(time.time() % 100000)}_{_counter}_{secrets.token_hex(3)}"


def unique_username(role: str) -> str:
    return f"qa_{role.lower()}_{unique_suffix()}"[:100]


def unique_password(length: int = 16) -> str:
    """Password that satisfies the 12..72 character policy."""
    return "Qa!" + secrets.token_urlsafe(length)[:length]


def ticket_payload(*, title: str | None = None, priority: str = "P3") -> dict[str, Any]:
    suffix = unique_suffix()
    return {
        "title": title or f"QA ticket {suffix}",
        "description": f"Created by the automation suite ({suffix})",
        "priority": priority,
    }


def article_payload(*, title: str | None = None) -> dict[str, Any]:
    suffix = unique_suffix()
    return {
        "title": title or f"QA article {suffix}",
        "summary": f"Summary {suffix}",
        "content": f"# QA article\n\nBody for {suffix}",
        "category": "qa-automation",
    }


def user_payload(roles: list[str], *, username: str | None = None, password: str | None = None) -> dict[str, Any]:
    return {
        "username": username or unique_username(roles[0]),
        "password": password or unique_password(),
        "roles": roles,
    }
