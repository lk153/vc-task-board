import "server-only";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { DEFAULT_TASK_TYPES, LIMITS } from "@/config/board";
import {
  createTaskTypeSchema,
  sortByName,
  typeIdSchema,
  updateTaskTypeSchema,
  type BoardTaskType,
} from "@/domain/task";
import { db, type Executor, type Tx } from "../db/client";
import { boardTaskType, task } from "../db/schema";
import { conflict, invalid, notFound } from "../errors";
import { assertUuid, requireMember } from "./access";

type TaskTypeRow = typeof boardTaskType.$inferSelect;

export function toTaskType(row: TaskTypeRow): BoardTaskType {
  return { id: row.id, name: row.name, tone: row.tone, isDefault: row.isDefault };
}

/** A board's task types, by name. */
export async function listTaskTypes(boardId: string, tx: Executor = db) {
  const rows = await tx.select().from(boardTaskType).where(eq(boardTaskType.boardId, boardId));
  return sortByName(rows.map(toTaskType));
}

/** The task types every new board starts with. */
export async function insertDefaultTaskTypes(tx: Executor, boardId: string) {
  await tx.insert(boardTaskType).values(DEFAULT_TASK_TYPES.map((type) => ({ boardId, ...type })));
}

/** 422 unless `typeId` is a task type on this board (used by the task services). */
export async function assertBoardTaskType(boardId: string, typeId: string, tx: Executor = db) {
  const [row] = await tx
    .select({ id: boardTaskType.id })
    .from(boardTaskType)
    .where(and(eq(boardTaskType.id, typeId), eq(boardTaskType.boardId, boardId)));
  if (!row) throw invalid("That task type doesn't exist on this board. Refresh and try again.");
}

async function assertUniqueName(tx: Tx, boardId: string, name: string, exceptId?: string) {
  const [clash] = await tx
    .select({ id: boardTaskType.id })
    .from(boardTaskType)
    .where(
      and(
        eq(boardTaskType.boardId, boardId),
        sql`lower(${boardTaskType.name}) = lower(${name})`,
        exceptId ? ne(boardTaskType.id, exceptId) : undefined,
      ),
    );
  if (clash) throw conflict(`There's already a task type called “${name}”.`, "duplicate_type");
}

async function findTaskType(tx: Tx, boardId: string, typeId: string) {
  assertUuid(typeId, "Task type");
  const [row] = await tx
    .select()
    .from(boardTaskType)
    .where(and(eq(boardTaskType.id, typeId), eq(boardTaskType.boardId, boardId)));
  if (!row) throw notFound("Task type not found.");
  return row;
}

/** Only one type per board is given to new tasks (unique index), so clear the old one first. */
async function clearDefault(tx: Tx, boardId: string) {
  await tx
    .update(boardTaskType)
    .set({ isDefault: false })
    .where(and(eq(boardTaskType.boardId, boardId), eq(boardTaskType.isDefault, true)));
}

/** Owners add a task type, optionally as the type for new tasks. */
export async function createTaskType(userId: string, boardId: string, raw: unknown) {
  await requireMember(userId, boardId, "owner");
  const input = createTaskTypeSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [{ total }] = await tx
      .select({ total: count() })
      .from(boardTaskType)
      .where(eq(boardTaskType.boardId, boardId));
    if (total >= LIMITS.types) {
      throw invalid(`A board can have at most ${LIMITS.types} task types.`);
    }
    await assertUniqueName(tx, boardId, input.name);
    if (input.isDefault) await clearDefault(tx, boardId);
    const [row] = await tx
      .insert(boardTaskType)
      .values({ boardId, name: input.name, tone: input.tone, isDefault: input.isDefault ?? false })
      .returning();
    return toTaskType(row);
  });
}

/** Rename, recolor, or set / unset it as the type for new tasks. */
export async function updateTaskType(
  userId: string,
  boardId: string,
  typeId: string,
  raw: unknown,
) {
  await requireMember(userId, boardId, "owner");
  const patch = updateTaskTypeSchema.parse(raw);
  return db.transaction(async (tx) => {
    await findTaskType(tx, boardId, typeId);
    if (patch.name) await assertUniqueName(tx, boardId, patch.name, typeId);
    if (patch.isDefault) await clearDefault(tx, boardId);
    const [row] = await tx
      .update(boardTaskType)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(boardTaskType.id, typeId))
      .returning();
    return toTaskType(row);
  });
}

/**
 * Removes a task type. Its tasks (including deleted ones, so Undo matches)
 * get `moveTo` instead, or no type. If it was the type for new tasks,
 * `moveTo` takes over that role.
 */
export async function deleteTaskType(
  userId: string,
  boardId: string,
  typeId: string,
  moveTo?: string | null,
) {
  await requireMember(userId, boardId, "owner");
  await db.transaction(async (tx) => {
    const target = await findTaskType(tx, boardId, typeId);
    if (moveTo) {
      const destinationId = typeIdSchema.safeParse(moveTo);
      if (!destinationId.success) throw invalid("Choose another task type for its tasks.");
      const [destination] = await tx
        .select({ id: boardTaskType.id })
        .from(boardTaskType)
        .where(
          and(
            eq(boardTaskType.id, moveTo),
            eq(boardTaskType.boardId, boardId),
            ne(boardTaskType.id, typeId),
          ),
        );
      if (!destination) throw invalid("Choose another task type for its tasks.");
    }

    await tx
      .update(task)
      .set({ typeId: moveTo || null, updatedAt: new Date() })
      .where(eq(task.typeId, typeId));
    await tx.delete(boardTaskType).where(eq(boardTaskType.id, typeId));
    if (target.isDefault && moveTo) {
      await tx.update(boardTaskType).set({ isDefault: true }).where(eq(boardTaskType.id, moveTo));
    }
  });
}
