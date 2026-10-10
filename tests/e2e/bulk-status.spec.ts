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

test.describe("bulk status change (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Bea Bulk" });
    for (const title of ["One", "Two", "Three", "Four"]) await createTask(page, { title });
  });

  test("select several tasks and move them to a status at once", async ({ page }) => {
    await page.getByRole("button", { name: "Select tasks" }).click();
    const bar = page.getByRole("toolbar", { name: "Selected tasks" });
    await expect(bar).toContainText("0 selected");
    await expect(bar.getByRole("button", { name: "Move to" })).toBeDisabled();

    // In selection mode a click selects instead of opening the editor.
    await card(page, "One").click();
    await card(page, "Three").click();
    await expect(editor(page)).toBeHidden();
    await expect(card(page, "One")).toHaveAttribute("aria-pressed", "true");
    await expect(card(page, "Two")).toHaveAttribute("aria-pressed", "false");
    await expect(bar).toContainText("2 selected");
    await expectAccessible(page);

    await bar.getByRole("button", { name: "Move to" }).click();
    await page.getByRole("menuitem", { name: "Done" }).click();

    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Moved 2 tasks to Done",
    );
    await expect(bar).toBeHidden();
    await expect.poll(() => titlesIn(page, "Done")).toEqual(["One", "Three"]);
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["Two", "Four"]);

    await page.reload();
    await expect.poll(() => titlesIn(page, "Done")).toEqual(["One", "Three"]);
  });

  test("Undo puts every task back where it was", async ({ page }) => {
    await page.getByRole("button", { name: "Select tasks" }).click();
    await card(page, "Two").click();
    await card(page, "Four").click();
    await page.getByRole("button", { name: "Move to" }).click();
    await page.getByRole("menuitem", { name: "In Review" }).click();
    await expect.poll(() => titlesIn(page, "In Review")).toEqual(["Two", "Four"]);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["One", "Two", "Three", "Four"]);
    await page.reload();
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["One", "Two", "Three", "Four"]);
  });

  test("X and Ctrl/⌘-click select; Select all, Clear, and Esc leaves selection mode", async ({
    page,
  }) => {
    await card(page, "One").focus();
    await page.keyboard.press("x");
    const bar = page.getByRole("toolbar", { name: "Selected tasks" });
    await expect(bar).toContainText("1 selected");

    await card(page, "Three").click({ modifiers: ["ControlOrMeta"] });
    await expect(bar).toContainText("2 selected");

    await bar.getByRole("button", { name: "Select all" }).click();
    await expect(bar).toContainText("4 selected");
    await bar.getByRole("button", { name: "Clear" }).click();
    await expect(bar).toContainText("0 selected");

    await page.locator("body").press("Escape");
    await expect(bar).toBeHidden();
    await card(page, "Two").click(); // back to normal: opens the editor
    await expect(editor(page).getByRole("heading", { name: "Edit task" })).toBeVisible();
  });
});
