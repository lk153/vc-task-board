import {
  card,
  column,
  editor,
  expect,
  expectAccessible,
  fillTask,
  pressNewTaskShortcut,
  signUp,
  test,
} from "./support";

test.describe("create tasks", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Casey Creator" });
  });

  test("from the header, with every field, saved with Ctrl+Enter", async ({ page }) => {
    await page.getByRole("button", { name: "New task" }).click();
    const dialog = editor(page);
    await expect(dialog.getByRole("heading", { name: "New task" })).toBeVisible();
    await expect(dialog.getByLabel("Title")).toBeFocused();
    await expect(dialog.getByLabel("Status").locator("option:checked")).toHaveText("To Do");
    await expect(dialog.getByRole("radio", { name: "Medium" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expectAccessible(page);

    // Title is required.
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Give the task a title.");

    await fillTask(page, {
      title: "Spike CSV export",
      description: "Reporting pages need CSV",
      priority: "High",
      type: "Bug",
      assignee: "Casey Creator",
      points: "1.5",
    });
    await dialog.getByLabel("Title").press("Control+Enter");

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Task created in To Do",
    );
    const created = card(column(page, "To Do"), "Spike CSV export");
    await expect(created).toContainText("Reporting pages need CSV");
    await expect(created).toContainText("1.50");
    await expect(created).toContainText("Casey Creator");
    await expect(created).toContainText("High");
    await expect(created).toContainText("Bug");

    await page.reload();
    await expect(card(column(page, "To Do"), "Spike CSV export")).toBeVisible();
  });

  test("from a column's + button, preset to that status", async ({ page }) => {
    await page.getByRole("button", { name: "Add task to In Review" }).click();
    await expect(editor(page).getByLabel("Status").locator("option:checked")).toHaveText(
      "In Review",
    );
    await fillTask(page, { title: "Review the PR" });
    await editor(page).getByRole("button", { name: "Create task" }).click();
    await expect(card(column(page, "In Review"), "Review the PR")).toBeVisible();
  });

  test("from a column's Add task button", async ({ page }) => {
    await column(page, "Backlog").getByRole("button", { name: "Add task", exact: true }).click();
    await fillTask(page, { title: "Someday task" });
    await editor(page).getByRole("button", { name: "Create task" }).click();
    await expect(card(column(page, "Backlog"), "Someday task")).toBeVisible();
  });

  test("with the N shortcut, and Esc cancels", async ({ page }) => {
    await pressNewTaskShortcut(page);
    await expect(editor(page).getByRole("heading", { name: "New task" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor(page)).toBeHidden();

    await pressNewTaskShortcut(page);
    await fillTask(page, { title: "Made with N" });
    await editor(page).getByRole("button", { name: "Create task" }).click();
    await expect(card(column(page, "To Do"), "Made with N")).toBeVisible();
    await expectAccessible(page);
  });
});
