import { test, expect } from "@playwright/test";

const ADMIN_USER = process.env.E2E_ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || "change-me";

test.describe("ADMIN flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="username"]', ADMIN_USER);
    await page.fill('input[id="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test("can view user management page", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, h4")).toContainText("用户管理");
  });

  test("can open create user modal", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await page.click("text=创建用户");
    await expect(page.locator(".ant-modal")).toBeVisible();
  });

  test("sees admin navigation items", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).toContainText("用户管理");
  });
});
