import { test, expect } from "@playwright/test";

const AGENT_USER = process.env.E2E_AGENT_USERNAME || "agent";
const AGENT_PASS = process.env.E2E_AGENT_PASSWORD || "change-me";

test.describe("AGENT flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="username"]', AGENT_USER);
    await page.fill('input[id="password"]', AGENT_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test("can view ticket center", async ({ page }) => {
    await page.goto("/tickets");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, h4")).toContainText(/工单/);
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
