"""Unit tests for ApiClient: transport defaults, authentication isolation, wiring."""

from __future__ import annotations

from dataclasses import replace

import pytest

from config.settings import Settings
from unit.conftest import FakeResponse, FakeSession
from utils.api_client import ApiClient

pytestmark = pytest.mark.unit


SETTINGS = Settings(api_prefix="/api/v1", request_timeout=17, base_url="http://backend:8081")


def client(session: FakeSession, token: str | None = None) -> ApiClient:
    return ApiClient(token, settings=SETTINGS, session=session)


class TestTransportDefaults:
    def test_session_carries_transport_headers(self, fake_session):
        client(fake_session)

        assert fake_session.headers["Accept"] == "application/json"
        assert "servicemind-automation" in fake_session.headers["User-Agent"]

    def test_session_never_carries_authorization(self, fake_session):
        client(fake_session, token="secret-token")

        assert "Authorization" not in fake_session.headers

    def test_existing_session_authorization_is_removed(self, fake_session):
        fake_session.headers["Authorization"] = "Bearer stale"

        client(fake_session, token="fresh")

        assert "Authorization" not in fake_session.headers


class TestAuthentication:
    def test_token_is_attached_to_each_request(self, fake_session):
        client(fake_session, token="abc").get("/tickets")

        assert fake_session.last_call["headers"]["Authorization"] == "Bearer abc"

    def test_client_without_token_sends_no_authorization(self, fake_session):
        client(fake_session).get("/tickets")

        assert "Authorization" not in fake_session.last_call["headers"]

    def test_with_token_does_not_mutate_the_original_client(self, fake_session):
        original = client(fake_session, token="original")
        derived = original.with_token("derived")

        assert original.token == "original"
        assert derived.token == "derived"

        original.get("/tickets")
        assert fake_session.last_call["headers"]["Authorization"] == "Bearer original"

        derived.get("/tickets")
        assert fake_session.last_call["headers"]["Authorization"] == "Bearer derived"

    def test_with_token_shares_the_transport(self, fake_session):
        original = client(fake_session, token="a")

        assert original.with_token("b").session is fake_session

    def test_without_auth_does_not_affect_other_clients(self, fake_session):
        authenticated = client(fake_session, token="admin-token")
        anonymous = authenticated.without_auth()

        anonymous.get("/tickets")
        assert "Authorization" not in fake_session.last_call["headers"]

        authenticated.get("/tickets")
        assert fake_session.last_call["headers"]["Authorization"] == "Bearer admin-token"

    def test_without_auth_keeps_original_token(self, fake_session):
        authenticated = client(fake_session, token="admin-token")

        authenticated.without_auth()

        assert authenticated.token == "admin-token"

    def test_explicit_token_overrides_the_default(self, fake_session):
        client(fake_session, token="default").get("/tickets", token="override")

        assert fake_session.last_call["headers"]["Authorization"] == "Bearer override"

    def test_explicit_empty_token_clears_the_header(self, fake_session):
        client(fake_session, token="default").get("/tickets", token="")

        assert "Authorization" not in fake_session.last_call["headers"]

    def test_explicit_headers_win_over_the_default_token(self, fake_session):
        client(fake_session, token="default").get(
            "/tickets", headers={"Authorization": "bearer lower-case"}
        )

        assert fake_session.last_call["headers"]["Authorization"] == "bearer lower-case"

    def test_two_clients_on_one_session_keep_separate_tokens(self, fake_session):
        admin = client(fake_session, token="admin")
        agent = client(fake_session, token="agent")

        admin.get("/tickets")
        admin_header = fake_session.last_call["headers"]["Authorization"]
        agent.get("/tickets")
        agent_header = fake_session.last_call["headers"]["Authorization"]

        assert admin_header == "Bearer admin"
        assert agent_header == "Bearer agent"


class TestRequestWiring:
    def test_json_and_params_and_headers_are_forwarded(self, fake_session):
        client(fake_session).post(
            "/tickets",
            json={"title": "x"},
            params={"page": 2},
            headers={"X-Trace": "abc"},
        )

        call = fake_session.last_call
        assert call["method"] == "POST"
        assert call["json"] == {"title": "x"}
        assert call["params"] == {"page": 2}
        assert call["headers"]["X-Trace"] == "abc"

    def test_default_timeout_comes_from_settings(self, fake_session):
        client(fake_session).get("/tickets")

        assert fake_session.last_call["timeout"] == 17

    def test_explicit_timeout_overrides_settings(self, fake_session):
        client(fake_session).get("/tickets", timeout=3)

        assert fake_session.last_call["timeout"] == 3

    def test_health_uses_a_short_timeout(self, fake_session):
        client(fake_session).health()

        assert fake_session.last_call["timeout"] == 5
        assert fake_session.last_call["url"] == "http://backend:8081/actuator/health"

    def test_login_posts_credentials_as_json(self, fake_session):
        client(fake_session).login("admin", "Admin123!")

        call = fake_session.last_call
        assert call["url"] == "http://backend:8081/api/v1/auth/login"
        assert call["json"] == {"username": "admin", "password": "Admin123!"}

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/tickets", "http://backend:8081/api/v1/tickets"),
            ("tickets", "http://backend:8081/api/v1/tickets"),
            ("/actuator/health", "http://backend:8081/actuator/health"),
            ("http://other:9000/x", "http://other:9000/x"),
        ],
    )
    def test_url_building(self, fake_session, path, expected):
        client(fake_session).get(path)

        assert fake_session.last_call["url"] == expected


class TestResponseHandling:
    def test_non_2xx_is_returned_not_raised(self, fake_session):
        fake_session.response = FakeResponse(status_code=422, payload={"title": "Invalid"})

        response = client(fake_session).patch("/tickets/1", json={})

        assert response.status == 422
        assert response.problem_title == "Invalid"

    def test_invalid_json_returns_none(self, fake_session):
        fake_session.response = FakeResponse(status_code=500, text="<html>boom</html>")

        response = client(fake_session).get("/tickets")

        assert response.status == 500
        assert response.json() is None

    def test_describe_redacts_the_authorization_header(self, fake_session):
        response = client(fake_session, token="super-secret").get("/tickets")

        described = response.describe()

        assert "super-secret" not in described
        assert "Bearer ***" in described
        assert "GET" in described

    def test_elapsed_time_is_recorded(self, fake_session):
        response = client(fake_session).get("/tickets")

        assert response.elapsed_ms >= 0


class TestSettingsInjection:
    def test_client_uses_the_injected_settings(self, fake_session):
        custom = replace(SETTINGS, base_url="http://custom:9999", api_prefix="/v2")

        ApiClient(settings=custom, session=fake_session).get("/ping")

        assert fake_session.last_call["url"] == "http://custom:9999/v2/ping"
