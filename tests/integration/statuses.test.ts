import { describe, expect, it } from "vitest";
import { LIMITS } from "@/config/board";
import { positionBetween } from "@/domain/ordering";
import { createBoard, getBoardView } from "@/server/services/boards";
import { createStatus, deleteStatus, listStatuses, updateStatus } from "@/server/services/statuses";
import { deleteTask, restoreTask } from "@/server/services/tasks";
import { makeSharedBoard, makeTask, makeUser, statusIds } from "./support/fixtures";

const names = async (boardId: string) => (await listStatuses(boardId)).map((s) => s.name);
const defaultName = async (boardId: string) =>
  (await listStatuses(boardId)).find((s) => s.isDefault)?.name;

/** Titles in one column, top to bottom. */
const titles = async (userId: string, boardId: string, column: string) => {
  const view = await getBoardView(userId, boardId);
  const statusId = view.statuses.find((s) => s.name === column)!.id;
  return view.tasks.filter((t) => t.statusId === statusId).map((t) => t.title);
};

describe("board statuses", () => {
  it("gives a new board the five standard columns, with To Do for new tasks", async () => {
    const user = await makeUser();
    const board = await createBoard(user.id, "Fresh");
    expect(await names(board.id)).toEqual(["Backlog", "To Do", "In Progress", "In Review", "Done"]);
    expect(await defaultName(board.id)).toBe("To Do");
    expect((await getBoardView(user.id, board.id)).statuses).toHaveLength(5);
  });

  describe("add", () => {
    it("appends a column with a trimmed name", async () => {
      const { owner, board } = await makeSharedBoard();
      const added = await createStatus(owner.id, board.id, { name: "  Blocked ", tone: "red" });
      expect(added).toMatchObject({ name: "Blocked", tone: "red", isDefault: false });
      expect((await names(board.id)).at(-1)).toBe("Blocked");
    });

    it("rejects duplicate names (any capitalisation), bad colors and too many columns", async () => {
      const { owner, board } = await makeSharedBoard();
      await expect(
        createStatus(owner.id, board.id, { name: "done", tone: "green" }),
      ).rejects.toMatchObject({ status: 409, code: "duplicate_status" });
      await expect(
        createStatus(owner.id, board.id, { name: "QA", tone: "rainbow" }),
      ).rejects.toThrow();
      await expect(createStatus(owner.id, board.id, { name: "  ", tone: "gray" })).rejects.toThrow(
        "Give the status a name.",
      );
      for (let i = 5; i < LIMITS.statuses; i++) {
        await createStatus(owner.id, board.id, { name: `Extra ${i}`, tone: "gray" });
      }
      await expect(
        createStatus(owner.id, board.id, { name: "One too many", tone: "gray" }),
      ).rejects.toMatchObject({ status: 422 });
    });

    it("is for owners only", async () => {
      const { member, board } = await makeSharedBoard();
      const outsider = await makeUser("Outsider");
      await expect(
        createStatus(member.id, board.id, { name: "QA", tone: "teal" }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        createStatus(outsider.id, board.id, { name: "QA", tone: "teal" }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("edit", () => {
    it("renames, recolors and reorders", async () => {
      const { owner, board } = await makeSharedBoard();
      const statuses = await listStatuses(board.id);
      const review = statuses.find((s) => s.name === "In Review")!;
      await updateStatus(owner.id, board.id, review.id, { name: "QA", tone: "teal" });
      // Move "QA" to the front.
      await updateStatus(owner.id, board.id, review.id, {
        position: positionBetween(null, statuses[0].position),
      });
      expect(await names(board.id)).toEqual(["QA", "Backlog", "To Do", "In Progress", "Done"]);
      expect((await listStatuses(board.id))[0].tone).toBe("teal");
    });

    it("moves the 'new tasks' default", async () => {
      const { owner, board } = await makeSharedBoard();
      const ids = await statusIds(board.id);
      await updateStatus(owner.id, board.id, ids.Backlog, { isDefault: true });
      expect(await defaultName(board.id)).toBe("Backlog");
      expect((await listStatuses(board.id)).filter((s) => s.isDefault)).toHaveLength(1);
    });

    it("rejects a rename that clashes, and members can't edit", async () => {
      const { owner, member, board } = await makeSharedBoard();
      const ids = await statusIds(board.id);
      await expect(
        updateStatus(owner.id, board.id, ids.Backlog, { name: "DONE" }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        updateStatus(owner.id, board.id, ids.Done, { name: "Done" }),
      ).resolves.toMatchObject({ name: "Done" }); // same name on itself is fine
      await expect(
        updateStatus(member.id, board.id, ids.Done, { name: "Shipped" }),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("delete", () => {
    it("removes an empty column", async () => {
      const { owner, board } = await makeSharedBoard();
      const ids = await statusIds(board.id);
      await deleteStatus(owner.id, board.id, ids["In Review"]);
      expect(await names(board.id)).toEqual(["Backlog", "To Do", "In Progress", "Done"]);
    });

    it("moves its tasks (including deleted ones) to the chosen column", async () => {
      const { owner, board } = await makeSharedBoard();
      const ids = await statusIds(board.id);
      await makeTask(owner.id, board.id, { title: "Done 1", status: "Done" });
      await makeTask(owner.id, board.id, { title: "Review 1", status: "In Review" });
      await makeTask(owner.id, board.id, { title: "Review 2", status: "In Review" });
      const binned = await makeTask(owner.id, board.id, { title: "Binned", status: "In Review" });
      await deleteTask(owner.id, board.id, binned.id);

      await expect(deleteStatus(owner.id, board.id, ids["In Review"])).rejects.toMatchObject({
        status: 422,
      });
      await deleteStatus(owner.id, board.id, ids["In Review"], ids.Done);

      expect(await names(board.id)).not.toContain("In Review");
      expect(await titles(owner.id, board.id, "Done")).toEqual(["Done 1", "Review 1", "Review 2"]);
      // Undo of the earlier delete still works and lands in the new column.
      const restored = await restoreTask(owner.id, board.id, binned.id);
      expect(restored.statusId).toBe(ids.Done);
    });

    it("hands the default to the destination when the default column is removed", async () => {
      const { owner, board } = await makeSharedBoard();
      const ids = await statusIds(board.id);
      await deleteStatus(owner.id, board.id, ids["To Do"], ids.Backlog);
      expect(await defaultName(board.id)).toBe("Backlog");
    });

    it("keeps at least one column, and checks the destination", async () => {
      const { owner, member, board } = await makeSharedBoard();
      const ids = await statusIds(board.id);
      await makeTask(owner.id, board.id, { title: "Keep me", status: "Done" });
      const other = await createBoard(owner.id, "Other");
      const foreign = (await statusIds(other.id)).Done;

      await expect(deleteStatus(owner.id, board.id, ids.Done, foreign)).rejects.toMatchObject({
        status: 422,
      });
      await expect(deleteStatus(owner.id, board.id, ids.Done, ids.Done)).rejects.toMatchObject({
        status: 422,
      });
      await expect(deleteStatus(member.id, board.id, ids.Backlog)).rejects.toMatchObject({
        status: 403,
      });

      for (const name of ["Backlog", "To Do", "In Progress", "In Review"]) {
        await deleteStatus(owner.id, board.id, ids[name]);
      }
      await expect(deleteStatus(owner.id, board.id, ids.Done)).rejects.toMatchObject({
        status: 409,
        code: "last_status",
      });
      expect(await titles(owner.id, board.id, "Done")).toEqual(["Keep me"]);
      expect(await defaultName(board.id)).toBe("Done");
    });
  });
});
