import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const panelRoot = path.resolve(frontendRoot, "..");
const python = process.env.PLAYWRIGHT_PYTHON ?? "python";
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "8765";
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "5173";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests",
  outputDir: path.join(panelRoot, "artifacts", "test-results"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: path.join(panelRoot, "artifacts", "playwright"), open: "never" }]],
  use: {
    baseURL: webUrl,
    colorScheme: "light",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  expect: { timeout: 10_000 },
  timeout: 60_000,
  projects: [
    {
      name: "chromium-e2e",
      testMatch: /e2e\/routes\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1448, height: 1086 } },
    },
    {
      name: "chromium-setup",
      testMatch: /e2e\/setup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1448, height: 1086 } },
    },
  ],
  webServer: [
    {
      command: `${python} -m uvicorn backend.app.main:app --host 127.0.0.1 --port ${apiPort}`,
      cwd: panelRoot,
      url: `${apiUrl}/api/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      cwd: frontendRoot,
      url: `${webUrl}/overview`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { ...process.env, VITE_API_PROXY: apiUrl },
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
