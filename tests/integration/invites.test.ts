import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { boardInvite } from "@/server/db/schema";
import { createBoard, getBoardView, listBoards } from "@/server/services/boards";
import {
  acceptInvite,
  cancelInvite,
  createInvite,
  lookupInvite,
  maskEmail,
} from "@/server/services/invites";
import { makeUser } from "./support/fixtures";

async function setup() {
  const owner = await makeUser("Olivia Owner", "owner@example.com");
  const board = await createBoard(owner.id, "Launch");
  return { owner, board };
}

describe("invites", () => {
  it("lets the invited email join through the link", async () => {
    const { owner, board } = await setup();
    const invite = await createInvite(owner.id, board.id, { email: "  Bea@Example.com " });
    expect(invite.email).toBe("bea@example.com");
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(await lookupInvite(invite.token)).toMatchObject({
      status: "valid",
      boardName: "Launch",
      inviterName: "Olivia Owner",
    });

    const bea = await makeUser("Bea", "bea@example.com");
    await expect(acceptInvite(bea, invite.token)).resolves.toEqual({ boardId: board.id });
    expect(await listBoards(bea.id)).toEqual([{ id: board.id, name: "Launch", role: "member" }]);
    expect((await lookupInvite(invite.token)).status).toBe("used");
  });

  it("matches the email case-insensitively", async () => {
    const { owner, board } = await setup();
    const invite = await createInvite(owner.id, board.id, { email: "bea@example.com" });
    const bea = await makeUser("Bea", "Bea@Example.com");
    await expect(acceptInvite(bea, invite.token)).resolves.toEqual({ boardId: board.id });
  });

  it("rejects a forwarded link opened by a different account", async () => {
    const { owner, board } = await setup();
    const invite = await createInvite(owner.id, board.id, { email: "bea@example.com" });
    const eve = await makeUser("Eve", "eve@example.com");
    await expect(acceptInvite(eve, invite.token)).rejects.toMatchObject({
      status: 403,
      code: "wrong_account",
      message: expect.stringContaining("b•••@example.com"),
    });
    expect(await listBoards(eve.id)).toEqual([]);
  });

  it("works once: a second account can't reuse it, the same one can retry", async () => {
    const { owner, board } = await setup();
    const invite = await createInvite(owner.id, board.id, { email: "bea@example.com" });
    const bea = await makeUser("Bea", "bea@example.com");
    await acceptInvite(bea, invite.token);
    await expect(acceptInvite(bea, invite.token)).resolves.toEqual({ boardId: board.id });

    const other = await makeUser("Other", "other@example.com");
    await expect(acceptInvite(other, invite.token)).rejects.toMatchObject({
      status: 410,
      code: "invite_used",
    });
  });

  it("expires", async () => {
    const { owner, board } = await setup();
    const invite = await createInvite(owner.id, board.id, { email: "bea@example.com" });
    await db
      .update(boardInvite)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(boardInvite.id, invite.id));
    const bea = await makeUser("Bea", "bea@example.com");

    expect((await lookupInvite(invite.token)).status).toBe("expired");
    await expect(acceptInvite(bea, invite.token)).rejects.toMatchObject({
      status: 410,
      code: "invite_expired",
    });
    expect((await getBoardView(owner.id, board.id)).invites).toEqual([]);
  });

  it("can be cancelled", async () => {
    const { owner, board } = await setup();
    const invite = await createInvite(owner.id, board.id, { email: "bea@example.com" });
    await cancelInvite(owner.id, board.id, invite.id);
    const bea = await makeUser("Bea", "bea@example.com");
    expect((await lookupInvite(invite.token)).status).toBe("not_found");
    await expect(acceptInvite(bea, invite.token)).rejects.toMatchObject({ status: 404 });
  });

  it("replaces the old link when inviting the same email again", async () => {
    const { owner, board } = await setup();
    const first = await createInvite(owner.id, board.id, { email: "bea@example.com" });
    const second = await createInvite(owner.id, board.id, { email: "bea@example.com" });
    expect(second.token).not.toBe(first.token);
    expect((await lookupInvite(first.token)).status).toBe("not_found");
    expect((await getBoardView(owner.id, board.id)).invites).toHaveLength(1);
  });

  it("refuses to invite an existing member or a bad email", async () => {
    const { owner, board } = await setup();
    await expect(
      createInvite(owner.id, board.id, { email: "OWNER@example.com" }),
    ).rejects.toMatchObject({ status: 409, code: "already_member" });
    await expect(createInvite(owner.id, board.id, { email: "not-an-email" })).rejects.toThrow(
      "Enter a valid email address.",
    );
  });

  it("treats garbage tokens as not found", async () => {
    const bea = await makeUser("Bea", "bea@example.com");
    expect((await lookupInvite("short")).status).toBe("not_found");
    await expect(acceptInvite(bea, "x".repeat(43))).rejects.toMatchObject({ status: 404 });
  });

  it("masks emails", () => {
    expect(maskEmail("alex@company.com")).toBe("a•••@company.com");
  });
});
