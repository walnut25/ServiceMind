import { test, expect } from "@playwright/test";

const AGENT_USER = process.env.E2E_AGENT_USERNAME || "e2e-agent";
const AGENT_PASS = process.env.E2E_AGENT_PASSWORD || "E2eAgentPass123!";

test.describe("AGENT flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("用户名").fill(AGENT_USER);
    await page.getByPlaceholder("密码").fill(AGENT_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test("can view ticket center", async ({ page }) => {
    await page.goto("/tickets");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, h4")).toContainText(/工单/);
  });

  test("can open the assignment picker", async ({ page }) => {
    await page.goto("/tickets/new");
    await page.getByPlaceholder("简要描述问题").fill("Agent assignment E2E ticket");
    await page
      .getByPlaceholder("详细描述问题，包括复现步骤、环境信息等")
      .fill("Verify that an agent can load assignable users without a forbidden response.");
    await page.getByRole("button", { name: "提交工单" }).click();

    await page.waitForURL(/\/tickets\/\d+/);
    await page.getByRole("button", { name: "分配负责人" }).click();
    const assignmentDialog = page.getByRole("dialog", { name: "分配负责人" });
    const assigneeSelect = assignmentDialog.getByRole("combobox");
    await expect(assigneeSelect).toBeVisible();
    await assigneeSelect.click();
    await expect(page.getByText(`${AGENT_USER} (AGENT)`, { exact: true })).toBeVisible();
  });

  test("can access knowledge management", async ({ page }) => {
    await page.goto("/knowledge/new");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, h4")).toContainText(/新建|编辑/);
  });

  test("cannot access user management", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForURL(/403/);
    await expect(page.locator("body")).toContainText(/没有权限|Forbidden/);
  });
});
