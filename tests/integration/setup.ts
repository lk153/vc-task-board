import { beforeEach, vi } from "vitest";

// Services import `db` from the real client; swap it for PGlite in every test file.
vi.mock("@/server/db/client", async () => {
  const { createTestDb } = await import("./support/db");
  return { db: await createTestDb() };
});

beforeEach(async () => {
  const { db } = await import("@/server/db/client");
  const { resetDb } = await import("./support/db");
  await resetDb(db as never);
});
