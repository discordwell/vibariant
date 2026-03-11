import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: {
      width: 1440,
      height: 1800,
    },
  },
  webServer: {
    command: "npm run dev",
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:3000",
  },
});
