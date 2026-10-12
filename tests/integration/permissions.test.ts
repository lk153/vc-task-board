import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { task } from "@/server/db/schema";
import { deleteBoard, getBoardView, listBoards, renameBoard } from "@/server/services/boards";
import { cancelInvite, createInvite } from "@/server/services/invites";
import { removeMember } from "@/server/services/members";
import { createTask, deleteTask, restoreTask, updateTask } from "@/server/services/tasks";
import { makeSharedBoard, makeTask, makeUser, statusIds, taskInput } from "./support/fixtures";

describe("board permissions", () => {
  it("hides boards from non-members with 404 on every operation", async () => {
    const { owner, board } = await makeSharedBoard();
    const outsider = await makeUser("Out Sider");
    const existing = await makeTask(owner.id, board.id);

    const attempts = [
      getBoardView(outsider.id, board.id),
      renameBoard(outsider.id, board.id, "Mine now"),
      deleteBoard(outsider.id, board.id),
      createTask(outsider.id, board.id, await taskInput(board.id)),
      updateTask(outsider.id, board.id, existing.id, { title: "x" }),
      deleteTask(outsider.id, board.id, existing.id),
      restoreTask(outsider.id, board.id, existing.id),
      createInvite(outsider.id, board.id, { email: "friend@example.com" }),
      removeMember(outsider.id, board.id, owner.id),
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toMatchObject({ status: 404 });
    }
    expect(await listBoards(outsider.id)).toEqual([]);
  });

  it("lets members work on tasks but not manage the board", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const created = await makeTask(member.id, board.id, { title: "Member task" });
    await expect(
      updateTask(member.id, board.id, created.id, { statusId: (await statusIds(board.id)).Done }),
    ).resolves.toMatchObject({ statusId: (await statusIds(board.id)).Done });

    await expect(renameBoard(member.id, board.id, "Renamed")).rejects.toMatchObject({
      status: 403,
    });
    await expect(deleteBoard(member.id, board.id)).rejects.toMatchObject({ status: 403 });
    await expect(
      createInvite(member.id, board.id, { email: "friend@example.com" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(removeMember(member.id, board.id, owner.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("only shows pending invites to owners", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const invite = await createInvite(owner.id, board.id, { email: "friend@example.com" });
    expect((await getBoardView(owner.id, board.id)).invites.map((i) => i.id)).toEqual([invite.id]);
    expect((await getBoardView(member.id, board.id)).invites).toEqual([]);
    await expect(cancelInvite(member.id, board.id, invite.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("lets a member leave; they stay on the assignee list with their tasks", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const assigned = await makeTask(owner.id, board.id, { assignee: "Max Member" });

    await removeMember(member.id, board.id, member.id);

    await expect(getBoardView(member.id, board.id)).rejects.toMatchObject({ status: 404 });
    const view = await getBoardView(owner.id, board.id);
    expect(view.members.map((m) => m.userId)).toEqual([owner.id]);
    expect(view.people.map((p) => p.name)).toContain("Max Member");
    expect(view.tasks.find((t) => t.id === assigned.id)?.assigneeId).toBe(assigned.assigneeId);
  });

  it("lets owners remove members", async () => {
    const { owner, member, board } = await makeSharedBoard();
    await removeMember(owner.id, board.id, member.id);
    expect(await listBoards(member.id)).toEqual([]);
  });

  it("never leaves a board without an owner", async () => {
    const { owner, board } = await makeSharedBoard();
    await expect(removeMember(owner.id, board.id, owner.id)).rejects.toMatchObject({
      status: 409,
      code: "last_owner",
    });
  });

  it("deletes a board with everything on it", async () => {
    const { owner, member, board } = await makeSharedBoard();
    await makeTask(owner.id, board.id);
    await deleteBoard(owner.id, board.id);
    expect(await listBoards(member.id)).toEqual([]);
    expect(await db.select().from(task)).toEqual([]);
  });
});
