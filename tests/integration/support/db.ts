import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "@/server/db/schema";

const migrationsFolder = fileURLToPath(
  new URL("../../../src/server/db/migrations", import.meta.url),
);

/** In-process Postgres with the real migrations applied. */
export async function createTestDb() {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

export async function resetDb(db: TestDb) {
  await db.execute(
    sql`truncate table "task", "board_invite", "board_member", "board", "session", "account", "verification", "rate_limit", "user" cascade`,
  );
}
