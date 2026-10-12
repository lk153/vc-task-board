import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/config/board";
import { assigneeTone } from "@/domain/tone";
import { createBoard, getBoardView } from "@/server/services/boards";
import { acceptInvite, createInvite } from "@/server/services/invites";
import { removeMember } from "@/server/services/members";
import { createPerson, deletePerson, listPeople, updatePerson } from "@/server/services/people";
import {
  createTaskType,
  deleteTaskType,
  listTaskTypes,
  updateTaskType,
} from "@/server/services/task-types";
import { deleteTask, restoreTask } from "@/server/services/tasks";
import { makeSharedBoard, makeTask, makeUser, personIds, typeIds } from "./support/fixtures";

const typeNames = async (boardId: string) => (await listTaskTypes(boardId)).map((t) => t.name);
const defaultType = async (boardId: string) =>
  (await listTaskTypes(boardId)).find((t) => t.isDefault)?.name ?? null;

/** Task titles with a given type (or assignee) id. */
async function titlesWith(
  userId: string,
  boardId: string,
  field: "typeId" | "assigneeId",
  id: string | null,
) {
  const view = await getBoardView(userId, boardId);
  return view.tasks.filter((t) => t[field] === id).map((t) => t.title);
}

describe("task types", () => {
  it("gives a new board the six standard types, by name, with Tech Solution for new tasks", async () => {
    const user = await makeUser();
    const board = await createBoard(user.id, "Fresh");
    expect(await typeNames(board.id)).toEqual([
      "Bug",
      "Documentation",
      "Review Code",
      "Tech Solution",
      "Testing",
      "UI/UX",
    ]);
    expect(await defaultType(board.id)).toBe("Tech Solution");
    expect((await getBoardView(user.id, board.id)).types).toHaveLength(6);
  });

  it("adds types (trimmed, unique in any case, up to the limit) — owners only", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const outsider = await makeUser("Outsider");
    await expect(
      createTaskType(owner.id, board.id, { name: "  Clothes ", tone: "pink" }),
    ).resolves.toMatchObject({ name: "Clothes", tone: "pink", isDefault: false });
    await expect(
      createTaskType(owner.id, board.id, { name: "clothes", tone: "red" }),
    ).rejects.toMatchObject({ status: 409, code: "duplicate_type" });
    await expect(
      createTaskType(owner.id, board.id, { name: "X", tone: "rainbow" }),
    ).rejects.toThrow();
    await expect(
      createTaskType(member.id, board.id, { name: "Food", tone: "teal" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createTaskType(outsider.id, board.id, { name: "Food", tone: "teal" }),
    ).rejects.toMatchObject({ status: 404 });

    for (let i = (await typeNames(board.id)).length; i < LIMITS.types; i++) {
      await createTaskType(owner.id, board.id, { name: `Extra ${i}`, tone: "gray" });
    }
    await expect(
      createTaskType(owner.id, board.id, { name: "One too many", tone: "gray" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("renames, recolors, and moves or clears the type for new tasks", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const ids = await typeIds(board.id);
    await updateTaskType(owner.id, board.id, ids.Bug, { name: "Defect", tone: "red" });
    await createTaskType(owner.id, board.id, { name: "Chore", tone: "slate", isDefault: true });
    expect(await defaultType(board.id)).toBe("Chore");
    expect((await listTaskTypes(board.id)).filter((t) => t.isDefault)).toHaveLength(1);

    const chore = (await typeIds(board.id)).Chore;
    await updateTaskType(owner.id, board.id, chore, { isDefault: false });
    expect(await defaultType(board.id)).toBeNull();

    await expect(
      updateTaskType(owner.id, board.id, ids.Testing, { name: "DEFECT" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateTaskType(member.id, board.id, ids.Testing, { name: "QA" }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await listTaskTypes(board.id)).find((t) => t.name === "Defect")?.tone).toBe("red");
  });

  it("deletes a type, moving its tasks (including deleted ones) to another type or none", async () => {
    const { owner, board } = await makeSharedBoard();
    const ids = await typeIds(board.id);
    await makeTask(owner.id, board.id, { title: "Crash", type: "Bug" });
    const binned = await makeTask(owner.id, board.id, { title: "Binned", type: "Bug" });
    await deleteTask(owner.id, board.id, binned.id);
    await makeTask(owner.id, board.id, { title: "Spec", type: "Documentation" });

    await deleteTaskType(owner.id, board.id, ids.Bug, ids.Testing);
    expect(await typeNames(board.id)).not.toContain("Bug");
    expect(await titlesWith(owner.id, board.id, "typeId", ids.Testing)).toEqual(["Crash"]);
    expect((await restoreTask(owner.id, board.id, binned.id)).typeId).toBe(ids.Testing);

    await deleteTaskType(owner.id, board.id, ids.Documentation);
    expect(await titlesWith(owner.id, board.id, "typeId", null)).toEqual(["Spec"]);
  });

  it("hands 'new tasks' to the destination, or leaves none", async () => {
    const { owner, board } = await makeSharedBoard();
    const ids = await typeIds(board.id);
    await deleteTaskType(owner.id, board.id, ids["Tech Solution"], ids.Bug);
    expect(await defaultType(board.id)).toBe("Bug");
    await deleteTaskType(owner.id, board.id, ids.Bug);
    expect(await defaultType(board.id)).toBeNull();
  });

  it("checks the destination, and allows removing every type", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const ids = await typeIds(board.id);
    const other = await createBoard(owner.id, "Other");
    const foreign = (await typeIds(other.id)).Bug;
    for (const moveTo of [foreign, ids.Bug, "not-a-uuid"]) {
      await expect(deleteTaskType(owner.id, board.id, ids.Bug, moveTo)).rejects.toMatchObject({
        status: 422,
      });
    }
    await expect(deleteTaskType(member.id, board.id, ids.Bug)).rejects.toMatchObject({
      status: 403,
    });
    for (const id of Object.values(ids)) await deleteTaskType(owner.id, board.id, id);
    expect(await listTaskTypes(board.id)).toEqual([]);
    await expect(makeTask(owner.id, board.id, { type: null })).resolves.toMatchObject({
      typeId: null,
    });
  });
});

describe("assignees (people)", () => {
  it("puts the creator and everyone who joins on the list, in their usual color", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const people = await listPeople(board.id);
    expect(people).toEqual([
      expect.objectContaining({
        name: "Max Member",
        userId: member.id,
        tone: assigneeTone(member.id),
      }),
      expect.objectContaining({
        name: "Olivia Owner",
        userId: owner.id,
        tone: assigneeTone(owner.id),
      }),
    ]);
  });

  it("adds people without accounts — unique names, up to the limit, owners only", async () => {
    const { owner, member, board } = await makeSharedBoard();
    await expect(
      createPerson(owner.id, board.id, { name: "  Mẹ ", tone: "pink" }),
    ).resolves.toMatchObject({ name: "Mẹ", tone: "pink", userId: null });
    await expect(
      createPerson(owner.id, board.id, { name: "max member", tone: "teal" }),
    ).rejects.toMatchObject({ status: 409, code: "duplicate_person" });
    await expect(
      createPerson(member.id, board.id, { name: "Lan", tone: "teal" }),
    ).rejects.toMatchObject({ status: 403 });

    for (let i = (await listPeople(board.id)).length; i < LIMITS.people; i++) {
      await createPerson(owner.id, board.id, { name: `Person ${i}`, tone: "gray" });
    }
    await expect(
      createPerson(owner.id, board.id, { name: "One too many", tone: "gray" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("renames and recolors anyone on the list, members included", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const ids = await personIds(board.id);
    await updatePerson(owner.id, board.id, ids["Max Member"], { name: "Max", tone: "forest" });
    expect(await listPeople(board.id)).toContainEqual(
      expect.objectContaining({ name: "Max", tone: "forest", userId: member.id }),
    );
    await expect(
      updatePerson(owner.id, board.id, ids["Olivia Owner"], { name: "MAX" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updatePerson(member.id, board.id, ids["Olivia Owner"], { name: "Liv" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("deletes someone, reassigning their tasks (including deleted ones) or unassigning them", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const mom = await createPerson(owner.id, board.id, { name: "Mẹ", tone: "pink" });
    const ids = await personIds(board.id);
    await makeTask(owner.id, board.id, { title: "Pack snacks", assignee: "Mẹ" });
    const binned = await makeTask(owner.id, board.id, { title: "Binned", assignee: "Mẹ" });
    await deleteTask(owner.id, board.id, binned.id);
    await makeTask(owner.id, board.id, { title: "Book hotel", assignee: "Max Member" });

    await deletePerson(owner.id, board.id, mom.id, ids["Olivia Owner"]);
    expect(await titlesWith(owner.id, board.id, "assigneeId", ids["Olivia Owner"])).toEqual([
      "Pack snacks",
    ]);
    expect((await restoreTask(owner.id, board.id, binned.id)).assigneeId).toBe(ids["Olivia Owner"]);

    // Removing a member from the list doesn't remove them from the board.
    await deletePerson(owner.id, board.id, ids["Max Member"]);
    expect(await titlesWith(owner.id, board.id, "assigneeId", null)).toEqual(["Book hotel"]);
    const view = await getBoardView(member.id, board.id);
    expect(view.people.map((p) => p.name)).toEqual(["Olivia Owner"]);

    for (const moveTo of [ids["Olivia Owner"], randomUUID(), "nope"]) {
      await expect(
        deletePerson(owner.id, board.id, ids["Olivia Owner"], moveTo),
      ).rejects.toMatchObject({ status: 422 });
    }
  });

  it("links an entry the owner added by name when that person joins", async () => {
    const owner = await makeUser("Olivia Owner", "olivia@example.com");
    const lan = await makeUser("Lan", "lan@example.com");
    const board = await createBoard(owner.id, "Trip");
    const added = await createPerson(owner.id, board.id, { name: "lan", tone: "teal" });
    const task = await makeTask(owner.id, board.id, { title: "Bring tent", assignee: "lan" });

    const invite = await createInvite(owner.id, board.id, { email: lan.email });
    await acceptInvite(lan, invite.token);

    const people = await listPeople(board.id);
    expect(people).toHaveLength(2);
    expect(people.find((p) => p.id === added.id)).toMatchObject({ userId: lan.id, tone: "teal" });
    const view = await getBoardView(lan.id, board.id);
    expect(view.tasks.find((t) => t.id === task.id)?.assigneeId).toBe(added.id);
  });

  it("tells two members with the same name apart, and doesn't duplicate anyone who rejoins", async () => {
    const { owner, member, board } = await makeSharedBoard();
    const namesake = await makeUser("Max Member", "max2@example.com");
    await acceptInvite(
      namesake,
      (await createInvite(owner.id, board.id, { email: namesake.email })).token,
    );
    expect((await listPeople(board.id)).map((p) => p.name)).toEqual([
      "Max Member",
      "Max Member (max2@example.com)",
      "Olivia Owner",
    ]);

    await removeMember(member.id, board.id, member.id);
    await acceptInvite(
      member,
      (await createInvite(owner.id, board.id, { email: member.email })).token,
    );
    expect(await listPeople(board.id)).toHaveLength(3);
  });
});
