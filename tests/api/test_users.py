"""User administration API: creation rules, duplicate handling, account state."""

from __future__ import annotations

import pytest

from utils.assertions import assert_page, assert_problem, assert_status
from utils.data_factory import unique_password, unique_username

pytestmark = [pytest.mark.api, pytest.mark.regression]


class TestCreateUser:
    def test_admin_can_create_agent(self, admin_client):
        payload = {
            "username": unique_username("agent"),
            "password": unique_password(),
            "roles": ["AGENT"],
        }

        response = admin_client.post("/users", json=payload)

        assert_status(response, 201)
        body = response.json()
        assert body["username"] == payload["username"]
        assert body["enabled"] is True
        assert body["roles"] == ["AGENT"]
        assert body["id"] > 0
        assert body["createdAt"]

    def test_created_user_can_log_in(self, anonymous_client, admin_client):
        payload = {
            "username": unique_username("requester"),
            "password": unique_password(),
            "roles": ["REQUESTER"],
        }
        assert_status(admin_client.post("/users", json=payload), 201)

        response = anonymous_client.login(payload["username"], payload["password"])

        assert_status(response, 200)
        assert response.json()["accessToken"]

    def test_username_is_unique_case_insensitively(self, admin_client, user_factory):
        user = user_factory(["AGENT"])

        response = admin_client.post(
            "/users",
            json={
                "username": user.username.upper(),
                "password": unique_password(),
                "roles": ["AGENT"],
            },
        )

        assert_problem(response, status=409, title="Username already exists")

    @pytest.mark.parametrize(
        ("field", "value", "case"),
        [
            ("username", "ab", "username-too-short"),
            ("username", "a" * 101, "username-too-long"),
            ("username", "bad name", "username-invalid-chars"),
            ("password", "elevenchars", "password-too-short"),
            ("password", "x" * 73, "password-too-long"),
            ("roles", [], "roles-empty"),
        ],
    )
    def test_validation_rejects_invalid_input(self, admin_client, field, value, case):
        payload = {
            "username": unique_username("bad"),
            "password": unique_password(),
            "roles": ["REQUESTER"],
        }
        payload[field] = value
        if field == "username":
            # keep the other fields valid when only the username is under test
            payload["username"] = value

        response = admin_client.post("/users", json=payload)

        assert_problem(response, status=400, title="Invalid request")

    def test_unknown_role_is_rejected(self, admin_client):
        response = admin_client.post(
            "/users",
            json={
                "username": unique_username("bad"),
                "password": unique_password(),
                "roles": ["SUPERUSER"],
            },
        )

        # Unknown enum values are rejected by Jackson before validation runs,
        # so this is the framework's default error body rather than a ProblemDetail.
        assert_status(response, 400)

    @pytest.mark.security
    def test_non_admin_cannot_create_users(self, agent_client, requester_client):
        payload = {"username": unique_username("x"), "password": unique_password(), "roles": ["REQUESTER"]}

        assert_status(agent_client.post("/users", json=payload), 403)
        assert_status(requester_client.post("/users", json=payload), 403)


class TestReadUsers:
    def test_get_user_by_id(self, admin_client, user_factory):
        user = user_factory(["REQUESTER"])

        response = admin_client.get(f"/users/{user.user_id}")

        assert_status(response, 200)
        assert response.json()["username"] == user.username

    def test_unknown_user_returns_404(self, admin_client):
        response = admin_client.get("/users/99999999")

        assert_problem(response, status=404, title="User account not found")

    def test_list_users_is_paginated(self, admin_client):
        response = admin_client.get("/users", params={"page": 0, "size": 2})

        assert_status(response, 200)
        body = assert_page(response.json(), size=2)
        assert len(body["content"]) <= 2

    def test_assignees_only_contain_enabled_staff(self, admin_client, agent_client, user_factory):
        requester = user_factory(["REQUESTER"])

        response = agent_client.get("/users/assignees", params={"size": 100})

        assert_status(response, 200)
        body = assert_page(response.json())
        usernames = {row["username"] for row in body["content"]}
        assert requester.username not in usernames, "requesters must never be assignable"
        for row in body["content"]:
            assert set(row["roles"]) & {"ADMIN", "AGENT"}, f"non-staff assignee leaked: {row}"


class TestAccountState:
    def test_admin_can_disable_and_reenable_a_user(self, anonymous_client, admin_client, user_factory):
        user = user_factory(["REQUESTER"])

        disabled = admin_client.patch(f"/users/{user.user_id}/enabled", json={"enabled": False})
        assert_status(disabled, 200)
        assert disabled.json()["enabled"] is False
        assert_problem(anonymous_client.login(user.username, user.password), status=401)

        enabled = admin_client.patch(f"/users/{user.user_id}/enabled", json={"enabled": True})
        assert_status(enabled, 200)
        assert enabled.json()["enabled"] is True
        assert_status(anonymous_client.login(user.username, user.password), 200)

    def test_admin_cannot_disable_own_account(self, admin_client, admin_user):
        # the bootstrap administrator is the oldest account, so sort by id
        me = admin_client.get("/users", params={"size": 1, "sort": "id,asc"}).json()["content"]
        own = next((row for row in me if row["username"] == admin_user.username), None)
        assert own is not None, "bootstrap administrator is not the first account"

        response = admin_client.patch(f"/users/{own['id']}/enabled", json={"enabled": False})

        assert_problem(response, status=409, title="Cannot disable own account")

    def test_disabling_unknown_user_returns_404(self, admin_client):
        response = admin_client.patch("/users/99999999/enabled", json={"enabled": False})

        assert_problem(response, status=404, title="User account not found")

    def test_missing_enabled_flag_is_rejected(self, admin_client, user_factory):
        user = user_factory(["REQUESTER"])

        response = admin_client.patch(f"/users/{user.user_id}/enabled", json={})

        assert_problem(response, status=400, title="Invalid request")
