import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { createBoard } from "@/server/services/boards";
import { createInvite, acceptInvite } from "@/server/services/invites";
import { listPeople } from "@/server/services/people";
import { listStatuses } from "@/server/services/statuses";
import { listTaskTypes } from "@/server/services/task-types";
import { createTask } from "@/server/services/tasks";
import type { CreateTaskInput } from "@/domain/task";

export async function makeUser(name = "Alex Doe", email?: string) {
  const id = randomUUID();
  const [row] = await db
    .insert(user)
    .values({ id, name, email: email ?? `${id.slice(0, 8)}@example.com` })
    .returning();
  return row;
}

/** An owner with a board, plus a second user who joined via invite. */
export async function makeSharedBoard() {
  const owner = await makeUser("Olivia Owner", "owner@example.com");
  const member = await makeUser("Max Member", "member@example.com");
  const board = await createBoard(owner.id, "Team board");
  const invite = await createInvite(owner.id, board.id, { email: member.email });
  await acceptInvite(member, invite.token);
  return { owner, member, board };
}

/** Status ids by column name, e.g. `(await statusIds(board.id))["Done"]`. */
export async function statusIds(boardId: string): Promise<Record<string, string>> {
  const statuses = await listStatuses(boardId).catch(() => []);
  return Object.fromEntries(statuses.map((s) => [s.name, s.id]));
}

/** Task type ids by name, e.g. `(await typeIds(board.id))["Bug"]`. */
export async function typeIds(boardId: string): Promise<Record<string, string>> {
  const types = await listTaskTypes(boardId).catch(() => []);
  return Object.fromEntries(types.map((t) => [t.name, t.id]));
}

/** Assignee (person) ids by name, e.g. `(await personIds(board.id))["Max Member"]`. */
export async function personIds(boardId: string): Promise<Record<string, string>> {
  const people = await listPeople(boardId).catch(() => []);
  return Object.fromEntries(people.map((p) => [p.name, p.id]));
}

type TaskOverrides = Partial<Omit<CreateTaskInput, "statusId">> & {
  /** Column name on the board (default "To Do"). */
  status?: string;
  /** Task type name (default "Tech Solution"); null for none. */
  type?: string | null;
  /** Assignee name on the board's list. */
  assignee?: string;
};

/** A valid task body for `boardId`; unknown boards get a random status id. */
export async function taskInput(
  boardId: string,
  { status = "To Do", type = "Tech Solution", assignee, ...overrides }: TaskOverrides = {},
): Promise<CreateTaskInput> {
  return {
    title: "Write tests",
    description: "",
    statusId: (await statusIds(boardId))[status] ?? randomUUID(),
    priority: "medium",
    typeId: type ? ((await typeIds(boardId))[type] ?? null) : null,
    assigneeId: assignee ? ((await personIds(boardId))[assignee] ?? randomUUID()) : null,
    points: null,
    ...overrides,
  };
}

export async function makeTask(userId: string, boardId: string, overrides: TaskOverrides = {}) {
  return createTask(userId, boardId, await taskInput(boardId, overrides));
}
