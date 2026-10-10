import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Role } from "@/domain/task";
import { db } from "../db/client";
import { boardMember } from "../db/schema";
import { forbidden, notFound } from "../errors";

const uuid = z.uuid();

/** Non-UUID ids can't exist; treat them as not found instead of letting Postgres throw. */
export function assertUuid(id: string, what = "Board"): void {
  if (!uuid.safeParse(id).success) throw notFound(`${what} not found.`);
}

/**
 * Every board-scoped service starts here. Non-members get 404 (not 403) so a
 * board's existence isn't revealed; `role` additionally requires that role.
 */
export async function requireMember(userId: string, boardId: string, role?: Role): Promise<Role> {
  assertUuid(boardId);
  const [membership] = await db
    .select({ role: boardMember.role })
    .from(boardMember)
    .where(and(eq(boardMember.boardId, boardId), eq(boardMember.userId, userId)))
    .limit(1);
  if (!membership) throw notFound("Board not found.");
  if (role && membership.role !== role) throw forbidden("Only board owners can do that.");
  return membership.role;
}

export async function isMember(userId: string, boardId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: boardMember.userId })
    .from(boardMember)
    .where(and(eq(boardMember.boardId, boardId), eq(boardMember.userId, userId)))
    .limit(1);
  return Boolean(row);
}
