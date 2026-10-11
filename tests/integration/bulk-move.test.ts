import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBoard, getBoardView } from "@/server/services/boards";
import { bulkMoveTasks } from "@/server/services/tasks";
import { makeSharedBoard, makeTask, makeUser, statusIds } from "./support/fixtures";

/** Titles in one column, top to bottom. */
const titles = async (userId: string, boardId: string, column: string) => {
  const view = await getBoardView(userId, boardId);
  const statusId = view.statuses.find((s) => s.name === column)!.id;
  return view.tasks.filter((t) => t.statusId === statusId).map((t) => t.title);
};

describe("bulk status change", () => {
  it("moves several tasks to the end of the target column, in the order given", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const ids = await statusIds(board.id);
    const a = await makeTask(owner.id, board.id, { title: "A" });
    await makeTask(owner.id, board.id, { title: "B" });
    const c = await makeTask(owner.id, board.id, { title: "C" });
    await makeTask(owner.id, board.id, { title: "Already done", status: "Done" });

    const moved = await bulkMoveTasks(member.id, board.id, {
      tasks: [
        { id: c.id, statusId: ids.Done },
        { id: a.id, statusId: ids.Done },
      ],
    });

    expect(moved.map((t) => [t.title, t.statusId])).toEqual([
      ["C", ids.Done],
      ["A", ids.Done],
    ]);
    expect(await titles(owner.id, board.id, "Done")).toEqual(["Already done", "C", "A"]);
    expect(await titles(owner.id, board.id, "To Do")).toEqual(["B"]);
  });

  it("restores exact positions (Undo) and skips tasks already in place", async () => {
    const { owner, board } = await makeSharedBoard();
    const ids = await statusIds(board.id);
    const a = await makeTask(owner.id, board.id, { title: "A" });
    const b = await makeTask(owner.id, board.id, { title: "B" });
    await bulkMoveTasks(owner.id, board.id, { tasks: [{ id: a.id, statusId: ids["In Review"] }] });

    const undone = await bulkMoveTasks(owner.id, board.id, {
      tasks: [
        { id: a.id, statusId: ids["To Do"], position: a.position },
        { id: b.id, statusId: ids["To Do"] }, // already there: unchanged
      ],
    });
    expect(undone.map((t) => t.title)).toEqual(["A"]);
    expect(await titles(owner.id, board.id, "To Do")).toEqual(["A", "B"]);
  });

  it("never touches tasks on another board, and skips unknown or deleted ids", async () => {
    const { owner, board } = await makeSharedBoard();
    const ids = await statusIds(board.id);
    const mine = await makeTask(owner.id, board.id, { title: "Mine" });
    const stranger = await makeUser("Stranger");
    const otherBoard = await createBoard(stranger.id, "Elsewhere");
    const theirs = await makeTask(stranger.id, otherBoard.id, { title: "Theirs" });

    const moved = await bulkMoveTasks(owner.id, board.id, {
      tasks: [
        { id: mine.id, statusId: ids.Done },
        { id: theirs.id, statusId: ids.Done },
        { id: randomUUID(), statusId: ids.Done },
      ],
    });
    expect(moved.map((t) => t.title)).toEqual(["Mine"]);
    expect(await titles(stranger.id, otherBoard.id, "To Do")).toEqual(["Theirs"]);
  });

  it("is only for members, and validates the request", async () => {
    const { owner, board } = await makeSharedBoard();
    const ids = await statusIds(board.id);
    const task = await makeTask(owner.id, board.id);
    const outsider = await makeUser("Outsider");
    await expect(
      bulkMoveTasks(outsider.id, board.id, { tasks: [{ id: task.id, statusId: ids.Done }] }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(bulkMoveTasks(owner.id, board.id, { tasks: [] })).rejects.toThrow(
      "Select at least one task.",
    );
    await expect(
      bulkMoveTasks(owner.id, board.id, {
        tasks: [
          { id: task.id, statusId: ids.Done },
          { id: task.id, statusId: ids["In Review"] },
        ],
      }),
    ).rejects.toThrow("Duplicate task ids.");
    // A status from another board is rejected.
    const other = await createBoard(owner.id, "Other");
    const foreign = (await statusIds(other.id)).Done;
    await expect(
      bulkMoveTasks(owner.id, board.id, { tasks: [{ id: task.id, statusId: foreign }] }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
