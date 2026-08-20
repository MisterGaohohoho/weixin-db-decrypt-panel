import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error") throw new Error(`Browser console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    throw error;
  });
});

const routes = [
  ["/overview", "概览"],
  ["/contacts", "联系人"],
  ["/media", "媒体"],
  ["/contributions", "贡献"],
  ["/conversations", "会话"],
  ["/chat-list", "会话列表"],
  ["/search", "搜索"],
  ["/settings", "设置"],
] as const;

for (const [route, activeLabel] of routes) {
  test(`${route} renders the shared shell and active navigation`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("button", { name: "返回概览" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
    await expect(page.getByRole("link", { name: activeLabel, exact: true })).toHaveClass(/active/);
    await expect(page.locator("main.main-content")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test("global search submits a deep link", async ({ page }) => {
  await page.goto("/overview");
  const input = page.getByRole("textbox", { name: "搜索联系人、会话或内容" });
  await input.fill("本地 测试");
  await page.getByRole("button", { name: "开始搜索" }).click();
  await expect(page).toHaveURL(/\/search\?q=%E6%9C%AC%E5%9C%B0%20%E6%B5%8B%E8%AF%95$/);
});

test("episode click loads complete message context", async ({ page, request }) => {
  const listing = await request.get("/api/conversations?limit=1");
  const payload = await listing.json() as { items?: unknown[] };
  test.skip(!payload.items?.length, "snapshot contains no conversation episodes");

  await page.goto("/conversations");
  const firstEpisode = page.locator("button.episode-row").first();
  await expect(firstEpisode).toBeVisible();
  await firstEpisode.click();
  const drawer = page.getByRole("dialog", { name: "完整会话上下文" });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(".drawer-messages article").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("hour heat strip updates the URL and API filter", async ({ page, request }) => {
  const response = await request.get("/api/conversations?limit=1");
  const payload = await response.json() as { hourly?: Array<{ hour: number; count: number }> };
  const peak = [...(payload.hourly ?? [])].sort((left, right) => right.count - left.count)[0];
  test.skip(!peak || peak.count === 0, "snapshot contains no hourly message data");

  await page.goto("/conversations");
  const button = page.getByRole("button", { name: new RegExp(`^筛选 ${peak.hour} 时，`) });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page).toHaveURL(new RegExp(`(?:\\?|&)hour=${peak.hour}(?:&|$)`));
  await expect(button).toHaveClass(/active/);
});

test("chat list renders snapshot sessions and mobile navigation", async ({ page, request }) => {
  const response = await request.get("/api/chat-list?limit=1");
  const payload = await response.json() as { items?: unknown[] };
  test.skip(!payload.items?.length, "snapshot contains no chat sessions");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/chat-list");
  const firstSession = page.getByRole("listbox", { name: "真实会话列表" }).getByRole("option").first();
  await expect(firstSession).toBeVisible();
  await firstSession.click();
  await expect(page.locator(".chat-list-workspace")).toHaveClass(/mobile-chat-open/);
  await page.getByRole("button", { name: "返回会话列表" }).click();
  await expect(page.locator(".chat-list-workspace")).not.toHaveClass(/mobile-chat-open/);
});

test("mobile navigation keeps search reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/overview");

  const searchLink = page.getByRole("link", { name: "搜索", exact: true });
  await expect(searchLink).toBeVisible();
  await searchLink.click();
  await expect(page).toHaveURL(/\/search$/);
});

for (const width of [1024, 768, 375]) {
  test(`overview has no page-level horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/overview");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
