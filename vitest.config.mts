import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // `server-only` throws outside React Server Components; tests import server code directly.
      "server-only": fromRoot("./tests/support/empty.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./tests/support/setup-dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./tests/integration/setup.ts"],
          env: { BETTER_AUTH_SECRET: "integration-tests-only-secret-0123456789" },
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
