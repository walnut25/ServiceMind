"""Authentication, token validation and role boundaries over real HTTP.

Every assertion here is derived from the backend code (SecurityConfiguration,
ApiExceptionHandler, AuthenticationService) and verified against a running
instance - nothing is mocked.
"""

from __future__ import annotations

import pytest

from config.settings import settings
from utils.assertions import assert_empty_body, assert_page, assert_problem, assert_status
from utils.data_factory import unique_password, unique_username
from utils.jwt_utils import build_token, decode_payload, tamper_signature

pytestmark = pytest.mark.api

requires_secret = pytest.mark.skipif(
    not settings.jwt_secret,
    reason="JWT_SECRET not configured; cannot craft/verify signed tokens",
)


class TestLoginSuccess:
    def test_admin_login_returns_bearer_token(self, anonymous_client, admin_user):
        response = anonymous_client.login(admin_user.username, admin_user.password)

        assert_status(response, 200)
        body = response.json()
        assert body["tokenType"] == "Bearer"
        assert len(body["accessToken"].split(".")) == 3, "accessToken is not a JWS compact token"
        assert body["expiresAt"], "expiresAt must be present"

    def test_token_claims_match_the_authenticated_user(self, admin_token):
        payload = decode_payload(admin_token)

        assert payload["iss"] == "service-mind"
        assert payload["sub"] == settings.admin_username
        assert "ADMIN" in payload["scope"].split(" ")
        assert payload["exp"] > payload["iat"], "token must expire after it was issued"

    def test_username_login_is_case_insensitive(self, anonymous_client, admin_user):
        response = anonymous_client.login(admin_user.username.upper(), admin_user.password)

        assert_status(response, 200)
        # the JWT subject keeps the canonical casing stored in the database
        assert decode_payload(response.json()["accessToken"])["sub"] == admin_user.username

    def test_token_unlocks_a_protected_endpoint(self, admin_client):
        response = admin_client.get("/tickets", params={"size": 1})

        assert_status(response, 200)
        assert_page(response.json(), size=1)


class TestLoginFailure:
    def test_wrong_password_is_rejected_without_leaking_details(self, anonymous_client, admin_user):
        response = anonymous_client.login(admin_user.username, "definitely-not-the-password")

        assert_problem(
            response,
            status=401,
            title="Authentication failed",
            detail_contains="Invalid username or password",
        )

    def test_unknown_user_returns_the_same_error_as_a_wrong_password(self, anonymous_client):
        response = anonymous_client.login(unique_username("ghost"), unique_password())

        assert_problem(
            response,
            status=401,
            title="Authentication failed",
            detail_contains="Invalid username or password",
        )

    def test_disabled_account_cannot_log_in(self, anonymous_client, admin_client, user_factory):
        user = user_factory(["REQUESTER"])
        disabled = admin_client.patch(f"/users/{user.user_id}/enabled", json={"enabled": False})
        assert_status(disabled, 200)
        assert disabled.json()["enabled"] is False

        response = anonymous_client.login(user.username, user.password)

        assert_problem(response, status=401, title="Authentication failed")

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({"username": "admin"}, id="missing-password"),
            pytest.param({"password": "Admin123!"}, id="missing-username"),
            pytest.param({"username": "", "password": "Admin123!"}, id="blank-username"),
            pytest.param({"username": "admin", "password": ""}, id="blank-password"),
            pytest.param({}, id="empty-body"),
        ],
    )
    def test_missing_or_blank_credentials_return_400(self, anonymous_client, payload):
        response = anonymous_client.post("/auth/login", json=payload)

        assert_problem(response, status=400, title="Invalid request")


class TestTokenValidation:
    def test_missing_token_is_rejected_with_empty_body(self, anonymous_client):
        response = anonymous_client.get("/tickets")

        assert_status(response, 401)
        assert_empty_body(response)
        assert "Bearer" in response.headers.get("WWW-Authenticate", "")

    def test_non_jwt_token_is_rejected(self, anonymous_client):
        response = anonymous_client.get("/tickets", headers={"Authorization": "Bearer not-a-jwt"})

        assert_status(response, 401)
        assert_empty_body(response)

    def test_tampered_signature_is_rejected(self, anonymous_client, admin_token):
        response = anonymous_client.get(
            "/tickets",
            headers={"Authorization": f"Bearer {tamper_signature(admin_token)}"},
        )

        assert_status(response, 401)
        assert_empty_body(response)

    def test_unknown_scheme_is_rejected(self, anonymous_client, admin_token):
        response = anonymous_client.get(
            "/tickets",
            headers={"Authorization": f"Basic {admin_token}"},
        )

        assert_status(response, 401)

    def test_bearer_scheme_is_case_insensitive(self, anonymous_client, admin_token):
        response = anonymous_client.get(
            "/tickets",
            headers={"Authorization": f"bearer {admin_token}"},
        )

        assert_status(response, 200)

    def test_token_in_query_string_is_not_accepted(self, anonymous_client, admin_token):
        response = anonymous_client.get("/tickets", params={"access_token": admin_token})

        assert_status(response, 401)

    @requires_secret
    def test_expired_token_is_rejected(self, anonymous_client):
        expired = build_token(
            secret=settings.jwt_secret,
            subject=settings.admin_username,
            scope="ADMIN",
            ttl_seconds=-120,
        )

        response = anonymous_client.get("/tickets", headers={"Authorization": f"Bearer {expired}"})

        assert_status(response, 401)
        assert_empty_body(response)

    @requires_secret
    def test_token_without_scope_is_authenticated_but_not_authorized(self, anonymous_client):
        token = build_token(secret=settings.jwt_secret, subject=settings.admin_username, scope="")
        headers = {"Authorization": f"Bearer {token}"}

        privileged = anonymous_client.get("/users", headers=headers)
        assert_status(privileged, 403)
        assert_empty_body(privileged)

        # Any authenticated principal may read actuator endpoints exposed over HTTP.
        actuator = anonymous_client.get("/actuator/metrics", headers=headers)
        assert_status(actuator, 200)

    @requires_secret
    def test_known_risk_token_for_unknown_subject_is_accepted(self, anonymous_client):
        """Documents architecture.md: token validation never hits the user table.

        If this ever starts returning 401 the hardening landed and this test
        should be flipped - it is a characterization test, not an endorsement.
        """
        forged = build_token(
            secret=settings.jwt_secret,
            subject="qa_ghost_user",
            scope="ADMIN",
            issuer="anything",
        )

        response = anonymous_client.get(
            "/users", headers={"Authorization": f"Bearer {forged}"}, params={"size": 1}
        )

        assert_status(response, 200)


class TestRoleBoundaries:
    def test_requester_cannot_list_users(self, requester_client):
        response = requester_client.get("/users")

        assert_status(response, 403)
        assert_empty_body(response)

    def test_agent_cannot_list_users(self, agent_client):
        response = agent_client.get("/users")

        assert_status(response, 403)

    def test_requester_cannot_read_ticket_metrics(self, requester_client):
        response = requester_client.get("/tickets/metrics")

        assert_status(response, 403)

    def test_admin_can_list_users(self, admin_client):
        response = admin_client.get("/users", params={"size": 5})

        assert_status(response, 200)
        assert_page(response.json(), size=5)
