"""Unit tests for the test-data factory: uniqueness and shape."""

from __future__ import annotations

import re

import pytest

from config.settings import settings
from utils import data_factory

pytestmark = pytest.mark.unit

ROLE_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


class TestSuffix:
    def test_suffixes_are_unique(self):
        values = {data_factory.unique_suffix() for _ in range(200)}

        assert len(values) == 200

    def test_suffix_carries_the_run_id(self):
        assert data_factory.unique_suffix().startswith(settings.run_id)


class TestUsername:
    def test_shape_and_api_compatibility(self):
        username = data_factory.unique_username("AGENT")

        assert username.startswith("qa_agent_")
        assert 3 <= len(username) <= 100
        assert ROLE_PATTERN.match(username), "must satisfy the backend username pattern"

    def test_usernames_are_unique(self):
        values = {data_factory.unique_username("REQUESTER") for _ in range(100)}

        assert len(values) == 100


class TestPassword:
    def test_length_satisfies_the_backend_policy(self):
        password = data_factory.unique_password()

        assert 12 <= len(password) <= 72

    def test_passwords_are_unique(self):
        values = {data_factory.unique_password() for _ in range(50)}

        assert len(values) == 50


class TestTicketPayload:
    def test_default_shape(self):
        payload = data_factory.ticket_payload()

        assert set(payload) == {"title", "description", "priority"}
        assert payload["priority"] == "P3"
        assert payload["title"].startswith("QA ticket ")
        assert len(payload["title"]) <= 200
        assert len(payload["description"]) <= 10000

    def test_priority_override(self):
        assert data_factory.ticket_payload(priority="P1")["priority"] == "P1"

    def test_title_override(self):
        assert data_factory.ticket_payload(title="fixed title")["title"] == "fixed title"

    def test_titles_are_unique(self):
        values = {data_factory.ticket_payload()["title"] for _ in range(50)}

        assert len(values) == 50


class TestArticlePayload:
    def test_default_shape(self):
        payload = data_factory.article_payload()

        assert set(payload) == {"title", "summary", "content", "category"}
        assert len(payload["title"]) <= 200
        assert len(payload["summary"]) <= 500
        assert len(payload["content"]) <= 100000
        assert payload["category"] == "qa-automation"

    def test_titles_are_unique(self):
        values = {data_factory.article_payload()["title"] for _ in range(30)}

        assert len(values) == 30


class TestUserPayload:
    def test_roles_are_forwarded(self):
        payload = data_factory.user_payload(["ADMIN", "AGENT"])

        assert payload["roles"] == ["ADMIN", "AGENT"]
        assert payload["username"].startswith("qa_admin_")

    def test_explicit_values_win(self):
        payload = data_factory.user_payload(["AGENT"], username="fixed-user", password="fixed-password-12")

        assert payload["username"] == "fixed-user"
        assert payload["password"] == "fixed-password-12"
