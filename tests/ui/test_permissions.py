"""Role-based navigation and route guards, verified in the browser."""

from __future__ import annotations

import pytest
from playwright.sync_api import expect

from utils.ui_locators import button, menuitem

pytestmark = [pytest.mark.ui, pytest.mark.regression]


class TestNavigationByRole:
    def test_requester_menu_excludes_admin_entries(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/dashboard")

        expect(menuitem(page, "我的工单")).to_be_visible()
        expect(menuitem(page, "AI 助手")).to_be_visible()
        expect(menuitem(page, "用户管理")).to_have_count(0)
        expect(menuitem(page, "新建知识文章")).to_have_count(0)

    def test_agent_menu_has_knowledge_authoring_but_no_user_admin(self, authenticated_page, agent_token):
        page = authenticated_page(agent_token, "/dashboard")

        expect(menuitem(page, "工单中心")).to_be_visible()
        expect(menuitem(page, "新建知识文章")).to_be_visible()
        expect(menuitem(page, "用户管理")).to_have_count(0)

    def test_admin_menu_contains_user_management(self, authenticated_page, admin_token):
        page = authenticated_page(admin_token, "/dashboard")

        expect(menuitem(page, "用户管理")).to_be_visible()


class TestRouteGuards:
    def test_requester_is_sent_to_forbidden_for_admin_routes(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/admin/users")

        page.wait_for_url("**/403")
        expect(page.get_by_text("没有权限")).to_be_visible()

    def test_requester_cannot_reach_the_article_editor(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/knowledge/new")

        page.wait_for_url("**/403")

    def test_agent_can_open_the_article_editor(self, authenticated_page, agent_token):
        page = authenticated_page(agent_token, "/knowledge/new")

        expect(page.get_by_placeholder("文章标题")).to_be_visible()

    def test_unknown_route_renders_the_not_found_page(self, ui_page):
        ui_page.goto("/this-route-does-not-exist")

        expect(ui_page.get_by_text("页面不存在")).to_be_visible()
