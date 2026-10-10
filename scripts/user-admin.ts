/**
 * Maintainer tools (the app sends no email, so these cover account recovery).
 *
 *   pnpm user:admin list
 *   pnpm user:admin set-password <email> [new-password]
 *   pnpm user:admin delete-user <email>
 *
 * Against Production: `vercel env pull --environment=production .env.production.local`
 * then prefix the command with that file's DATABASE_URL / BETTER_AUTH_SECRET.
 */
import { randomBytes } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db/client";
import { account, board, boardMember, user } from "@/server/db/schema";

async function findUser(email: string) {
  const [row] = await db.select().from(user).where(eq(user.email, email.trim().toLowerCase()));
  if (!row) throw new Error(`No account with email ${email}`);
  return row;
}

async function list() {
  const rows = await db
    .select({
      email: user.email,
      name: user.name,
      provider: account.providerId,
      createdAt: user.createdAt,
    })
    .from(user)
    .leftJoin(account, eq(account.userId, user.id))
    .orderBy(user.createdAt);
  console.table(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString().slice(0, 10) })));
}

/** Sets a (temporary) password and signs the user out everywhere. */
async function setPassword(email: string, password?: string) {
  const target = await findUser(email);
  const ctx = await auth.$context;
  const newPassword = password ?? randomBytes(9).toString("base64url");
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (newPassword.length < minPasswordLength || newPassword.length > maxPasswordLength) {
    throw new Error(`Password must be ${minPasswordLength}–${maxPasswordLength} characters.`);
  }
  const hash = await ctx.password.hash(newPassword);
  const accounts = await ctx.internalAdapter.findAccounts(target.id);
  if (accounts.some((a) => a.providerId === "credential")) {
    await ctx.internalAdapter.updatePassword(target.id, hash);
  } else {
    await ctx.internalAdapter.createAccount({
      userId: target.id,
      providerId: "credential",
      accountId: target.id,
      password: hash,
    });
  }
  await ctx.internalAdapter.deleteUserSessions(target.id);
  console.log(`Password for ${target.email} set to: ${newPassword}`);
  console.log("Share it privately; ask them to change it from the account menu after signing in.");
}

/** Deletes the account. Boards where they were the only owner are deleted too. */
async function deleteUser(email: string) {
  const target = await findUser(email);
  const owned = await db
    .select({ boardId: boardMember.boardId })
    .from(boardMember)
    .where(and(eq(boardMember.userId, target.id), eq(boardMember.role, "owner")));

  const orphaned: string[] = [];
  for (const { boardId } of owned) {
    const [{ owners }] = await db
      .select({ owners: count() })
      .from(boardMember)
      .where(and(eq(boardMember.boardId, boardId), eq(boardMember.role, "owner")));
    if (owners <= 1) orphaned.push(boardId);
  }
  if (orphaned.length) await db.delete(board).where(inArray(board.id, orphaned));
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUser(target.id);
  console.log(`Deleted ${target.email} and ${orphaned.length} board(s) they solely owned.`);
}

const [command, email, extra] = process.argv.slice(2);
const run = {
  list: () => list(),
  "set-password": () => setPassword(email, extra),
  "delete-user": () => deleteUser(email),
}[command ?? ""];

if (!run || (command !== "list" && !email)) {
  console.log(
    "Usage: pnpm user:admin list | set-password <email> [password] | delete-user <email>",
  );
  process.exit(1);
}

run()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
