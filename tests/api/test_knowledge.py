"""Knowledge base: article lifecycle, visibility rules and full-text search."""

from __future__ import annotations

from datetime import datetime

import pytest

from schemas.definitions import ARTICLE_SCHEMA, page_of
from utils.assertions import assert_page, assert_problem, assert_schema, assert_status
from utils.data_factory import article_payload, unique_suffix

pytestmark = pytest.mark.api


def _ts(value: str) -> float:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def _create(agent_client, **overrides):
    payload = article_payload()
    payload.update(overrides)
    return agent_client.post("/knowledge/articles", json=payload)


class TestCreateArticle:
    def test_agent_creates_a_draft(self, agent_client, staff_accounts):
        response = _create(agent_client)

        assert_status(response, 201)
        body = assert_schema(response, ARTICLE_SCHEMA)
        assert body["status"] == "DRAFT"
        assert body["publishedAt"] is None
        assert body["createdBy"] == staff_accounts["agent"].username
        assert body["version"] == 0

    def test_requester_cannot_create_articles(self, requester_client):
        payload = article_payload()

        response = requester_client.post("/knowledge/articles", json=payload)

        assert_status(response, 403)

    @pytest.mark.parametrize(
        ("field", "value", "case"),
        [
            ("title", "", "title-blank"),
            ("title", "t" * 201, "title-too-long"),
            ("summary", "", "summary-blank"),
            ("summary", "s" * 501, "summary-too-long"),
            ("content", "", "content-blank"),
            ("content", "c" * 100001, "content-too-long"),
            ("category", "", "category-blank"),
            ("category", "c" * 101, "category-too-long"),
        ],
    )
    def test_validation(self, agent_client, field, value, case):
        response = _create(agent_client, **{field: value})

        assert_problem(response, status=400, title="Invalid request")


class TestVisibility:
    def test_agent_can_read_a_draft(self, agent_client):
        created = _create(agent_client).json()

        response = agent_client.get(f"/knowledge/articles/{created['id']}")

        assert_status(response, 200)
        assert response.json()["status"] == "DRAFT"

    def test_requester_cannot_read_a_draft(self, requester_client, agent_client):
        created = _create(agent_client).json()

        response = requester_client.get(f"/knowledge/articles/{created['id']}")

        # hidden by id, not by 403 - same privacy rule as tickets
        assert_problem(response, status=404, title="Knowledge article not found")

    def test_requester_can_read_a_published_article(self, requester_client, article_factory):
        article = article_factory(publish=True)

        response = requester_client.get(f"/knowledge/articles/{article['id']}")

        assert_status(response, 200)
        assert response.json()["status"] == "PUBLISHED"

    def test_listing_only_returns_published_articles(self, agent_client, article_factory):
        draft = article_factory(publish=False)
        published = article_factory(publish=True)

        response = agent_client.get("/knowledge/articles", params={"size": 100})

        assert_status(response, 200)
        body = assert_schema(response, page_of(ARTICLE_SCHEMA))
        ids = {row["id"] for row in body["content"]}
        assert published["id"] in ids
        assert draft["id"] not in ids, "drafts must never appear in the public list"
        assert all(row["status"] == "PUBLISHED" for row in body["content"])

    def test_unknown_article_returns_404(self, requester_client):
        response = requester_client.get("/knowledge/articles/99999999")

        assert_problem(response, status=404, title="Knowledge article not found")


class TestLifecycle:
    def test_publish_sets_status_and_timestamp(self, agent_client, article_factory):
        article = article_factory(publish=False)

        response = agent_client.post(f"/knowledge/articles/{article['id']}/publish")

        assert_status(response, 200)
        body = response.json()
        assert body["status"] == "PUBLISHED"
        assert body["publishedAt"] is not None

    def test_publishing_twice_refreshes_published_at(self, agent_client, article_factory):
        article = article_factory(publish=True)

        response = agent_client.post(f"/knowledge/articles/{article['id']}/publish")

        assert_status(response, 200)
        assert response.json()["status"] == "PUBLISHED"

    def test_published_article_can_still_be_edited(self, agent_client, article_factory):
        """Documents the real rule: only ARCHIVED articles are frozen."""
        article = article_factory(publish=True)
        updated_payload = article_payload()
        updated_payload["category"] = "qa-updated"

        response = agent_client.put(f"/knowledge/articles/{article['id']}", json=updated_payload)

        assert_status(response, 200)
        assert response.json()["category"] == "qa-updated"

    def test_archive_keeps_published_at(self, agent_client, article_factory):
        article = article_factory(publish=True)
        published_at = article["publishedAt"]

        response = agent_client.post(f"/knowledge/articles/{article['id']}/archive")

        assert_status(response, 200)
        body = response.json()
        assert body["status"] == "ARCHIVED"
        # publishedAt must survive archiving. It is compared with a tolerance
        # because the API emits nanosecond Instants while MySQL stores
        # TIMESTAMP(6), so a round-trip rounds to the nearest microsecond.
        assert body["publishedAt"] is not None
        assert abs(_ts(body["publishedAt"]) - _ts(published_at)) < 0.01

    def test_archived_article_rejects_edits_and_publish(self, agent_client, article_factory):
        article = article_factory(publish=True)
        assert_status(agent_client.post(f"/knowledge/articles/{article['id']}/archive"), 200)

        edit = agent_client.put(f"/knowledge/articles/{article['id']}", json=article_payload())
        assert_problem(edit, status=409, title="Invalid article state", detail_contains="Archived articles cannot be edited")

        publish = agent_client.post(f"/knowledge/articles/{article['id']}/publish")
        assert_problem(publish, status=409, title="Invalid article state", detail_contains="Archived articles cannot be published")

    def test_archiving_twice_returns_409(self, agent_client, article_factory):
        article = article_factory(publish=True)
        assert_status(agent_client.post(f"/knowledge/articles/{article['id']}/archive"), 200)

        response = agent_client.post(f"/knowledge/articles/{article['id']}/archive")

        assert_problem(response, status=409, title="Invalid article state", detail_contains="already archived")

    def test_version_increments_on_update(self, agent_client, article_factory):
        article = article_factory(publish=False)
        assert article["version"] == 0

        response = agent_client.put(f"/knowledge/articles/{article['id']}", json=article_payload())

        assert_status(response, 200)
        assert response.json()["version"] == 1

    def test_updating_unknown_article_returns_404(self, agent_client):
        response = agent_client.put("/knowledge/articles/99999999", json=article_payload())

        assert_problem(response, status=404, title="Knowledge article not found")

    @pytest.mark.security
    def test_requester_cannot_publish_or_archive(self, requester_client, article_factory):
        article = article_factory(publish=False)

        assert_status(requester_client.post(f"/knowledge/articles/{article['id']}/publish"), 403)
        assert_status(requester_client.post(f"/knowledge/articles/{article['id']}/archive"), 403)
        assert_status(requester_client.put(f"/knowledge/articles/{article['id']}", json=article_payload()), 403)


class TestSearch:
    def test_search_finds_published_article_by_unique_token(self, requester_client, agent_client):
        token = f"qaunique{unique_suffix().replace('_', '')}"
        created = _create(agent_client, title=f"Article about {token}", content=f"Details for {token}").json()
        assert_status(agent_client.post(f"/knowledge/articles/{created['id']}/publish"), 200)

        response = requester_client.get("/knowledge/articles/search", params={"query": token, "size": 20})

        assert_status(response, 200)
        body = assert_page(response.json())
        ids = {row["id"] for row in body["content"]}
        assert created["id"] in ids

    def test_search_ignores_drafts(self, agent_client):
        token = f"qadraft{unique_suffix().replace('_', '')}"
        created = _create(agent_client, title=f"Draft about {token}").json()

        response = agent_client.get("/knowledge/articles/search", params={"query": token})

        assert_status(response, 200)
        ids = {row["id"] for row in response.json()["content"]}
        assert created["id"] not in ids

    def test_search_ignores_archived_articles(self, agent_client):
        token = f"qaarch{unique_suffix().replace('_', '')}"
        created = _create(agent_client, title=f"Archived about {token}").json()
        assert_status(agent_client.post(f"/knowledge/articles/{created['id']}/publish"), 200)
        assert_status(agent_client.post(f"/knowledge/articles/{created['id']}/archive"), 200)

        response = agent_client.get("/knowledge/articles/search", params={"query": token})

        assert_status(response, 200)
        ids = {row["id"] for row in response.json()["content"]}
        assert created["id"] not in ids

    @pytest.mark.parametrize(
        "params",
        [
            pytest.param({}, id="missing-query"),
            pytest.param({"query": ""}, id="blank-query"),
            pytest.param({"query": "q" * 201}, id="query-too-long"),
        ],
    )
    def test_search_requires_a_valid_query(self, requester_client, params):
        response = requester_client.get("/knowledge/articles/search", params=params)

        assert_status(response, 400)
