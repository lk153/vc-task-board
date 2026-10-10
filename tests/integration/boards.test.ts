import { describe, expect, it } from "vitest";
import {
  createBoard,
  createPersonalBoard,
  getBoardView,
  listBoards,
  PERSONAL_BOARD_NAME,
  renameBoard,
  resolveHomeBoard,
} from "@/server/services/boards";
import { makeSharedBoard, makeUser } from "./support/fixtures";

describe("boards", () => {
  it("makes the creator the owner and lists boards in creation order", async () => {
    const user = await makeUser();
    const first = await createBoard(user.id, "  Roadmap ");
    const second = await createBoard(user.id, "Bugs");
    expect(first).toMatchObject({ name: "Roadmap", role: "owner" });
    expect((await listBoards(user.id)).map((b) => b.id)).toEqual([first.id, second.id]);
  });

  it("validates names", async () => {
    const user = await makeUser();
    await expect(createBoard(user.id, "  ")).rejects.toThrow("Give the board a name.");
    const board = await createBoard(user.id, "Ok");
    await expect(renameBoard(user.id, board.id, "x".repeat(81))).rejects.toThrow();
    await expect(renameBoard(user.id, board.id, "Renamed")).resolves.toMatchObject({
      name: "Renamed",
    });
  });

  it("returns members owners-first with their roles", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const view = await getBoardView(member.id, board.id);
    expect(view.board).toEqual({ id: board.id, name: "Team board", role: "member" });
    expect(view.members.map((m) => [m.userId, m.role])).toEqual([
      [owner.id, "owner"],
      [member.id, "member"],
    ]);
  });

  describe("resolveHomeBoard", () => {
    it("prefers the remembered board while the user can still open it", async () => {
      const { member, board } = await makeSharedBoard();
      const personal = await createPersonalBoard(member.id);
      expect(await resolveHomeBoard(member.id, board.id)).toBe(board.id);
      expect(await resolveHomeBoard(member.id, "garbage")).toBe(board.id); // first by creation
      const stranger = await makeUser("Stranger");
      expect(await resolveHomeBoard(stranger.id, board.id)).not.toBe(board.id);
      expect(personal.name).toBe(PERSONAL_BOARD_NAME);
    });

    it("creates a personal board for someone with none left", async () => {
      const user = await makeUser();
      const id = await resolveHomeBoard(user.id);
      expect(await listBoards(user.id)).toEqual([{ id, name: PERSONAL_BOARD_NAME, role: "owner" }]);
    });
  });
});
