import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { bulkMoveSchema, createTaskSchema, updateTaskSchema, type Task } from "@/domain/task";
import { planBulkMove, positionBetween } from "@/domain/ordering";
import { db } from "../db/client";
import { task } from "../db/schema";
import { conflict, notFound } from "../errors";
import { assertUuid, requireMember } from "./access";
import { assertBoardPerson } from "./people";
import { assertBoardStatus } from "./statuses";
import { assertBoardTaskType } from "./task-types";

type TaskRow = typeof task.$inferSelect;

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    description: row.description,
    statusId: row.statusId,
    priority: row.priority,
    typeId: row.typeId,
    assigneeId: row.assigneeId,
    points: row.points,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Key that places a card after the last live card in a column. */
async function endOfColumn(boardId: string, statusId: string): Promise<string> {
  const [last] = await db
    .select({ position: task.position })
    .from(task)
    .where(and(eq(task.boardId, boardId), eq(task.statusId, statusId), isNull(task.deletedAt)))
    .orderBy(desc(task.position))
    .limit(1);
  return positionBetween(last?.position ?? null, null);
}

/** The status, task type and assignee must all belong to this board. */
async function assertBoardRefs(
  boardId: string,
  refs: { statusId?: string; typeId?: string | null; assigneeId?: string | null },
) {
  if (refs.statusId) await assertBoardStatus(boardId, refs.statusId);
  if (refs.typeId) await assertBoardTaskType(boardId, refs.typeId);
  if (refs.assigneeId) await assertBoardPerson(boardId, refs.assigneeId);
}

async function findTask(boardId: string, taskId: string, { deleted = false } = {}) {
  assertUuid(taskId, "Task");
  const [row] = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.id, taskId),
        eq(task.boardId, boardId),
        deleted ? isNotNull(task.deletedAt) : isNull(task.deletedAt),
      ),
    );
  if (!row) throw notFound("Task not found.");
  return row;
}

export async function createTask(userId: string, boardId: string, raw: unknown): Promise<Task> {
  await requireMember(userId, boardId);
  const input = createTaskSchema.parse(raw);
  await assertBoardRefs(boardId, input);

  const [row] = await db
    .insert(task)
    .values({
      ...input,
      boardId,
      position: await endOfColumn(boardId, input.statusId),
      createdBy: userId,
    })
    .onConflictDoNothing({ target: task.id })
    .returning();
  if (!row) throw conflict("A task with this id already exists.");
  return toTask(row);
}

/** Updates fields and/or moves the task (`statusId` + `position`). */
export async function updateTask(
  userId: string,
  boardId: string,
  taskId: string,
  raw: unknown,
): Promise<Task> {
  await requireMember(userId, boardId);
  const patch = updateTaskSchema.parse(raw);
  const current = await findTask(boardId, taskId);
  await assertBoardRefs(boardId, patch);

  // Changing column without an explicit position appends to the new column.
  const position =
    patch.position ??
    (patch.statusId && patch.statusId !== current.statusId
      ? await endOfColumn(boardId, patch.statusId)
      : undefined);

  const [row] = await db
    .update(task)
    .set({ ...patch, ...(position ? { position } : {}), updatedAt: new Date() })
    .where(and(eq(task.id, taskId), eq(task.boardId, boardId)))
    .returning();
  return toTask(row);
}

export async function deleteTask(userId: string, boardId: string, taskId: string): Promise<void> {
  await requireMember(userId, boardId);
  await findTask(boardId, taskId);
  await db
    .update(task)
    .set({ deletedAt: new Date() })
    .where(and(eq(task.id, taskId), eq(task.boardId, boardId)));
}

/** Undo a delete. The task returns to its original column and position. */
export async function restoreTask(userId: string, boardId: string, taskId: string): Promise<Task> {
  await requireMember(userId, boardId);
  await findTask(boardId, taskId, { deleted: true });
  const [row] = await db
    .update(task)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(task.id, taskId), eq(task.boardId, boardId)))
    .returning();
  return toTask(row);
}

/**
 * Bulk status change: moves several tasks at once (one transaction). Without
 * a position a task goes to the end of its new column, in the order given;
 * with one (Undo) it goes exactly there. Ids that aren't live tasks on this
 * board are skipped. Returns the tasks that changed.
 */
export async function bulkMoveTasks(
  userId: string,
  boardId: string,
  raw: unknown,
): Promise<Task[]> {
  await requireMember(userId, boardId);
  const { tasks: moves } = bulkMoveSchema.parse(raw);

  return db.transaction(async (tx) => {
    for (const statusId of new Set(moves.map((m) => m.statusId))) {
      await assertBoardStatus(boardId, statusId, tx);
    }
    // Lock the moved rows so concurrent edits can't interleave.
    await tx
      .select({ id: task.id })
      .from(task)
      .where(
        and(
          eq(task.boardId, boardId),
          inArray(
            task.id,
            moves.map((m) => m.id),
          ),
        ),
      )
      .for("update");
    const live = await tx
      .select({ id: task.id, statusId: task.statusId, position: task.position })
      .from(task)
      .where(and(eq(task.boardId, boardId), isNull(task.deletedAt)));

    const updated: Task[] = [];
    const now = new Date();
    for (const move of planBulkMove(live, moves)) {
      const [row] = await tx
        .update(task)
        .set({ statusId: move.statusId, position: move.position, updatedAt: now })
        .where(and(eq(task.id, move.id), eq(task.boardId, boardId)))
        .returning();
      updated.push(toTask(row));
    }
    return updated;
  });
}
