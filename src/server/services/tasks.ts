import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { createTaskSchema, updateTaskSchema, type Status, type Task } from "@/domain/task";
import { positionBetween } from "@/domain/ordering";
import { db } from "../db/client";
import { task } from "../db/schema";
import { conflict, invalid, notFound } from "../errors";
import { assertUuid, isMember, requireMember } from "./access";

type TaskRow = typeof task.$inferSelect;

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    type: row.type,
    assigneeId: row.assigneeId,
    points: row.points,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Key that places a card after the last live card in a column. */
async function endOfColumn(boardId: string, status: Status): Promise<string> {
  const [last] = await db
    .select({ position: task.position })
    .from(task)
    .where(and(eq(task.boardId, boardId), eq(task.status, status), isNull(task.deletedAt)))
    .orderBy(desc(task.position))
    .limit(1);
  return positionBetween(last?.position ?? null, null);
}

async function assertAssignable(boardId: string, assigneeId: string | null | undefined) {
  if (assigneeId && !(await isMember(assigneeId, boardId))) {
    throw invalid("The assignee must be a member of this board.");
  }
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
  await assertAssignable(boardId, input.assigneeId);

  const [row] = await db
    .insert(task)
    .values({
      ...input,
      boardId,
      position: await endOfColumn(boardId, input.status),
      createdBy: userId,
    })
    .onConflictDoNothing({ target: task.id })
    .returning();
  if (!row) throw conflict("A task with this id already exists.");
  return toTask(row);
}

/** Updates fields and/or moves the task (`status` + `position`). */
export async function updateTask(
  userId: string,
  boardId: string,
  taskId: string,
  raw: unknown,
): Promise<Task> {
  await requireMember(userId, boardId);
  const patch = updateTaskSchema.parse(raw);
  const current = await findTask(boardId, taskId);
  if (patch.assigneeId !== undefined) await assertAssignable(boardId, patch.assigneeId);

  // Changing column without an explicit position appends to the new column.
  const position =
    patch.position ??
    (patch.status && patch.status !== current.status
      ? await endOfColumn(boardId, patch.status)
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
  const current = await findTask(boardId, taskId, { deleted: true });
  // The assignee may have left the board in the meantime.
  const assigneeId =
    current.assigneeId && (await isMember(current.assigneeId, boardId)) ? current.assigneeId : null;
  const [row] = await db
    .update(task)
    .set({ deletedAt: null, assigneeId, updatedAt: new Date() })
    .where(and(eq(task.id, taskId), eq(task.boardId, boardId)))
    .returning();
  return toTask(row);
}
