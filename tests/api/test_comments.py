"""Ticket comments: authorship, ordering, validation and visibility rules."""

from __future__ import annotations

import pytest

from utils.assertions import assert_page, assert_problem, assert_status

pytestmark = [pytest.mark.api, pytest.mark.regression]


class TestAddComment:
    def test_requester_can_comment_on_own_ticket(self, requester_client, ticket, staff_accounts):
        response = requester_client.post(f"/tickets/{ticket['id']}/comments", json={"content": "Any update?"})

        assert_status(response, 201)
        body = response.json()
        assert body["ticketId"] == ticket["id"]
        assert body["content"] == "Any update?"
        assert body["authorUsername"] == staff_accounts["requester"].username
        assert body["createdAt"]

    def test_agent_can_comment_on_any_ticket(self, agent_client, ticket, staff_accounts):
        response = agent_client.post(f"/tickets/{ticket['id']}/comments", json={"content": "Looking into it."})

        assert_status(response, 201)
        assert response.json()["authorUsername"] == staff_accounts["agent"].username

    @pytest.mark.parametrize(
        ("content", "expected"),
        [
            ("", 400),
            ("   ", 400),
            ("c" * 10001, 400),
            ("c" * 10000, 201),
        ],
        ids=["blank", "whitespace", "too-long", "max-length"],
    )
    def test_content_validation(self, requester_client, ticket, content, expected):
        response = requester_client.post(f"/tickets/{ticket['id']}/comments", json={"content": content})

        assert_status(response, expected)

    @pytest.mark.security
    def test_requester_cannot_comment_on_foreign_ticket(self, requester_factory, ticket):
        _, other_client = requester_factory()

        response = other_client.post(f"/tickets/{ticket['id']}/comments", json={"content": "sneaky"})

        assert_problem(response, status=404, title="Ticket not found")

    def test_commenting_unknown_ticket_returns_404(self, requester_client):
        response = requester_client.post("/tickets/99999999/comments", json={"content": "hello"})

        assert_problem(response, status=404, title="Ticket not found")


class TestListComments:
    def test_comments_are_returned_oldest_first(self, requester_client, agent_client, ticket):
        contents = ["first", "second", "third"]
        for content in contents:
            assert_status(
                requester_client.post(f"/tickets/{ticket['id']}/comments", json={"content": content}),
                201,
            )

        response = requester_client.get(f"/tickets/{ticket['id']}/comments", params={"size": 20})

        assert_status(response, 200)
        body = assert_page(response.json(), size=20)
        assert [row["content"] for row in body["content"]] == contents
        assert body["page"]["totalElements"] >= len(contents)

    def test_comment_does_not_touch_ticket_updated_at(self, requester_client, ticket):
        before = requester_client.get(f"/tickets/{ticket['id']}").json()["updatedAt"]

        assert_status(
            requester_client.post(f"/tickets/{ticket['id']}/comments", json={"content": "no side effects"}),
            201,
        )

        after = requester_client.get(f"/tickets/{ticket['id']}").json()["updatedAt"]
        assert after == before, "adding a comment must not bump the ticket's updatedAt"

    def test_comments_allowed_on_closed_ticket(self, agent_client, ticket):
        """Current behaviour: no status restriction on commenting."""
        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "CLOSED"}), 200)

        response = agent_client.post(f"/tickets/{ticket['id']}/comments", json={"content": "post-mortem note"})

        assert_status(response, 201)


class TestCommentDatabaseConsistency:
    def test_comment_rows_match_api_count(self, requester_client, ticket, db):
        for index in range(3):
            assert_status(
                requester_client.post(f"/tickets/{ticket['id']}/comments", json={"content": f"db-check-{index}"}),
                201,
            )

        api_total = requester_client.get(f"/tickets/{ticket['id']}/comments").json()["page"]["totalElements"]

        assert db.comment_count(ticket["id"]) == api_total
