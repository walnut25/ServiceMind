"""Ticket/comment/article fixtures shared by the business API tests."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from utils import data_factory
from utils.api_client import ApiClient
from utils.logger import get_logger

logger = get_logger("fixtures.tickets")


@dataclass(frozen=True)
class TicketRef:
    id: int
    title: str
    requester_username: str


def create_ticket(client: ApiClient, *, priority: str = "P3", title: str | None = None) -> tuple[TicketRef, dict[str, Any]]:
    payload = data_factory.ticket_payload(priority=priority, title=title)
    response = client.post("/tickets", json=payload)
    assert response.status == 201, f"could not create ticket: {response.describe()}"
    body = response.json()
    logger.info("created ticket id=%s priority=%s", body["id"], body["priority"])
    return TicketRef(id=body["id"], title=body["title"], requester_username=body["requesterUsername"]), body


@pytest.fixture
def ticket_factory(requester_client: ApiClient):
    """Create tickets as the session REQUESTER, with optional overrides."""

    def factory(*, priority: str = "P3", title: str | None = None, client: ApiClient | None = None):
        return create_ticket(client or requester_client, priority=priority, title=title)

    return factory


@pytest.fixture
def ticket(ticket_factory) -> dict[str, Any]:
    _, body = ticket_factory()
    return body


@pytest.fixture
def article_factory(agent_client: ApiClient):
    """Create knowledge articles as the session AGENT."""

    def factory(*, publish: bool = False, title: str | None = None) -> dict[str, Any]:
        response = agent_client.post("/knowledge/articles", json=data_factory.article_payload(title=title))
        assert response.status == 201, f"could not create article: {response.describe()}"
        body = response.json()
        if publish:
            published = agent_client.post(f"/knowledge/articles/{body['id']}/publish")
            assert published.status == 200, f"could not publish article: {published.describe()}"
            body = published.json()
        return body

    return factory
