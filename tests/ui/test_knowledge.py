"""Knowledge base UI: authoring an article and searching it as a requester."""

from __future__ import annotations

import pytest
from playwright.sync_api import expect

from utils.data_factory import unique_suffix
from utils.ui_locators import button

pytestmark = pytest.mark.ui


class TestArticleAuthoring:
    def test_agent_publishes_an_article(self, authenticated_page, agent_token):
        page = authenticated_page(agent_token, "/knowledge/new")
        suffix = unique_suffix()
        title = f"VPN 连接排查 {suffix}"

        page.get_by_placeholder("文章标题").fill(title)
        page.get_by_placeholder("简短摘要").fill("常见 VPN 故障的排查步骤")
        page.get_by_placeholder("例如：网络、数据库").fill("网络")
        page.get_by_placeholder("Markdown 正文").fill("## 排查步骤\n\n1. 检查网络\n2. 重连")
        button(page, "保存并发布").click()

        expect(page.get_by_text("文章已保存并发布")).to_be_visible()

        # search instead of paging through the list, so this stays independent of
        # however many articles previous runs created
        page.goto(f"/knowledge?q={suffix}")
        expect(page.get_by_text(title)).to_be_visible()


class TestArticleReading:
    def test_requester_searches_a_published_article(self, authenticated_page, requester_token, article_factory):
        article = article_factory(publish=True)
        token = article["title"].split()[-1]

        page = authenticated_page(requester_token, f"/knowledge?q={token}")

        expect(page.get_by_text(article["title"])).to_be_visible()

    def test_requester_does_not_see_the_create_button(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/knowledge")

        expect(page.get_by_role("heading", name="知识库")).to_be_visible()
        expect(button(page, "新建文章")).to_have_count(0)

    def test_agent_sees_the_create_button(self, authenticated_page, agent_token):
        page = authenticated_page(agent_token, "/knowledge")

        expect(button(page, "新建文章")).to_be_visible()
