import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  use: { baseURL: "http://localhost:5184", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5184",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});

