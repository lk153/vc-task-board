import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBoard, getBoardView } from "@/server/services/boards";
import { bulkMoveTasks } from "@/server/services/tasks";
import { makeSharedBoard, makeTask, makeUser } from "./support/fixtures";

const titles = async (userId: string, boardId: string, status: string) =>
  (await getBoardView(userId, boardId)).tasks
    .filter((t) => t.status === status)
    .map((t) => t.title);

describe("bulk status change", () => {
  it("moves several tasks to the end of the target column, in the order given", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const a = await makeTask(owner.id, board.id, { title: "A" });
    await makeTask(owner.id, board.id, { title: "B" });
    const c = await makeTask(owner.id, board.id, { title: "C" });
    await makeTask(owner.id, board.id, { title: "Already done", status: "done" });

    const moved = await bulkMoveTasks(member.id, board.id, {
      tasks: [
        { id: c.id, status: "done" },
        { id: a.id, status: "done" },
      ],
    });

    expect(moved.map((t) => [t.title, t.status])).toEqual([
      ["C", "done"],
      ["A", "done"],
    ]);
    expect(await titles(owner.id, board.id, "done")).toEqual(["Already done", "C", "A"]);
    expect(await titles(owner.id, board.id, "todo")).toEqual(["B"]);
  });

  it("restores exact positions (Undo) and skips tasks already in place", async () => {
    const { owner, board } = await makeSharedBoard();
    const a = await makeTask(owner.id, board.id, { title: "A" });
    const b = await makeTask(owner.id, board.id, { title: "B" });
    await bulkMoveTasks(owner.id, board.id, { tasks: [{ id: a.id, status: "review" }] });

    const undone = await bulkMoveTasks(owner.id, board.id, {
      tasks: [
        { id: a.id, status: "todo", position: a.position },
        { id: b.id, status: "todo" }, // already there: unchanged
      ],
    });
    expect(undone.map((t) => t.title)).toEqual(["A"]);
    expect(await titles(owner.id, board.id, "todo")).toEqual(["A", "B"]);
  });

  it("never touches tasks on another board, and skips unknown or deleted ids", async () => {
    const { owner, board } = await makeSharedBoard();
    const mine = await makeTask(owner.id, board.id, { title: "Mine" });
    const stranger = await makeUser("Stranger");
    const otherBoard = await createBoard(stranger.id, "Elsewhere");
    const theirs = await makeTask(stranger.id, otherBoard.id, { title: "Theirs" });

    const moved = await bulkMoveTasks(owner.id, board.id, {
      tasks: [
        { id: mine.id, status: "done" },
        { id: theirs.id, status: "done" },
        { id: randomUUID(), status: "done" },
      ],
    });
    expect(moved.map((t) => t.title)).toEqual(["Mine"]);
    expect(await titles(stranger.id, otherBoard.id, "todo")).toEqual(["Theirs"]);
  });

  it("is only for members, and validates the request", async () => {
    const { owner, board } = await makeSharedBoard();
    const task = await makeTask(owner.id, board.id);
    const outsider = await makeUser("Outsider");
    await expect(
      bulkMoveTasks(outsider.id, board.id, { tasks: [{ id: task.id, status: "done" }] }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(bulkMoveTasks(owner.id, board.id, { tasks: [] })).rejects.toThrow(
      "Select at least one task.",
    );
    await expect(
      bulkMoveTasks(owner.id, board.id, {
        tasks: [
          { id: task.id, status: "done" },
          { id: task.id, status: "review" },
        ],
      }),
    ).rejects.toThrow("Duplicate task ids.");
    await expect(
      bulkMoveTasks(owner.id, board.id, { tasks: [{ id: task.id, status: "blocked" }] }),
    ).rejects.toThrow();
  });
});
