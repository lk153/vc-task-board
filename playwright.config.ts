import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/taskboard_e2e";

// Shared with global-setup.ts (it migrates and empties this database).
process.env.E2E_DATABASE_URL = E2E_DATABASE_URL;

/**
 * End-to-end tests against a production build (`next start`) and a dedicated
 * database. Locally: `pnpm db:up && pnpm test:e2e`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Animations off, so checks (e.g. color contrast) never run mid-transition.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    // CI builds in an earlier step; locally build first so tests run the current code.
    command: process.env.CI
      ? `pnpm start --port ${PORT}`
      : `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? "e2e-only-secret-not-for-production-use",
    },
  },
});
