"""Ticket lifecycle: creation rules, SLA computation, filtering and the state machine."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from utils.assertions import assert_page, assert_problem, assert_schema, assert_status
from utils.data_factory import ticket_payload
from schemas.definitions import METRICS_SCHEMA, TICKET_SCHEMA, page_of

pytestmark = [pytest.mark.api, pytest.mark.regression]

SLA_HOURS = {"P1": 4, "P2": 8, "P3": 24, "P4": 72}


def _parse(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def _move_to(client, ticket_id: int, status: str) -> dict:
    response = client.patch(f"/tickets/{ticket_id}/status", json={"status": status})
    assert_status(response, 200)
    return response.json()


class TestCreateTicket:
    @pytest.mark.parametrize(("priority", "hours"), list(SLA_HOURS.items()))
    def test_creation_applies_priority_sla(self, requester_client, requester_factory, priority, hours):
        _, client = requester_factory()

        response = client.post("/tickets", json=ticket_payload(priority=priority))

        assert_status(response, 201)
        body = assert_schema(response, TICKET_SCHEMA)
        assert body["status"] == "OPEN"
        assert body["priority"] == priority
        assert body["assigneeUsername"] is None
        assert body["version"] == 0
        assert body["dueAt"], "dueAt must be computed at creation time"
        delta = _parse(body["dueAt"]) - _parse(body["createdAt"])
        assert delta == timedelta(hours=hours), f"expected a {hours}h SLA, got {delta}"

    @pytest.mark.smoke
    def test_requester_is_taken_from_the_token_not_the_body(self, requester_client, requester_factory):
        user, client = requester_factory()

        payload = ticket_payload()
        payload["requesterUsername"] = "somebody-else"  # ignored, not a request field
        response = client.post("/tickets", json=payload)

        assert_status(response, 201)
        assert response.json()["requesterUsername"] == user.username

    def test_new_ticket_starts_on_track(self, ticket):
        assert ticket["slaStatus"] == "ON_TRACK"
        assert ticket["resolvedAt"] is None

    def test_agent_may_also_raise_tickets(self, agent_client, staff_accounts):
        response = agent_client.post("/tickets", json=ticket_payload())

        assert_status(response, 201)
        assert response.json()["requesterUsername"] == staff_accounts["agent"].username

    @pytest.mark.parametrize(
        ("field", "value", "case"),
        [
            ("title", "", "title-blank"),
            ("title", "t" * 201, "title-too-long"),
            ("description", "", "description-blank"),
            ("description", "d" * 10001, "description-too-long"),
            ("priority", None, "priority-invalid-value"),
        ],
    )
    def test_validation_rejects_invalid_payload(self, requester_client, field, value, case):
        payload = ticket_payload()
        if value is None:
            payload.pop(field)
        else:
            payload[field] = value

        response = requester_client.post("/tickets", json=payload)

        assert_status(response, 400)

    def test_boundary_lengths_are_accepted(self, requester_client):
        payload = ticket_payload()
        payload["title"] = "t" * 200
        payload["description"] = "d" * 10000

        response = requester_client.post("/tickets", json=payload)

        assert_status(response, 201)
        assert len(response.json()["title"]) == 200


class TestReadTickets:
    def test_get_by_id(self, requester_client, ticket):
        response = requester_client.get(f"/tickets/{ticket['id']}")

        assert_status(response, 200)
        assert response.json()["id"] == ticket["id"]

    def test_unknown_ticket_returns_404(self, requester_client):
        response = requester_client.get("/tickets/99999999")

        assert_problem(response, status=404, title="Ticket not found")

    @pytest.mark.security
    def test_requester_cannot_read_someone_elses_ticket(self, requester_factory, ticket):
        _, other_client = requester_factory()

        response = other_client.get(f"/tickets/{ticket['id']}")

        # 404, not 403: existence must not leak (architecture.md)
        assert_problem(response, status=404, title="Ticket not found")

    @pytest.mark.security
    def test_requester_list_is_scoped_to_own_tickets(self, requester_factory, ticket):
        _, other_client = requester_factory()
        own = other_client.post("/tickets", json=ticket_payload()).json()

        response = other_client.get("/tickets", params={"size": 100})

        assert_status(response, 200)
        body = assert_page(response.json())
        ids = {row["id"] for row in body["content"]}
        assert own["id"] in ids
        assert ticket["id"] not in ids, "a requester must never see foreign tickets"


class TestFiltering:
    def test_list_tickets_matches_page_envelope(self, agent_client):
        response = agent_client.get("/tickets", params={"size": 5})

        assert_status(response, 200)
        body = assert_schema(response, page_of(TICKET_SCHEMA))
        assert body["page"]["size"] == 5

    def test_priority_filter(self, requester_client):
        created = requester_client.post("/tickets", json=ticket_payload(priority="P1")).json()

        response = requester_client.get("/tickets", params={"priority": "P1", "size": 100})

        assert_status(response, 200)
        rows = assert_page(response.json())["content"]
        assert created["id"] in {row["id"] for row in rows}
        assert all(row["priority"] == "P1" for row in rows)

    def test_status_filter_follows_transitions(self, requester_client, agent_client, ticket):
        _move_to(agent_client, ticket["id"], "IN_PROGRESS")

        response = requester_client.get("/tickets", params={"status": "IN_PROGRESS", "size": 100})

        rows = assert_page(response.json())["content"]
        assert ticket["id"] in {row["id"] for row in rows}
        assert all(row["status"] == "IN_PROGRESS" for row in rows)

    def test_assignee_filter_is_exact_and_case_insensitive(self, agent_client, ticket_factory, user_factory):
        other_agent = user_factory(["AGENT"])
        ticket, _ = ticket_factory()
        assigned = agent_client.patch(f"/tickets/{ticket.id}/assignee", json={"username": other_agent.username.upper()})
        assert_status(assigned, 200)

        response = agent_client.get("/tickets", params={"assignee": other_agent.username, "size": 100})

        rows = assert_page(response.json())["content"]
        assert ticket.id in {row["id"] for row in rows}
        # the stored assignee keeps the casing sent by the caller
        assert all(row["assigneeUsername"].lower() == other_agent.username.lower() for row in rows)

    def test_fresh_ticket_is_not_sla_breached(self, requester_client, ticket):
        response = requester_client.get("/tickets", params={"slaBreached": "false", "size": 100})

        rows = assert_page(response.json())["content"]
        assert ticket["id"] in {row["id"] for row in rows}


class TestMetrics:
    def test_metrics_shape_consistent_with_buckets(self, agent_client):
        response = agent_client.get("/tickets/metrics")

        assert_status(response, 200)
        body = assert_schema(response, METRICS_SCHEMA)
        assert set(body["byStatus"]) == {"OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"}
        assert set(body["byPriority"]) == {"P1", "P2", "P3", "P4"}
        assert sum(body["byStatus"].values()) == body["total"]
        assert body["active"] == body["byStatus"]["OPEN"] + body["byStatus"]["IN_PROGRESS"]
        assert 0 <= body["breached"] <= body["active"]


class TestStateMachine:
    @pytest.mark.smoke
    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            (["IN_PROGRESS", "RESOLVED", "CLOSED"], "CLOSED"),
            (["CLOSED"], "CLOSED"),
            (["IN_PROGRESS", "CLOSED"], "CLOSED"),
            (["IN_PROGRESS", "RESOLVED", "IN_PROGRESS"], "IN_PROGRESS"),
        ],
        ids=["happy-path", "open-to-closed", "in-progress-to-closed", "reopen"],
    )
    def test_legal_transitions(self, ticket, agent_client, path, expected):
        body = None
        for status in path:
            body = _move_to(agent_client, ticket["id"], status)

        assert body["status"] == expected

    def test_resolving_sets_resolved_at_and_sla_met(self, ticket, agent_client):
        _move_to(agent_client, ticket["id"], "IN_PROGRESS")
        resolved = _move_to(agent_client, ticket["id"], "RESOLVED")

        assert resolved["resolvedAt"] is not None
        assert resolved["slaStatus"] == "MET"

    def test_reopening_clears_resolved_at(self, ticket, agent_client):
        _move_to(agent_client, ticket["id"], "IN_PROGRESS")
        _move_to(agent_client, ticket["id"], "RESOLVED")
        reopened = _move_to(agent_client, ticket["id"], "IN_PROGRESS")

        assert reopened["resolvedAt"] is None
        assert reopened["slaStatus"] == "ON_TRACK"

    @pytest.mark.parametrize(
        ("setup", "illegal"),
        [
            ([], "OPEN"),
            ([], "RESOLVED"),
            (["IN_PROGRESS"], "OPEN"),
            (["IN_PROGRESS", "RESOLVED"], "OPEN"),
            (["CLOSED"], "OPEN"),
            (["CLOSED"], "IN_PROGRESS"),
            (["CLOSED"], "RESOLVED"),
            (["CLOSED"], "CLOSED"),
        ],
        ids=[
            "open-to-open",
            "open-to-resolved",
            "in-progress-to-open",
            "resolved-to-open",
            "closed-to-open",
            "closed-to-in-progress",
            "closed-to-resolved",
            "closed-to-closed",
        ],
    )
    def test_illegal_transitions_return_409(self, ticket, agent_client, setup, illegal):
        for status in setup:
            _move_to(agent_client, ticket["id"], status)

        response = agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": illegal})

        assert_problem(response, status=409, title="Invalid ticket transition")
        detail = response.json()["detail"]
        assert "cannot transition" in detail

    @pytest.mark.security
    def test_requester_cannot_transition(self, requester_client, ticket):
        response = requester_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "IN_PROGRESS"})

        assert_status(response, 403)

    def test_transitioning_unknown_ticket_returns_404(self, agent_client):
        response = agent_client.patch("/tickets/99999999/status", json={"status": "IN_PROGRESS"})

        assert_problem(response, status=404, title="Ticket not found")

    def test_missing_status_is_rejected(self, agent_client, ticket):
        response = agent_client.patch(f"/tickets/{ticket['id']}/status", json={})

        assert_problem(response, status=400, title="Invalid request")

    def test_unknown_status_value_is_rejected(self, agent_client, ticket):
        response = agent_client.patch(f"/tickets/{ticket['id']}/status", json={"status": "DONE"})

        assert_status(response, 400)


class TestAssignment:
    def test_agent_can_assign_ticket(self, agent_client, ticket, user_factory):
        agent = user_factory(["AGENT"])

        response = agent_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": agent.username})

        assert_status(response, 200)
        assert response.json()["assigneeUsername"] == agent.username

    def test_assignee_is_stripped(self, agent_client, ticket, user_factory):
        agent = user_factory(["AGENT"])

        response = agent_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": f"  {agent.username}  "})

        assert_status(response, 200)
        assert response.json()["assigneeUsername"] == agent.username

    def test_requester_cannot_be_assigned(self, agent_client, ticket, user_factory):
        requester = user_factory(["REQUESTER"])

        response = agent_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": requester.username})

        assert_problem(response, status=422, title="Invalid ticket assignee")

    def test_unknown_assignee_is_rejected(self, agent_client, ticket):
        response = agent_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": "no-such-user"})

        assert_problem(response, status=422, title="Invalid ticket assignee")

    def test_assignee_validation_runs_before_existence_check(self, agent_client):
        """Documented ordering: an invalid assignee wins over a missing ticket."""

        response = agent_client.patch("/tickets/99999999/assignee", json={"username": "no-such-user"})

        assert_problem(response, status=422, title="Invalid ticket assignee")

    def test_assigning_unknown_ticket_with_valid_assignee_returns_404(self, agent_client, user_factory):
        agent = user_factory(["AGENT"])

        response = agent_client.patch("/tickets/99999999/assignee", json={"username": agent.username})

        assert_problem(response, status=404, title="Ticket not found")

    def test_blank_assignee_is_rejected(self, agent_client, ticket):
        response = agent_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": "   "})

        assert_problem(response, status=400, title="Invalid request")

    @pytest.mark.security
    def test_requester_cannot_assign(self, requester_client, ticket, user_factory):
        agent = user_factory(["AGENT"])

        response = requester_client.patch(f"/tickets/{ticket['id']}/assignee", json={"username": agent.username})

        assert_status(response, 403)
