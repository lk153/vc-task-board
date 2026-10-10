import { card, column, createTask, editor, expect, fillTask, signUp, test } from "./support";

test.describe("edit tasks", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Eddie Editor" });
    await createTask(page, { title: "Draft release notes", priority: "Low" });
  });

  test("click a card, change fields and status", async ({ page }) => {
    await card(page, "Draft release notes").click();
    const dialog = editor(page);
    await expect(dialog.getByRole("heading", { name: "Edit task" })).toBeVisible();
    await expect(dialog.getByLabel("Title")).toHaveValue("Draft release notes");
    await expect(dialog.getByRole("radio", { name: "Low" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await fillTask(page, { title: "Publish release notes", status: "Done", priority: "Critical" });
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Changes saved",
    );
    const moved = card(column(page, "Done"), "Publish release notes");
    await expect(moved).toContainText("Critical");
    await expect(column(page, "To Do").locator("[data-card-id]")).toHaveCount(0);

    await page.reload();
    await expect(card(column(page, "Done"), "Publish release notes")).toBeVisible();
  });

  test("Enter on a focused card opens the editor; Cancel keeps it unchanged", async ({ page }) => {
    await card(page, "Draft release notes").focus();
    await page.keyboard.press("Enter");
    await fillTask(page, { title: "Should not be saved" });
    await editor(page).getByRole("button", { name: "Cancel" }).click();
    await expect(editor(page)).toBeHidden();
    await expect(card(page, "Draft release notes")).toBeVisible();
    await expect(card(page, "Should not be saved")).toHaveCount(0);
  });
});
