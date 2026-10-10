import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { INVITE_TTL_DAYS } from "@/config/board";
import { inviteSchema, type Invite } from "@/domain/task";
import { db } from "../db/client";
import { board, boardInvite, boardMember, user } from "../db/schema";
import { conflict, forbidden, gone, notFound } from "../errors";
import { assertUuid, requireMember } from "./access";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const INVALID_LINK =
  "This invite link isn't valid. It may have been cancelled — ask the board owner for a new one.";

const newToken = () => randomBytes(32).toString("base64url");

/** "alex@company.com" → "a•••@company.com" — enough to recognise, not to harvest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain ?? ""}`;
}

/**
 * Creates (or renews) the pending invite for an email. The owner copies the
 * returned link and sends it themselves — the app sends no email.
 */
export async function createInvite(userId: string, boardId: string, raw: unknown): Promise<Invite> {
  await requireMember(userId, boardId, "owner");
  const { email } = inviteSchema.parse(raw);

  const [existing] = await db
    .select({ userId: user.id })
    .from(boardMember)
    .innerJoin(user, eq(user.id, boardMember.userId))
    .where(and(eq(boardMember.boardId, boardId), sql`lower(${user.email}) = ${email}`));
  if (existing) throw conflict("That person is already a member of this board.", "already_member");

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS);
  const created = await db.transaction(async (tx) => {
    // One pending invite per email: inviting again replaces the old link.
    await tx
      .delete(boardInvite)
      .where(
        and(
          eq(boardInvite.boardId, boardId),
          eq(boardInvite.email, email),
          isNull(boardInvite.acceptedAt),
        ),
      );
    const [row] = await tx
      .insert(boardInvite)
      .values({ boardId, email, token: newToken(), invitedBy: userId, expiresAt })
      .returning();
    return row;
  });

  const [inviter] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  return {
    id: created.id,
    email: created.email,
    token: created.token,
    invitedByName: inviter?.name ?? "",
    createdAt: created.createdAt.toISOString(),
    expiresAt: created.expiresAt.toISOString(),
  };
}

export async function cancelInvite(userId: string, boardId: string, inviteId: string) {
  await requireMember(userId, boardId, "owner");
  assertUuid(inviteId, "Invite");
  const deleted = await db
    .delete(boardInvite)
    .where(
      and(
        eq(boardInvite.id, inviteId),
        eq(boardInvite.boardId, boardId),
        isNull(boardInvite.acceptedAt),
      ),
    )
    .returning({ id: boardInvite.id });
  if (deleted.length === 0) throw notFound("Invite not found.");
}

export type InviteLookup =
  | { status: "not_found" }
  | {
      status: "valid" | "expired" | "used";
      boardId: string;
      boardName: string;
      inviterName: string | null;
      email: string;
      acceptedBy: string | null;
    };

/** For the invite page: what the link points at, without accepting it. */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!TOKEN_PATTERN.test(token)) return { status: "not_found" };
  const [row] = await db
    .select({
      boardId: boardInvite.boardId,
      boardName: board.name,
      inviterName: user.name,
      email: boardInvite.email,
      expiresAt: boardInvite.expiresAt,
      acceptedAt: boardInvite.acceptedAt,
      acceptedBy: boardInvite.acceptedBy,
    })
    .from(boardInvite)
    .innerJoin(board, eq(board.id, boardInvite.boardId))
    .leftJoin(user, eq(user.id, boardInvite.invitedBy))
    .where(eq(boardInvite.token, token));
  if (!row) return { status: "not_found" };
  const status = row.acceptedAt ? "used" : row.expiresAt <= new Date() ? "expired" : "valid";
  return {
    status,
    boardId: row.boardId,
    boardName: row.boardName,
    inviterName: row.inviterName,
    email: row.email,
    acceptedBy: row.acceptedBy,
  };
}

/**
 * Joining needs both the secret link and a signed-in account with the invited
 * email, so a forwarded link alone isn't enough.
 */
export async function acceptInvite(
  account: { id: string; email: string },
  token: string,
): Promise<{ boardId: string }> {
  if (!TOKEN_PATTERN.test(token)) throw notFound(INVALID_LINK);

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(boardInvite)
      .where(eq(boardInvite.token, token))
      .for("update");
    if (!invite) throw notFound(INVALID_LINK);

    if (invite.acceptedAt) {
      if (invite.acceptedBy === account.id) return { boardId: invite.boardId };
      throw gone("This invite link has already been used.", "invite_used");
    }
    if (invite.expiresAt <= new Date()) {
      throw gone(
        "This invite link has expired. Ask the board owner for a new one.",
        "invite_expired",
      );
    }
    if (account.email.toLowerCase() !== invite.email) {
      throw forbidden(
        `This invite is for ${maskEmail(invite.email)}. Sign in with that email to join.`,
        "wrong_account",
      );
    }

    await tx
      .insert(boardMember)
      .values({ boardId: invite.boardId, userId: account.id, role: "member" })
      .onConflictDoNothing();
    await tx
      .update(boardInvite)
      .set({ acceptedAt: new Date(), acceptedBy: account.id })
      .where(eq(boardInvite.id, invite.id));
    return { boardId: invite.boardId };
  });
}
