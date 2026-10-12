import type { Page } from "@playwright/test";
import {
  card,
  createTask,
  editor,
  expect,
  expectAccessible,
  newUserPage,
  signUp,
  test,
  uniqueEmail,
} from "./support";

async function createBoard(page: Page, name: string) {
  await page.getByRole("button", { name: /Switch board/ }).click();
  await page.getByRole("menuitem", { name: "New board" }).click();
  await page.getByRole("dialog").getByLabel("Board name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Create board" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/** Owner creates an invite for `email` and returns the copied link. */
async function invite(page: Page, email: string) {
  await page.getByRole("button", { name: "Share board" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Invite by email").fill(email);
  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = await dialog.getByRole("textbox", { name: `Invite link for ${email}` }).inputValue();
  await dialog.getByRole("button", { name: "Close" }).click();
  return link;
}

test.describe("boards and sharing", () => {
  test("owner invites by link; member joins, collaborates, and is removed", async ({
    page,
    browser,
  }) => {
    await signUp(page, { name: "Olivia Owner" });
    await createBoard(page, "Launch plan");
    const boardUrl = page.url();
    const memberEmail = uniqueEmail("member");
    const link = await invite(page, memberEmail);
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

    // The invited person opens the link, creates an account with that email, and joins.
    const member = await newUserPage(browser);
    await member.goto(link);
    await expect(member.getByRole("heading", { name: "Join Launch plan" })).toBeVisible();
    await expectAccessible(member);
    await member.getByRole("link", { name: "Create an account" }).click();
    await signUp(member, { name: "Max Member", email: memberEmail, next: new URL(link).pathname });
    await member.getByRole("button", { name: "Join board" }).click();
    await expect(member.getByRole("heading", { level: 1 })).toHaveText("Launch plan");

    // Members can create tasks and assign them to each other; the owner sees them.
    // Only owners get the controls for editing task types and assignees.
    await member.getByRole("button", { name: "New task" }).click();
    await expect(
      editor(member).getByLabel("Assignee", { exact: true }).locator("option"),
    ).toHaveText(["Unassigned", "Max Member", "Olivia Owner"]);
    await expect(editor(member).getByRole("button", { name: "Edit assignees" })).toHaveCount(0);
    await member.keyboard.press("Escape");
    await createTask(member, { title: "Member's task", assignee: "Olivia Owner" });
    await page.reload();
    await expect(card(page, "Member's task")).toContainText("Olivia Owner");

    // Owner sees the member and removes them.
    await page.getByRole("button", { name: "Share board" }).click();
    const share = page.getByRole("dialog");
    await expect(share).toContainText("Max Member");
    await expectAccessible(page);
    await share.getByRole("button", { name: "Remove Max Member" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(share).not.toContainText("Max Member");

    // The removed member no longer has access.
    await member.goto(boardUrl);
    await expect(member.getByRole("heading", { name: "Board not found" })).toBeVisible();
  });

  test("a link only works for the invited email, and only once", async ({ page, browser }) => {
    await signUp(page, { name: "Olga Owner" });
    const invitedEmail = uniqueEmail("invited");
    const link = await invite(page, invitedEmail);

    const stranger = await newUserPage(browser);
    await signUp(stranger, { name: "Stan Stranger" });
    await stranger.goto(link);
    await expect(
      stranger.getByRole("heading", { name: "This invite is for another account" }),
    ).toBeVisible();

    const invited = await newUserPage(browser);
    await signUp(invited, { name: "Ivy Invited", email: invitedEmail });
    await invited.goto(link);
    await invited.getByRole("button", { name: "Join board" }).click();
    await expect(invited.getByRole("heading", { level: 1 })).toHaveText("My board");
    await invited.goto(link);
    await expect(
      invited.getByRole("heading", { name: "You’re a member of this board" }),
    ).toBeVisible();

    await stranger.goto(link);
    await expect(
      stranger.getByRole("heading", { name: "This invite link has already been used" }),
    ).toBeVisible();
  });

  test("members can leave; owners rename and delete boards", async ({ page, browser }) => {
    await signUp(page, { name: "Rhea Renamer" });
    await createBoard(page, "Temp board");
    const memberEmail = uniqueEmail("leaver");
    const link = await invite(page, memberEmail);

    const member = await newUserPage(browser);
    await signUp(member, { name: "Leo Leaver", email: memberEmail });
    await member.goto(link);
    await member.getByRole("button", { name: "Join board" }).click();
    await expect(member.getByRole("heading", { level: 1 })).toHaveText("Temp board");
    await member.getByRole("button", { name: "Share board" }).click();
    await member.getByRole("dialog").getByRole("button", { name: "Leave" }).click();
    await member.getByRole("alertdialog").getByRole("button", { name: "Leave board" }).click();
    await expect(member.getByRole("heading", { level: 1 })).toHaveText("My board");

    await page.getByRole("button", { name: /Switch board/ }).click();
    await page.getByRole("menuitem", { name: "Rename board" }).click();
    await page.getByRole("dialog").getByLabel("Board name").fill("Renamed board");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Renamed board");

    await page.getByRole("button", { name: /Switch board/ }).click();
    await page.getByRole("menuitem", { name: "Delete board" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete board" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
  });
});
