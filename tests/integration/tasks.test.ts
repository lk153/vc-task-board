import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { positionBetween } from "@/domain/ordering";
import { createBoard, getBoardView } from "@/server/services/boards";
import { createTask, deleteTask, restoreTask, updateTask } from "@/server/services/tasks";
import {
  makeSharedBoard,
  makeTask,
  makeUser,
  personIds,
  statusIds,
  taskInput,
  typeIds,
} from "./support/fixtures";

describe("tasks", () => {
  it("creates tasks at the end of their column, in order", async () => {
    const { owner, board } = await makeSharedBoard();
    const first = await makeTask(owner.id, board.id, { title: "First" });
    const second = await makeTask(owner.id, board.id, { title: "Second" });
    expect(first.position < second.position).toBe(true);

    const view = await getBoardView(owner.id, board.id);
    expect(view.tasks.map((t) => t.title)).toEqual(["First", "Second"]);
  });

  it("saves every field and trims text", async () => {
    const { owner, board } = await makeSharedBoard();
    const created = await makeTask(owner.id, board.id, {
      title: "  Spike CSV export  ",
      description: " Reporting pages ",
      status: "In Progress",
      priority: "critical",
      type: "Bug",
      assignee: "Max Member",
      points: 2.5,
    });
    expect(created).toMatchObject({
      title: "Spike CSV export",
      description: "Reporting pages",
      statusId: (await statusIds(board.id))["In Progress"],
      priority: "critical",
      typeId: (await typeIds(board.id))["Bug"],
      assigneeId: (await personIds(board.id))["Max Member"],
      points: 2.5,
    });
  });

  it("accepts a client-generated id once (for optimistic UI) and rejects a duplicate", async () => {
    const { owner, board } = await makeSharedBoard();
    const id = randomUUID();
    await expect(
      createTask(owner.id, board.id, await taskInput(board.id, { id })),
    ).resolves.toMatchObject({ id });
    await expect(
      createTask(owner.id, board.id, await taskInput(board.id, { id })),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("requires a title", async () => {
    const { owner, board } = await makeSharedBoard();
    await expect(makeTask(owner.id, board.id, { title: "   " })).rejects.toThrow(
      "Give the task a title.",
    );
  });

  it("only uses task types and people from the same board", async () => {
    const { owner, board } = await makeSharedBoard();
    const other = await createBoard(owner.id, "Other board");
    const foreignType = (await typeIds(other.id))["Bug"];
    const foreignPerson = (await personIds(other.id))["Olivia Owner"];
    const created = await makeTask(owner.id, board.id);
    await expect(makeTask(owner.id, board.id, { typeId: foreignType })).rejects.toMatchObject({
      status: 422,
    });
    await expect(makeTask(owner.id, board.id, { assigneeId: foreignPerson })).rejects.toMatchObject(
      { status: 422 },
    );
    await expect(
      updateTask(owner.id, board.id, created.id, { assigneeId: randomUUID() }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      updateTask(owner.id, board.id, created.id, { typeId: null, assigneeId: null }),
    ).resolves.toMatchObject({ typeId: null, assigneeId: null });
  });

  it("updates only the fields sent", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const created = await makeTask(owner.id, board.id, { title: "Keep me", priority: "low" });
    const updated = await updateTask(member.id, board.id, created.id, { priority: "high" });
    expect(updated).toMatchObject({ title: "Keep me", priority: "high" });
  });

  it("appends to the new column when the status changes without a position", async () => {
    const { owner, board } = await makeSharedBoard();
    const ids = await statusIds(board.id);
    const done = await makeTask(owner.id, board.id, { status: "Done" });
    const moving = await makeTask(owner.id, board.id, { status: "To Do" });
    const moved = await updateTask(owner.id, board.id, moving.id, { statusId: ids["Done"] });
    expect(moved.statusId).toBe(ids["Done"]);
    expect(moved.position > done.position).toBe(true);
  });

  it("moves to an explicit position", async () => {
    const { owner, board } = await makeSharedBoard();
    const a = await makeTask(owner.id, board.id, { title: "A" });
    await makeTask(owner.id, board.id, { title: "B" });
    const c = await makeTask(owner.id, board.id, { title: "C" });
    await updateTask(owner.id, board.id, c.id, { position: positionBetween(null, a.position) });
    const view = await getBoardView(owner.id, board.id);
    expect(view.tasks.map((t) => t.title)).toEqual(["C", "A", "B"]);
  });

  it("soft-deletes and restores to the same column and position", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const kept = await makeTask(owner.id, board.id, { title: "Kept" });
    const removed = await makeTask(owner.id, board.id, { title: "Removed", status: "In Review" });

    await deleteTask(member.id, board.id, removed.id);
    expect((await getBoardView(owner.id, board.id)).tasks.map((t) => t.id)).toEqual([kept.id]);

    const restored = await restoreTask(owner.id, board.id, removed.id);
    expect(restored).toMatchObject({ statusId: removed.statusId, position: removed.position });
    expect((await getBoardView(owner.id, board.id)).tasks).toHaveLength(2);
  });

  it("can't touch a task through another board", async () => {
    const { owner, board } = await makeSharedBoard();
    const stranger = await makeUser("Sam Stranger");
    const strangersBoard = await createBoard(stranger.id, "Elsewhere");
    const task = await makeTask(owner.id, board.id);

    await expect(
      updateTask(stranger.id, strangersBoard.id, task.id, { title: "x" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(deleteTask(stranger.id, board.id, task.id)).rejects.toMatchObject({ status: 404 });
  });

  it("only accepts statuses from the same board", async () => {
    const { owner, board } = await makeSharedBoard();
    const other = await createBoard(owner.id, "Other board");
    const foreignStatus = (await statusIds(other.id))["Done"];
    const created = await makeTask(owner.id, board.id);
    await expect(
      createTask(owner.id, board.id, { ...(await taskInput(board.id)), statusId: foreignStatus }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      updateTask(owner.id, board.id, created.id, { statusId: foreignStatus }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("treats malformed ids as not found", async () => {
    const { owner, board } = await makeSharedBoard();
    await expect(updateTask(owner.id, board.id, "nope", { title: "x" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(makeTask(owner.id, "not-a-uuid")).rejects.toMatchObject({ status: 404 });
  });
});
