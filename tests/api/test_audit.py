"""Audit trail: which events every business action leaves behind."""

from __future__ import annotations

import pytest

from utils.assertions import assert_page, assert_problem, assert_status

pytestmark = [pytest.mark.api, pytest.mark.regression]


def _audit(agent_client, ticket_id: int, size: int = 50) -> list[dict]:
    response = agent_client.get(f"/tickets/{ticket_id}/audit-events", params={"size": size})
    assert_status(response, 200)
    return assert_page(response.json())["content"]


class TestAuditTrail:
    def test_created_ticket_emits_one_event(self, agent_client, ticket, staff_accounts):
        events = _audit(agent_client, ticket["id"])

        assert len(events) == 1
        event = events[0]
        assert event["eventType"] == "TICKET_CREATED"
        assert event["actorUsername"] == staff_accounts["requester"].username
        assert event["details"] == f"Ticket created with priority {ticket['priority']}"

    def test_full_lifecycle_produces_four_event_types(self, agent_client, requester_client, ticket, user_factory):
        agent = user_factory(["AGENT"])

        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": agent.username}), 200)
        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "IN_PROGRESS"}), 200)
        assert_status(agent_client.post(f"/tickets/{ticket['id']}/comments", json={"content": "working"}), 201)

        events = _audit(agent_client, ticket["id"])
        types = [event["eventType"] for event in events]

        # default sort is createdAt DESC -> newest first
        assert types == ["COMMENT_ADDED", "STATUS_CHANGED", "ASSIGNEE_CHANGED", "TICKET_CREATED"]

    def test_event_details_are_descriptive(self, agent_client, ticket, user_factory):
        agent = user_factory(["AGENT"])
        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": agent.username}), 200)
        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "IN_PROGRESS"}), 200)

        details = {event["eventType"]: event["details"] for event in _audit(agent_client, ticket["id"])}

        assert details["ASSIGNEE_CHANGED"] == f"Assignee changed from unassigned to {agent.username}"
        assert details["STATUS_CHANGED"] == "Status changed from OPEN to IN_PROGRESS"

    def test_actors_are_recorded_per_event(self, agent_client, ticket, staff_accounts):
        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "IN_PROGRESS"}), 200)

        actors = {event["eventType"]: event["actorUsername"] for event in _audit(agent_client, ticket["id"])}

        assert actors["TICKET_CREATED"] == staff_accounts["requester"].username
        assert actors["STATUS_CHANGED"] == staff_accounts["agent"].username

    def test_illegal_transition_writes_no_audit_event(self, agent_client, ticket):
        before = len(_audit(agent_client, ticket["id"]))

        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "RESOLVED"}), 409)

        assert len(_audit(agent_client, ticket["id"])) == before, "a rejected transition must not be audited"

    @pytest.mark.security
    def test_requester_cannot_read_audit_trail(self, requester_client, ticket):
        response = requester_client.get(f"/tickets/{ticket['id']}/audit-events")

        assert_status(response, 403)

    def test_audit_of_unknown_ticket_returns_404(self, agent_client):
        response = agent_client.get("/tickets/99999999/audit-events")

        assert_problem(response, status=404, title="Ticket not found")


class TestAuditPersistence:
    def test_database_rows_and_api_events_agree(self, agent_client, ticket, db):
        assert_status(agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "IN_PROGRESS"}), 200)

        api_events = _audit(agent_client, ticket["id"])
        db_types = db.audit_event_types(ticket["id"])

        assert db_types == [event["eventType"] for event in reversed(api_events)]
