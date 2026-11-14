"""Login UI: real browser flow, error states and the post-login landing page."""

from __future__ import annotations

import pytest
from playwright.sync_api import expect

from fixtures.ui_fixtures import ui_login
from utils.ui_locators import button, menuitem

pytestmark = pytest.mark.ui


class TestLoginPage:
    def test_valid_credentials_land_on_the_dashboard(self, ui_page, admin_user):
        ui_login(ui_page, admin_user.username, admin_user.password)

        expect(menuitem(ui_page, "工作台")).to_be_visible()
        expect(menuitem(ui_page, "用户管理")).to_be_visible()

    def test_wrong_password_shows_an_inline_error(self, ui_page, admin_user):
        ui_page.goto("/login")
        ui_page.get_by_placeholder("用户名").fill(admin_user.username)
        ui_page.get_by_placeholder("密码").fill("wrong-password")
        button(ui_page, "登录").click()

        expect(ui_page.get_by_text("用户名或密码错误")).to_be_visible()
        assert "/login" in ui_page.url, "a failed login must stay on the login page"

    def test_empty_form_shows_validation_messages(self, ui_page):
        ui_page.goto("/login")
        button(ui_page, "登录").click()

        expect(ui_page.get_by_text("请输入用户名")).to_be_visible()
        expect(ui_page.get_by_text("请输入密码")).to_be_visible()

    def test_protected_route_redirects_to_login(self, ui_page):
        ui_page.goto("/tickets")

        ui_page.wait_for_url("**/login**")
        assert "redirect" in ui_page.url, "the original destination should be preserved"

    def test_logout_returns_to_login(self, authenticated_page, admin_token):
        page = authenticated_page(admin_token, "/dashboard")

        button(page, "admin").click()
        page.get_by_text("退出登录").click()

        page.wait_for_url("**/login*")
        expect(button(page, "登录")).to_be_visible()
