import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse one pool per process (and across hot reloads in development).
const globalForDb = globalThis as unknown as { taskBoardPool?: Pool };

const pool =
  globalForDb.taskBoardPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5_000,
  });
globalForDb.taskBoardPool = pool;

// On Vercel Fluid compute, keeps the instance alive until idle connections close.
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
