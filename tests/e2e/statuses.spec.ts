import type { Page } from "@playwright/test";
import {
  card,
  column,
  createTask,
  editor,
  expect,
  expectAccessible,
  pressNewTaskShortcut,
  signUp,
  test,
  titlesIn,
} from "./support";

/** Column names, left to right. */
const columnNames = (page: Page) =>
  page
    .locator("main section")
    .evaluateAll((sections) => sections.map((s) => s.getAttribute("aria-label")));

const statusMenu = (page: Page, name: string) =>
  page.getByRole("button", { name: `Options for ${name}` });

test.describe("manage statuses (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Sasha Status" });
  });

  test("add, rename and recolor, move, and choose the column for new tasks", async ({ page }) => {
    // Add
    await page.getByRole("button", { name: "Add status" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add status" })).toBeVisible();
    await dialog.getByLabel("Name").fill("Blocked");
    await dialog.getByRole("radio", { name: "Red" }).click();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Add status" }).click();
    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Added “Blocked”",
    );
    await expect
      .poll(() => columnNames(page))
      .toEqual(["Backlog", "To Do", "In Progress", "In Review", "Done", "Blocked"]);

    // Duplicate names are refused
    await page.getByRole("button", { name: "Add status" }).click();
    await dialog.getByLabel("Name").fill("done");
    await dialog.getByRole("button", { name: "Add status" }).click();
    await expect(dialog.getByRole("alert")).toContainText("There's already a status called “Done”");
    await page.keyboard.press("Escape");

    // Rename + recolor
    await statusMenu(page, "Blocked").click();
    await page.getByRole("menuitem", { name: "Edit status" }).click();
    await dialog.getByLabel("Name").fill("Waiting");
    await dialog.getByRole("radio", { name: "Purple" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(column(page, "Waiting")).toBeVisible();

    // Move left
    await statusMenu(page, "Waiting").click();
    await page.getByRole("menuitem", { name: "Move left" }).click();
    await expect
      .poll(() => columnNames(page))
      .toEqual(["Backlog", "To Do", "In Progress", "In Review", "Waiting", "Done"]);

    // New tasks (header button and N) go to the chosen column
    await statusMenu(page, "Backlog").click();
    await page.getByRole("menuitem", { name: "Use for new tasks" }).click();
    await createTask(page, { title: "Lands in backlog" });
    await expect(card(column(page, "Backlog"), "Lands in backlog")).toBeVisible();

    await page.reload();
    await expect
      .poll(() => columnNames(page))
      .toEqual(["Backlog", "To Do", "In Progress", "In Review", "Waiting", "Done"]);
    await pressNewTaskShortcut(page);
    await expect(editor(page).getByLabel("Status").locator("option:checked")).toHaveText("Backlog");
  });

  test("deleting a status removes its column and moves its tasks", async ({ page }) => {
    await createTask(page, { title: "Already done" });
    await createTask(page, { title: "Review me", status: "In Review" });
    await createTask(page, { title: "Review me too", status: "In Review" });
    // Move "Already done" to Done first.
    await card(page, "Already done").click();
    await editor(page).getByLabel("Status").selectOption({ label: "Done" });
    await editor(page).getByRole("button", { name: "Save changes" }).click();

    await statusMenu(page, "In Review").click();
    await page.getByRole("menuitem", { name: "Delete status" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Delete “In Review”?" })).toBeVisible();
    await dialog.getByLabel("Move its 2 tasks to").selectOption({ label: "Done" });
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Delete status" }).click();

    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Deleted “In Review” · 2 tasks moved to “Done”",
    );
    await expect(column(page, "In Review")).toHaveCount(0);
    await expect
      .poll(() => titlesIn(page, "Done"))
      .toEqual(["Already done", "Review me", "Review me too"]);

    await page.reload();
    await expect.poll(() => columnNames(page)).toEqual(["Backlog", "To Do", "In Progress", "Done"]);
    await expect
      .poll(() => titlesIn(page, "Done"))
      .toEqual(["Already done", "Review me", "Review me too"]);
  });

  test("an empty column is deleted without asking where tasks go", async ({ page }) => {
    await statusMenu(page, "Backlog").click();
    await page.getByRole("menuitem", { name: "Delete status" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("It has no tasks.");
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Delete status" }).click();
    await expect
      .poll(() => columnNames(page))
      .toEqual(["To Do", "In Progress", "In Review", "Done"]);
  });
});
