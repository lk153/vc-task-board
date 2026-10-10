import { execSync } from "node:child_process";
import { Client } from "pg";

/** Bring the e2e database to the latest migration and empty it. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL!;
  execSync("pnpm db:migrate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: "" },
  });

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(
    `truncate table "task", "board_invite", "board_member", "board", "session", "account", "verification", "rate_limit", "user" cascade`,
  );
  await client.end();
}
