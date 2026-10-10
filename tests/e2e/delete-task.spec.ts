import {
  card,
  createTask,
  editor,
  expect,
  expectAccessible,
  signUp,
  test,
  titlesIn,
} from "./support";

test.describe("delete tasks", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Dana Deleter" });
    for (const title of ["First", "Second", "Third"]) await createTask(page, { title });
  });

  test("trash icon → confirm → Undo puts it back in the same place", async ({ page }) => {
    const second = card(page, "Second");
    await second.hover();
    await page.getByRole("button", { name: "Delete task: Second" }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("“Second” will be removed from the board.");
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await expectAccessible(page);
    await confirm.getByRole("button", { name: "Delete task" }).click();

    await expect(card(page, "Second")).toHaveCount(0);
    await expect(page.getByRole("status", { name: "Notifications" })).toContainText("Task deleted");
    await page.getByRole("button", { name: "Undo" }).click();

    await expect(card(page, "Second")).toBeVisible();
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["First", "Second", "Third"]);
    await page.reload();
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["First", "Second", "Third"]);
  });

  test("Cancel keeps the task", async ({ page }) => {
    await card(page, "First").hover();
    await page.getByRole("button", { name: "Delete task: First" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    await expect(card(page, "First")).toBeVisible();
  });

  test("Delete key on a focused card", async ({ page }) => {
    await card(page, "Third").focus();
    await page.keyboard.press("Delete");
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete task" }).click();
    await expect(card(page, "Third")).toHaveCount(0);
    await page.reload();
    await expect(card(page, "Third")).toHaveCount(0);
  });

  test("Delete button in the editor", async ({ page }) => {
    await card(page, "First").click();
    await editor(page).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete task" }).click();
    await expect(editor(page)).toBeHidden();
    await expect(card(page, "First")).toHaveCount(0);
  });
});
