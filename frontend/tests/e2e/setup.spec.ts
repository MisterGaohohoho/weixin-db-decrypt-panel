import { expect, test } from "@playwright/test";

test("clean checkout shows first-run setup instead of sample data", async ({ page }) => {
  await page.goto("/overview");

  await expect(page.getByRole("heading", { name: "本地数据尚未就绪" })).toBeVisible();
  await expect(page.getByText("数据库目录")).toBeVisible();
  await expect(page.getByText("解密报告", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新检查配置" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
});
