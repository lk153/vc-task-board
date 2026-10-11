import "server-only";
import { generateNKeysBetween } from "fractional-indexing";
import { and, asc, count, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { DEFAULT_STATUSES, LIMITS } from "@/config/board";
import { positionBetween, sortTasks } from "@/domain/ordering";
import { createStatusSchema, updateStatusSchema, type BoardStatus } from "@/domain/task";
import { db } from "../db/client";
import { boardStatus, task } from "../db/schema";
import { conflict, invalid, notFound } from "../errors";
import { assertUuid, requireMember } from "./access";

type StatusRow = typeof boardStatus.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function toStatus(row: StatusRow): BoardStatus {
  return {
    id: row.id,
    name: row.name,
    tone: row.tone,
    position: row.position,
    isDefault: row.isDefault,
  };
}

/** A board's columns, left to right. */
export async function listStatuses(boardId: string, tx: Tx | typeof db = db) {
  const rows = await tx
    .select()
    .from(boardStatus)
    .where(eq(boardStatus.boardId, boardId))
    .orderBy(asc(boardStatus.position), asc(boardStatus.id));
  return rows.map(toStatus);
}

/** The columns every new board starts with. */
export async function insertDefaultStatuses(tx: Tx | typeof db, boardId: string) {
  const positions = generateNKeysBetween(null, null, DEFAULT_STATUSES.length);
  await tx
    .insert(boardStatus)
    .values(DEFAULT_STATUSES.map((status, i) => ({ boardId, ...status, position: positions[i] })));
}

/** 422 unless `statusId` is a column on this board (used by the task services). */
export async function assertBoardStatus(
  boardId: string,
  statusId: string,
  tx: Tx | typeof db = db,
) {
  const [row] = await tx
    .select({ id: boardStatus.id })
    .from(boardStatus)
    .where(and(eq(boardStatus.id, statusId), eq(boardStatus.boardId, boardId)));
  if (!row) throw invalid("That status doesn't exist on this board. Refresh and try again.");
}

async function assertUniqueName(tx: Tx, boardId: string, name: string, exceptId?: string) {
  const [clash] = await tx
    .select({ id: boardStatus.id })
    .from(boardStatus)
    .where(
      and(
        eq(boardStatus.boardId, boardId),
        sql`lower(${boardStatus.name}) = lower(${name})`,
        exceptId ? ne(boardStatus.id, exceptId) : undefined,
      ),
    );
  if (clash) throw conflict(`There's already a status called “${name}”.`, "duplicate_status");
}

async function findStatus(tx: Tx, boardId: string, statusId: string) {
  assertUuid(statusId, "Status");
  const [row] = await tx
    .select()
    .from(boardStatus)
    .where(and(eq(boardStatus.id, statusId), eq(boardStatus.boardId, boardId)));
  if (!row) throw notFound("Status not found.");
  return row;
}

/** Owners add a column; it goes to the right of the others. */
export async function createStatus(userId: string, boardId: string, raw: unknown) {
  await requireMember(userId, boardId, "owner");
  const input = createStatusSchema.parse(raw);
  return db.transaction(async (tx) => {
    const existing = await listStatuses(boardId, tx);
    if (existing.length >= LIMITS.statuses) {
      throw invalid(`A board can have at most ${LIMITS.statuses} statuses.`);
    }
    await assertUniqueName(tx, boardId, input.name);
    const [row] = await tx
      .insert(boardStatus)
      .values({
        boardId,
        ...input,
        position: positionBetween(existing.at(-1)?.position ?? null, null),
      })
      .returning();
    return toStatus(row);
  });
}

/** Rename, recolor, move (`position`), or make it the column for new tasks. */
export async function updateStatus(
  userId: string,
  boardId: string,
  statusId: string,
  raw: unknown,
) {
  await requireMember(userId, boardId, "owner");
  const patch = updateStatusSchema.parse(raw);
  return db.transaction(async (tx) => {
    await findStatus(tx, boardId, statusId);
    if (patch.name) await assertUniqueName(tx, boardId, patch.name, statusId);
    if (patch.isDefault) {
      // Only one default per board (unique index), so clear the old one first.
      await tx
        .update(boardStatus)
        .set({ isDefault: false })
        .where(and(eq(boardStatus.boardId, boardId), eq(boardStatus.isDefault, true)));
    }
    const [row] = await tx
      .update(boardStatus)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(boardStatus.id, statusId))
      .returning();
    return toStatus(row);
  });
}

/**
 * Removes a column. Its tasks (including deleted ones, so Undo still works)
 * move to `moveTo`, appended in their current order. A board keeps at least
 * one status; if the default is removed, the destination (or the first
 * remaining column) becomes the default.
 */
export async function deleteStatus(
  userId: string,
  boardId: string,
  statusId: string,
  moveTo?: string | null,
) {
  await requireMember(userId, boardId, "owner");
  await db.transaction(async (tx) => {
    const target = await findStatus(tx, boardId, statusId);
    const statuses = await listStatuses(boardId, tx);
    if (statuses.length <= 1) {
      throw conflict("A board needs at least one status.", "last_status");
    }

    const [{ total }] = await tx
      .select({ total: count() })
      .from(task)
      .where(eq(task.statusId, statusId));
    let destination: BoardStatus | undefined;
    if (moveTo) {
      destination = statuses.find((s) => s.id === moveTo && s.id !== statusId);
      if (!destination) throw invalid("Choose another status for its tasks.");
    }
    if (total > 0 && !destination) {
      throw invalid("This status has tasks. Choose where to move them.");
    }

    if (destination && total > 0) {
      const tail = await tx
        .select({ id: task.id, position: task.position })
        .from(task)
        .where(and(eq(task.statusId, destination.id), isNull(task.deletedAt)));
      const moving = sortTasks(
        await tx
          .select({ id: task.id, position: task.position })
          .from(task)
          .where(and(eq(task.statusId, statusId), isNull(task.deletedAt))),
      );
      const last = sortTasks(tail).at(-1)?.position ?? null;
      const keys = generateNKeysBetween(last, null, moving.length);
      for (const [i, row] of moving.entries()) {
        await tx
          .update(task)
          .set({ statusId: destination.id, position: keys[i], updatedAt: new Date() })
          .where(eq(task.id, row.id));
      }
      await tx
        .update(task)
        .set({ statusId: destination.id })
        .where(and(eq(task.statusId, statusId), isNotNull(task.deletedAt)));
    }

    await tx.delete(boardStatus).where(eq(boardStatus.id, statusId));
    if (target.isDefault) {
      const next = destination ?? statuses.find((s) => s.id !== statusId)!;
      await tx.update(boardStatus).set({ isDefault: true }).where(eq(boardStatus.id, next.id));
    }
  });
}
