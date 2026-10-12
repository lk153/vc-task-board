import "server-only";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import {
  boardNameSchema,
  type BoardSummary,
  type BoardView,
  type Invite,
  type Member,
} from "@/domain/task";
import { sortTasks } from "@/domain/ordering";
import { db } from "../db/client";
import { board, boardInvite, boardMember, task, user } from "../db/schema";
import { isMember, requireMember } from "./access";
import { addPersonForUser, listPeople } from "./people";
import { insertDefaultStatuses, listStatuses } from "./statuses";
import { insertDefaultTaskTypes, listTaskTypes } from "./task-types";
import { toTask } from "./tasks";

export const PERSONAL_BOARD_NAME = "My board";

export async function listBoards(userId: string): Promise<BoardSummary[]> {
  return db
    .select({ id: board.id, name: board.name, role: boardMember.role })
    .from(boardMember)
    .innerJoin(board, eq(board.id, boardMember.boardId))
    .where(eq(boardMember.userId, userId))
    .orderBy(asc(board.createdAt), asc(board.id));
}

export async function createBoard(userId: string, rawName: string): Promise<BoardSummary> {
  const name = boardNameSchema.parse(rawName);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(board)
      .values({ name, createdBy: userId })
      .returning({ id: board.id, name: board.name });
    await tx.insert(boardMember).values({ boardId: created.id, userId, role: "owner" });
    await insertDefaultStatuses(tx, created.id);
    await insertDefaultTaskTypes(tx, created.id);
    const [creator] = await tx
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    if (creator) await addPersonForUser(tx, created.id, creator);
    return { ...created, role: "owner" as const };
  });
}

/** Called when an account is created, so nobody starts with an empty app. */
export function createPersonalBoard(userId: string) {
  return createBoard(userId, PERSONAL_BOARD_NAME);
}

/**
 * Where to send a signed-in user: the preferred board if they can still open
 * it, otherwise their first board (creating one if they have none left).
 */
export async function resolveHomeBoard(userId: string, preferred?: string | null): Promise<string> {
  if (preferred && /^[0-9a-f-]{36}$/i.test(preferred) && (await isMember(userId, preferred))) {
    return preferred;
  }
  const [first] = await listBoards(userId);
  if (first) return first.id;
  return (await createPersonalBoard(userId)).id;
}

export async function getBoardView(userId: string, boardId: string): Promise<BoardView> {
  const role = await requireMember(userId, boardId);

  const [boardRow] = await db
    .select({ id: board.id, name: board.name })
    .from(board)
    .where(eq(board.id, boardId));

  const memberRows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: boardMember.role,
    })
    .from(boardMember)
    .innerJoin(user, eq(user.id, boardMember.userId))
    .where(eq(boardMember.boardId, boardId));

  const members: Member[] = memberRows.sort(
    (a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1) || a.name.localeCompare(b.name),
  );

  const invites: Invite[] =
    role === "owner"
      ? (
          await db
            .select({
              id: boardInvite.id,
              email: boardInvite.email,
              token: boardInvite.token,
              invitedByName: user.name,
              createdAt: boardInvite.createdAt,
              expiresAt: boardInvite.expiresAt,
            })
            .from(boardInvite)
            .leftJoin(user, eq(user.id, boardInvite.invitedBy))
            .where(
              and(
                eq(boardInvite.boardId, boardId),
                isNull(boardInvite.acceptedAt),
                gt(boardInvite.expiresAt, new Date()),
              ),
            )
            .orderBy(asc(boardInvite.createdAt))
        ).map((row) => ({
          ...row,
          invitedByName: row.invitedByName ?? "A former member",
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
        }))
      : [];

  const taskRows = await db
    .select()
    .from(task)
    .where(and(eq(task.boardId, boardId), isNull(task.deletedAt)));

  return {
    board: { id: boardRow.id, name: boardRow.name, role },
    statuses: await listStatuses(boardId),
    types: await listTaskTypes(boardId),
    people: await listPeople(boardId),
    members,
    invites,
    tasks: sortTasks(taskRows.map(toTask)),
  };
}

export async function renameBoard(userId: string, boardId: string, rawName: string) {
  await requireMember(userId, boardId, "owner");
  const name = boardNameSchema.parse(rawName);
  const [updated] = await db
    .update(board)
    .set({ name })
    .where(eq(board.id, boardId))
    .returning({ id: board.id, name: board.name });
  return { ...updated, role: "owner" as const };
}

export async function deleteBoard(userId: string, boardId: string): Promise<void> {
  await requireMember(userId, boardId, "owner");
  await db.delete(board).where(eq(board.id, boardId));
}
