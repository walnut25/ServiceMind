"""AI assistant: grounding, validation and the deterministic "not configured" path.

No real model is called: either the question matches nothing (200, ungrounded,
no provider call) or it matches a published article while AI is disabled (503).
This keeps assertions stable without mocking business logic.
"""

from __future__ import annotations

import pytest

from config.settings import settings
from schemas.definitions import AI_ANSWER_SCHEMA
from utils.assertions import assert_problem, assert_schema, assert_status
from utils.data_factory import unique_suffix

pytestmark = pytest.mark.api


def _publish_article_about(agent_client, token: str) -> dict:
    payload = {
        "title": f"Runbook for {token}",
        "summary": f"How to handle {token}",
        "content": f"# {token}\n\nSteps to resolve {token} issues.",
        "category": "qa-ai",
    }
    created = agent_client.post("/knowledge/articles", json=payload)
    assert_status(created, 201)
    article = created.json()
    assert_status(agent_client.post(f"/knowledge/articles/{article['id']}/publish"), 200)
    return article


class TestValidation:
    def test_anonymous_access_is_rejected(self, anonymous_client):
        response = anonymous_client.post("/ai/answers", json={"question": "hello"})

        assert_status(response, 401)

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({}, id="missing-question"),
            pytest.param({"question": ""}, id="blank-question"),
            pytest.param({"question": "   "}, id="whitespace-question"),
            pytest.param({"question": "q" * 2001}, id="question-too-long"),
        ],
    )
    def test_invalid_question_is_rejected(self, requester_client, payload):
        response = requester_client.post("/ai/answers", json=payload)

        assert_problem(response, status=400, title="Invalid request")


class TestGrounding:
    def test_unmatched_question_returns_ungrounded_answer(self, requester_client):
        # a token that cannot appear in any article
        token = f"nomatch{unique_suffix().replace('_', '')}"
        response = requester_client.post("/ai/answers", json={"question": token})

        assert_status(response, 200)
        body = assert_schema(response, AI_ANSWER_SCHEMA)
        assert body["grounded"] is False
        assert body["sources"] == []
        assert body["answer"].strip(), "an ungrounded answer must still explain itself"

    def test_matched_question_without_ai_configuration_returns_503(self, agent_client, requester_client):
        if settings.ai_enabled:
            pytest.skip("AI is enabled in this environment; the 503 path is not reachable")

        token = f"runbook{unique_suffix().replace('_', '')}"
        _publish_article_about(agent_client, token)

        response = requester_client.post("/ai/answers", json={"question": f"how do I fix {token}?"})

        assert_problem(
            response,
            status=503,
            title="AI service is not configured",
            detail_contains="AI chat is disabled",
        )

    def test_requester_may_use_the_assistant(self, requester_client):
        # a no-match token keeps this independent of whatever is in the knowledge base
        token = f"requester{unique_suffix().replace('_', '')}"
        response = requester_client.post("/ai/answers", json={"question": token})

        assert_status(response, 200)

    def test_agent_may_use_the_assistant(self, agent_client):
        token = f"agent{unique_suffix().replace('_', '')}"
        response = agent_client.post("/ai/answers", json={"question": token})

        assert_status(response, 200)
