import "server-only";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { LIMITS } from "@/config/board";
import {
  createPersonSchema,
  personIdSchema,
  sortByName,
  updatePersonSchema,
  type BoardPerson,
} from "@/domain/task";
import { assigneeTone } from "@/domain/tone";
import { db, type Executor, type Tx } from "../db/client";
import { boardPerson, task } from "../db/schema";
import { conflict, invalid, notFound } from "../errors";
import { assertUuid, requireMember } from "./access";

type PersonRow = typeof boardPerson.$inferSelect;

export function toPerson(row: PersonRow): BoardPerson {
  return { id: row.id, name: row.name, tone: row.tone, userId: row.userId };
}

/** A board's assignees, by name. */
export async function listPeople(boardId: string, tx: Executor = db) {
  const rows = await tx.select().from(boardPerson).where(eq(boardPerson.boardId, boardId));
  return sortByName(rows.map(toPerson));
}

/** 422 unless `personId` is on this board's assignee list (used by the task services). */
export async function assertBoardPerson(boardId: string, personId: string, tx: Executor = db) {
  const [row] = await tx
    .select({ id: boardPerson.id })
    .from(boardPerson)
    .where(and(eq(boardPerson.id, personId), eq(boardPerson.boardId, boardId)));
  if (!row)
    throw invalid("That person isn't on this board's assignee list. Refresh and try again.");
}

/**
 * Puts a member on the board's assignee list when they create or join it.
 * If the owner already added someone with the same name (and no account),
 * that entry is linked instead. Never fails: a full list just skips them.
 */
export async function addPersonForUser(
  tx: Executor,
  boardId: string,
  account: { id: string; name: string; email: string },
) {
  const people = await tx.select().from(boardPerson).where(eq(boardPerson.boardId, boardId));
  if (people.some((p) => p.userId === account.id)) return;

  const name = account.name.trim().slice(0, LIMITS.personName) || account.email;
  const sameName = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (sameName && !sameName.userId) {
    await tx
      .update(boardPerson)
      .set({ userId: account.id, updatedAt: new Date() })
      .where(eq(boardPerson.id, sameName.id));
    return;
  }
  if (people.length >= LIMITS.people) return;
  await tx
    .insert(boardPerson)
    .values({
      boardId,
      name: sameName ? `${name} (${account.email})`.slice(0, LIMITS.personName) : name,
      tone: assigneeTone(account.id),
      userId: account.id,
    })
    .onConflictDoNothing();
}

async function assertUniqueName(tx: Tx, boardId: string, name: string, exceptId?: string) {
  const [clash] = await tx
    .select({ id: boardPerson.id })
    .from(boardPerson)
    .where(
      and(
        eq(boardPerson.boardId, boardId),
        sql`lower(${boardPerson.name}) = lower(${name})`,
        exceptId ? ne(boardPerson.id, exceptId) : undefined,
      ),
    );
  if (clash) throw conflict(`“${name}” is already on the list.`, "duplicate_person");
}

async function findPerson(tx: Tx, boardId: string, personId: string) {
  assertUuid(personId, "Person");
  const [row] = await tx
    .select()
    .from(boardPerson)
    .where(and(eq(boardPerson.id, personId), eq(boardPerson.boardId, boardId)));
  if (!row) throw notFound("Person not found.");
  return row;
}

/** Owners add someone tasks can be assigned to. They don't need an account. */
export async function createPerson(userId: string, boardId: string, raw: unknown) {
  await requireMember(userId, boardId, "owner");
  const input = createPersonSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [{ total }] = await tx
      .select({ total: count() })
      .from(boardPerson)
      .where(eq(boardPerson.boardId, boardId));
    if (total >= LIMITS.people) {
      throw invalid(`A board can have at most ${LIMITS.people} assignees.`);
    }
    await assertUniqueName(tx, boardId, input.name);
    const [row] = await tx
      .insert(boardPerson)
      .values({ boardId, ...input })
      .returning();
    return toPerson(row);
  });
}

/** Rename or recolor. The name is this board's only, even for members. */
export async function updatePerson(
  userId: string,
  boardId: string,
  personId: string,
  raw: unknown,
) {
  await requireMember(userId, boardId, "owner");
  const patch = updatePersonSchema.parse(raw);
  return db.transaction(async (tx) => {
    await findPerson(tx, boardId, personId);
    if (patch.name) await assertUniqueName(tx, boardId, patch.name, personId);
    const [row] = await tx
      .update(boardPerson)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(boardPerson.id, personId))
      .returning();
    return toPerson(row);
  });
}

/**
 * Removes someone from the assignee list (not from the board). Their tasks,
 * including deleted ones, go to `moveTo` or become unassigned.
 */
export async function deletePerson(
  userId: string,
  boardId: string,
  personId: string,
  moveTo?: string | null,
) {
  await requireMember(userId, boardId, "owner");
  await db.transaction(async (tx) => {
    await findPerson(tx, boardId, personId);
    if (moveTo) {
      if (!personIdSchema.safeParse(moveTo).success) {
        throw invalid("Choose someone else for their tasks.");
      }
      const [destination] = await tx
        .select({ id: boardPerson.id })
        .from(boardPerson)
        .where(
          and(
            eq(boardPerson.id, moveTo),
            eq(boardPerson.boardId, boardId),
            ne(boardPerson.id, personId),
          ),
        );
      if (!destination) throw invalid("Choose someone else for their tasks.");
    }

    await tx
      .update(task)
      .set({ assigneeId: moveTo || null, updatedAt: new Date() })
      .where(eq(task.assigneeId, personId));
    await tx.delete(boardPerson).where(eq(boardPerson.id, personId));
  });
}
