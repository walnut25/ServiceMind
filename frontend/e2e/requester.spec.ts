import { test, expect } from "@playwright/test";

const REQUESTER_USER = process.env.E2E_REQUESTER_USERNAME || "requester";
const REQUESTER_PASS = process.env.E2E_REQUESTER_PASSWORD || "change-me";

test.describe("REQUESTER flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="username"]', REQUESTER_USER);
    await page.fill('input[id="password"]', REQUESTER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test("can create a ticket", async ({ page }) => {
    await page.goto("/tickets/new");
    await page.fill('input[id="title"]', "Playwright E2E test ticket");
    await page.fill('textarea[id="description"]', "Test ticket from Playwright.");
    await page.click('button[type="submit"]');
    await page.waitForURL(/tickets\/\d+/);
    await expect(page.locator("h1, h4")).toContainText(/#|Playwright/);
  });

  test("can view knowledge articles", async ({ page }) => {
    await page.goto("/knowledge");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, h4")).toContainText("知识库");
  });

  test("can access AI assistant", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.locator("h1, h4")).toContainText("AI 助手");
    const input = page.locator('textarea[placeholder="输入你的问题..."]');
    await expect(input).toBeVisible();
  });

  test("cannot access admin pages", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForURL(/403/);
    await expect(page.locator("body")).toContainText(/没有权限|Forbidden/);
  });
});
