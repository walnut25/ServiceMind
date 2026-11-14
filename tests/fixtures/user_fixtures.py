"""User fixtures: create accounts through the public admin API."""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from utils.api_client import ApiClient
from utils.data_factory import unique_password, unique_username
from utils.logger import get_logger

logger = get_logger("fixtures.users")


@dataclass(frozen=True)
class TestUser:
    username: str
    password: str
    roles: tuple[str, ...]
    user_id: int


def create_user(admin_client: ApiClient, roles: list[str], username: str | None = None) -> TestUser:
    """Create an account through ``POST /users`` and return its credentials."""
    username = username or unique_username(roles[0])
    password = unique_password()
    response = admin_client.post(
        "/users",
        json={"username": username, "password": password, "roles": roles},
    )
    assert response.status == 201, (
        f"could not create user {username!r} with roles {roles}: {response.describe()}"
    )
    body = response.json()
    logger.info("created user %s roles=%s id=%s", username, roles, body["id"])
    return TestUser(username=username, password=password, roles=tuple(roles), user_id=body["id"])


@pytest.fixture
def user_factory(admin_client: ApiClient):
    """Function-scoped factory: each test gets its own fresh accounts."""
    created: list[TestUser] = []

    def factory(roles: list[str], username: str | None = None) -> TestUser:
        user = create_user(admin_client, roles, username=username)
        created.append(user)
        return user

    yield factory
    # No DELETE /users endpoint exists, so nothing is removed here on purpose:
    # the run-scoped unique username keeps tests isolated without touching data
    # this run did not create.
