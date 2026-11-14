"""AI assistant UI: grounded/unavailable states without calling a real model."""

from __future__ import annotations

import pytest
from playwright.sync_api import expect

from config.settings import settings
from utils.data_factory import unique_suffix
from utils.ui_locators import button

pytestmark = [pytest.mark.ui, pytest.mark.regression]


def _ask(page, question: str) -> None:
    page.get_by_placeholder("输入你的问题...").fill(question)
    button(page, "发送").click()


class TestAssistant:
    def test_unmatched_question_offers_a_ticket_escape_hatch(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/assistant")
        expect(page.get_by_role("heading", name="ServiceMind AI 助手")).to_be_visible()

        _ask(page, f"unknown topic {unique_suffix().replace('_', '')}")

        expect(page.get_by_text("知识库中没有找到足够信息")).to_be_visible()
        expect(button(page, "创建工单")).to_be_visible()

    def test_matched_question_without_ai_shows_the_disabled_notice(
        self, authenticated_page, requester_token, agent_client
    ):
        if settings.ai_enabled:
            pytest.skip("AI is enabled here; the disabled notice is unreachable")

        token = f"runbook{unique_suffix().replace('_', '')}"
        article = agent_client.post(
            "/knowledge/articles",
            json={
                "title": f"Playbook {token}",
                "summary": f"How to handle {token}",
                "content": f"# {token}\n\nSteps for {token}.",
                "category": "qa-ai",
            },
        ).json()
        agent_client.post(f"/knowledge/articles/{article['id']}/publish")

        page = authenticated_page(requester_token, "/assistant")
        _ask(page, f"how do I fix {token}?")

        expect(page.get_by_text("AI 服务当前未启用")).to_be_visible()
        expect(button(page, "提交工单")).to_be_visible()

    def test_assistant_accepts_a_question_typed_with_enter(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/assistant")
        input_box = page.get_by_placeholder("输入你的问题...")

        input_box.fill(f"enter key {unique_suffix().replace('_', '')}")
        input_box.press("Enter")

        expect(button(page, "发送")).to_be_visible()
