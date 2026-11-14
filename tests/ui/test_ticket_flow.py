"""End-to-end ticket journey through the browser: create, assign, transition, comment."""

from __future__ import annotations

import pytest
from playwright.sync_api import expect

from utils.ui_locators import button, tag

pytestmark = pytest.mark.ui


class TestCreateTicket:
    def test_requester_creates_a_ticket_from_the_form(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/tickets/new")
        title = "打印机无法连接"

        page.get_by_placeholder("简要描述问题").fill(title)
        page.get_by_placeholder("详细描述问题，包括复现步骤、环境信息等").fill("三层打印机离线，重启无效。")
        button(page, "提交工单").click()

        page.wait_for_url("**/tickets/*")
        expect(page.get_by_role("heading", name=title)).to_be_visible()
        expect(tag(page, "待处理")).to_be_visible()

    def test_empty_form_is_blocked_by_client_validation(self, authenticated_page, requester_token):
        page = authenticated_page(requester_token, "/tickets/new")

        button(page, "提交工单").click()

        expect(page.get_by_text("请输入工单标题")).to_be_visible()
        expect(page.get_by_text("请输入工单描述")).to_be_visible()
        assert "/tickets/new" in page.url


class TestTicketDetailAsRequester:
    def test_requester_has_no_workflow_buttons(self, authenticated_page, requester_token, ticket):
        page = authenticated_page(requester_token, f"/tickets/{ticket['id']}")

        expect(page.get_by_role("heading", name=ticket["title"])).to_be_visible()
        expect(button(page, "开始处理")).to_have_count(0)
        expect(button(page, "关闭工单")).to_have_count(0)
        # but commenting is allowed
        expect(page.get_by_placeholder("输入评论...")).to_be_visible()


class TestTicketWorkflowAsAgent:
    def test_agent_moves_ticket_from_open_to_closed(self, authenticated_page, agent_token, ticket):
        page = authenticated_page(agent_token, f"/tickets/{ticket['id']}")
        expect(tag(page, "待处理")).to_be_visible()

        button(page, "开始处理").click()
        expect(tag(page, "处理中")).to_be_visible()

        button(page, "关闭工单").click()
        button(page, "确定关闭").click()

        expect(tag(page, "已关闭")).to_be_visible()
        expect(page.get_by_text("工单已关闭，无可用操作")).to_be_visible()

    def test_agent_can_assign_the_ticket_to_themselves(self, authenticated_page, agent_token, ticket, staff_accounts):
        page = authenticated_page(agent_token, f"/tickets/{ticket['id']}")

        button(page, "分配负责人").click()
        dialog = page.get_by_role("dialog", name="分配负责人")
        expect(dialog).to_be_visible()
        dialog.get_by_role("combobox").click()

        # the candidate list is long and virtualised, so choose a rendered option
        options = page.locator(".ant-select-dropdown:visible .ant-select-item-option")
        expect(options.first).to_be_visible()
        labels = [options.nth(index).inner_text() for index in range(options.count())]
        chosen = next(
            (label for label in labels if label.startswith(staff_accounts["agent"].username)),
            labels[0],
        )
        expected_username = chosen.split(" (")[0]
        options.filter(has_text=chosen).first.click()

        expect(dialog).to_be_hidden()
        owner = page.locator(".ant-descriptions-item", has_text="负责人")
        expect(owner.get_by_text(expected_username)).to_be_visible()

    def test_agent_can_comment_on_a_ticket(self, authenticated_page, agent_token, ticket):
        page = authenticated_page(agent_token, f"/tickets/{ticket['id']}")

        page.get_by_placeholder("输入评论...").fill("已联系用户，等待现场确认。")
        button(page, "发送").click()

        expect(page.get_by_text("已联系用户，等待现场确认。")).to_be_visible()


class TestTicketList:
    def test_created_ticket_appears_in_the_list(self, authenticated_page, requester_token, ticket):
        page = authenticated_page(requester_token, "/tickets")

        expect(page.get_by_role("heading", name="工单中心")).to_be_visible()
        expect(page.get_by_text(ticket["title"])).to_be_visible()

    def test_filter_by_status_updates_the_url(self, authenticated_page, agent_token):
        page = authenticated_page(agent_token, "/tickets")

        page.locator(".ant-select").first.click()
        page.locator(".ant-select-dropdown").get_by_text("处理中").first.click()

        page.wait_for_url("**status=IN_PROGRESS**")
