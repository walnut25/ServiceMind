"""Authentication fixtures: tokens and pre-authenticated clients per role."""

from __future__ import annotations

import pytest

from config.settings import settings
from fixtures.user_fixtures import TestUser, create_user
from utils.api_client import ApiClient
from utils.logger import get_logger

logger = get_logger("fixtures.auth")


def login(anonymous_client: ApiClient, user: TestUser) -> str:
    response = anonymous_client.login(user.username, user.password)
    assert response.status == 200, f"login failed for {user.username!r}: {response.describe()}"
    token = response.json().get("accessToken")
    assert token, f"login response has no accessToken: {response.describe()}"
    return token


def client_for(anonymous_client: ApiClient, user: TestUser) -> ApiClient:
    return ApiClient(token=login(anonymous_client, user))


@pytest.fixture(scope="session")
def anonymous_client() -> ApiClient:
    """Unauthenticated client; every test may also build its own."""
    return ApiClient()


@pytest.fixture(scope="session")
def admin_user() -> TestUser:
    return TestUser(
        username=settings.admin_username,
        password=settings.admin_password,
        roles=("ADMIN",),
        user_id=-1,  # bootstrap administrator: id is not known in advance
    )


@pytest.fixture(scope="session")
def admin_token(anonymous_client: ApiClient, admin_user: TestUser) -> str:
    return login(anonymous_client, admin_user)


@pytest.fixture(scope="session")
def admin_client(admin_token: str) -> ApiClient:
    return ApiClient(token=admin_token)


@pytest.fixture(scope="session")
def staff_accounts(admin_client: ApiClient) -> dict[str, TestUser]:
    """One AGENT and one REQUESTER account for the whole session."""
    agent = create_user(admin_client, ["AGENT"])
    requester = create_user(admin_client, ["REQUESTER"])
    return {"agent": agent, "requester": requester}


@pytest.fixture(scope="session")
def agent_client(anonymous_client: ApiClient, staff_accounts: dict[str, TestUser]) -> ApiClient:
    return client_for(anonymous_client, staff_accounts["agent"])


@pytest.fixture(scope="session")
def requester_client(anonymous_client: ApiClient, staff_accounts: dict[str, TestUser]) -> ApiClient:
    return client_for(anonymous_client, staff_accounts["requester"])


@pytest.fixture(scope="session")
def agent_token(agent_client: ApiClient) -> str:
    """Raw token, needed by UI tests that pre-seed sessionStorage."""
    assert agent_client.token, "agent client must be authenticated"
    return agent_client.token


@pytest.fixture(scope="session")
def requester_token(requester_client: ApiClient) -> str:
    assert requester_client.token, "requester client must be authenticated"
    return requester_client.token


@pytest.fixture
def requester_factory(anonymous_client: ApiClient, admin_client: ApiClient):
    """Create a brand new REQUESTER (and client) for a single test."""

    def factory() -> tuple[TestUser, ApiClient]:
        user = create_user(admin_client, ["REQUESTER"])
        return user, client_for(anonymous_client, user)

    return factory
