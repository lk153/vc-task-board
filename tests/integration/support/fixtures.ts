import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { createBoard } from "@/server/services/boards";
import { createInvite, acceptInvite } from "@/server/services/invites";
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

export function taskInput(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    title: "Write tests",
    description: "",
    status: "todo",
    priority: "medium",
    type: "tech",
    assigneeId: null,
    points: null,
    ...overrides,
  };
}

export function makeTask(
  userId: string,
  boardId: string,
  overrides: Partial<CreateTaskInput> = {},
) {
  return createTask(userId, boardId, taskInput(overrides));
}
