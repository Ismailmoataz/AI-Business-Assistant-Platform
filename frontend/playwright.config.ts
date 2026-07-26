import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.E2E_APP_PORT ?? 3100);
const apiPort = Number(process.env.E2E_API_PORT ?? 3101);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${appPort}`;
const mockApiURL = process.env.E2E_MOCK_API_URL ?? `http://127.0.0.1:${apiPort}`;
const inCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 2 : 0,
  workers: inCI ? 4 : 2,
  timeout: 75_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results",
  reporter: inCI
    ? [["line"], ["html", { open: "never" }], ["junit", { outputFile: "test-results/junit.xml" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    locale: "en-US",
    timezoneId: "Africa/Cairo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: process.env.E2E_MOCK_SERVER_COMMAND ?? "node e2e/support/mock-api.cjs",
      url: `${mockApiURL}/__e2e/health`,
      env: { E2E_API_PORT: String(apiPort) },
      reuseExistingServer: !inCI,
      timeout: 30_000,
    },
    {
      command: process.env.E2E_WEB_SERVER_COMMAND ?? `npm run dev -- --hostname 127.0.0.1 --port ${appPort}`,
      url: baseURL,
      env: { NEXT_PUBLIC_API_URL: mockApiURL },
      reuseExistingServer: !inCI,
      timeout: 240_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-smoke",
      grep: /@cross-browser/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-smoke",
      grep: /@cross-browser/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chromium",
      grep: /@mobile/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
