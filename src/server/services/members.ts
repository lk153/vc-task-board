import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "../db/client";
import { boardMember } from "../db/schema";
import { conflict, forbidden, notFound } from "../errors";
import { requireMember } from "./access";

/**
 * Owners can remove anyone; members can only remove themselves (leave).
 * A board always keeps at least one owner. The person stays on the board's
 * assignee list (with their tasks) until an owner removes them there.
 */
export async function removeMember(userId: string, boardId: string, targetUserId: string) {
  const role = await requireMember(userId, boardId);
  const leaving = targetUserId === userId;
  if (!leaving && role !== "owner") throw forbidden("Only board owners can remove members.");

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ role: boardMember.role })
      .from(boardMember)
      .where(and(eq(boardMember.boardId, boardId), eq(boardMember.userId, targetUserId)));
    if (!target) throw notFound("Member not found.");

    if (target.role === "owner") {
      const [{ owners }] = await tx
        .select({ owners: count() })
        .from(boardMember)
        .where(and(eq(boardMember.boardId, boardId), eq(boardMember.role, "owner")));
      if (owners <= 1) {
        throw conflict("A board needs at least one owner. Delete the board instead.", "last_owner");
      }
    }

    await tx
      .delete(boardMember)
      .where(and(eq(boardMember.boardId, boardId), eq(boardMember.userId, targetUserId)));
  });
}
