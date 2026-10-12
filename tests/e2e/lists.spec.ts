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
} from "./support";

const toast = (page: Page) => page.getByRole("status", { name: "Notifications" });

/** Opens "Task types" or "Assignees" from the board menu. */
async function openFromBoardMenu(page: Page, item: "Task types" | "Assignees") {
  await page.getByRole("button", { name: /^Board:/ }).click();
  await page.getByRole("menuitem", { name: item }).click();
  return page.getByRole("dialog");
}

test.describe("task types and assignees (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Tia Types" });
  });

  test("owners add, rename and delete task types; new tasks get the default", async ({ page }) => {
    // From the Task type filter dropdown.
    await page.getByRole("button", { name: "Filters" }).click();
    await page
      .locator("#board-filters")
      .getByRole("button", { name: /^Task type/ })
      .click();
    await page.getByRole("menuitem", { name: "Edit task types…" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Task types" })).toBeVisible();
    await expect(dialog.getByRole("listitem")).toHaveCount(6);
    await expectAccessible(page);

    // Add one as the type for new tasks.
    await dialog.getByRole("button", { name: "Add type" }).click();
    await dialog.getByLabel("Name").fill("Clothes");
    await dialog.getByRole("radio", { name: "Pink" }).click();
    await dialog.getByLabel("Use for new tasks").check();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Add type" }).click();
    await expect(toast(page)).toContainText("Added “Clothes”");
    const row = (name: string) => dialog.getByRole("listitem").filter({ hasText: name });
    await expect(row("Clothes")).toContainText("New tasks");
    await expect(row("Tech Solution")).not.toContainText("New tasks");

    // Names are unique, whatever the capitalisation.
    await dialog.getByRole("button", { name: "Add type" }).click();
    await dialog.getByLabel("Name").fill("clothes");
    await dialog.getByRole("button", { name: "Add type" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "There's already a task type called “Clothes”",
    );
    await dialog.getByRole("button", { name: "Back" }).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();

    // New tasks start with the default type.
    await page.getByRole("button", { name: "New task" }).click();
    await expect(
      editor(page).getByLabel("Task type", { exact: true }).locator("option:checked"),
    ).toHaveText("Clothes");
    await editor(page).getByLabel("Title").fill("Pack a jacket");
    await editor(page).getByRole("button", { name: "Create task" }).click();
    await expect(card(page, "Pack a jacket")).toContainText("Clothes");

    // Rename it from inside the task editor, then carry on editing.
    await card(page, "Pack a jacket").click();
    const taskDialog = page.getByRole("dialog", { name: "Edit task" });
    await taskDialog.getByRole("button", { name: "Edit task types" }).click();
    const lists = page.getByRole("dialog").last();
    await lists.getByRole("button", { name: "Edit Clothes" }).click();
    await lists.getByLabel("Name").fill("Apparel");
    await lists.getByRole("button", { name: "Save" }).click();
    await lists.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(
      taskDialog.getByLabel("Task type", { exact: true }).locator("option:checked"),
    ).toHaveText("Apparel");
    await taskDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(card(page, "Pack a jacket")).toContainText("Apparel");

    // Delete it, moving its task to another type.
    const manager = await openFromBoardMenu(page, "Task types");
    await manager.getByRole("button", { name: "Delete Apparel" }).click();
    await expect(manager).toContainText("“Apparel” will be removed");
    await manager.getByLabel("Change its 1 task to").selectOption({ label: "Bug" });
    await expect(manager).toContainText("New tasks will get “Bug”");
    await expectAccessible(page);
    await manager.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(toast(page)).toContainText("Deleted “Apparel” · 1 task changed to “Bug”");
    await manager.getByRole("button", { name: "Done" }).click();
    await expect(card(page, "Pack a jacket")).toContainText("Bug");

    // Saved on the server; "Bug" took over as the type for new tasks.
    await page.reload();
    await expect(card(page, "Pack a jacket")).toContainText("Bug");
    await pressNewTaskShortcut(page);
    await expect(
      editor(page).getByLabel("Task type", { exact: true }).locator("option:checked"),
    ).toHaveText("Bug");
  });

  test("owners add people without accounts, rename them, and remove them", async ({ page }) => {
    const dialog = await openFromBoardMenu(page, "Assignees");
    await expect(dialog.getByRole("listitem")).toHaveCount(1);
    await expect(dialog.getByRole("listitem")).toContainText("Tia Types");
    await expect(dialog.getByRole("listitem")).toContainText("Member");

    await dialog.getByRole("button", { name: "Add person" }).click();
    await dialog.getByLabel("Name").fill("Mẹ");
    await dialog.getByRole("button", { name: "Add person" }).click();
    await expect(dialog.getByRole("listitem")).toHaveCount(2);
    await dialog.getByRole("button", { name: "Done" }).click();

    await createTask(page, { title: "Buy sunscreen", assignee: "Mẹ" });
    await createTask(page, { title: "Book hotel", assignee: "Tia Types" });
    await expect(card(page, "Buy sunscreen")).toContainText("Mẹ");

    // Filter by the new person.
    await page.getByRole("button", { name: "Filters" }).click();
    const assignee = page.locator("#board-filters").getByRole("button", { name: /^Assignee/ });
    const todo = column(page, "To Do").locator("[data-card-id]");
    await assignee.click();
    await page.getByRole("menuitemcheckbox", { name: "Mẹ" }).click();
    await page.keyboard.press("Escape");
    await expect(todo).toHaveCount(1);

    // Renaming updates the cards and the filter.
    await assignee.click();
    await page.getByRole("menuitem", { name: "Edit assignees…" }).click();
    await dialog.getByRole("button", { name: "Edit Mẹ" }).click();
    await dialog.getByLabel("Name").fill("Mom");
    await dialog.getByRole("button", { name: "Save" }).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(card(page, "Buy sunscreen")).toContainText("Mom");
    await expect(assignee).toHaveAccessibleName("Assignee Mom");

    // Deleting unassigns their task, and the filter forgets them.
    await assignee.click();
    await page.getByRole("menuitem", { name: "Edit assignees…" }).click();
    await dialog.getByRole("button", { name: "Delete Mom" }).click();
    await expect(
      dialog.getByLabel("Reassign their 1 task to").locator("option:checked"),
    ).toHaveText("Unassigned");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(todo).toHaveCount(2);
    await expect(card(page, "Buy sunscreen")).not.toContainText("Mom");
    await expect(assignee).toHaveAccessibleName("Assignee Anyone");

    await page.reload();
    await expect(card(page, "Book hotel")).toContainText("Tia Types");
    await expect(card(page, "Buy sunscreen")).not.toContainText("Mom");
  });
});
