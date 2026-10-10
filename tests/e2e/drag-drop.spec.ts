import { card, column, createTask, dragTo, expect, signUp, test, titlesIn } from "./support";

test.describe("drag and drop (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Drew Dragger" });
    await createTask(page, { title: "Move me" });
    await createTask(page, { title: "Stay here" });
  });

  test("drags a card to another column", async ({ page }) => {
    await dragTo(page, card(page, "Move me"), column(page, "In Progress"));
    await expect(card(column(page, "In Progress"), "Move me")).toBeVisible();
    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Moved to In Progress",
    );

    await page.reload();
    await expect(card(column(page, "In Progress"), "Move me")).toBeVisible();
    await expect(card(column(page, "To Do"), "Stay here")).toBeVisible();
  });

  test("reorders within a column", async ({ page }) => {
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["Move me", "Stay here"]);
    await dragTo(page, card(page, "Stay here"), card(page, "Move me"), "top");
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["Stay here", "Move me"]);

    await page.reload();
    await expect.poll(() => titlesIn(page, "To Do")).toEqual(["Stay here", "Move me"]);
  });

  test("moves with the keyboard (M, arrows, Enter)", async ({ page }) => {
    const announcer = page.locator('[id^="DndLiveRegion"]');
    await card(page, "Move me").focus();
    await page.keyboard.press("m");
    await expect(announcer).toHaveText("Move me is over To Do.");
    // dnd-kit starts listening for arrow keys on the next tick after pick-up.
    await page.waitForTimeout(100);
    await page.keyboard.press("ArrowRight");
    await expect(announcer).toHaveText("Move me is over In Progress.");
    await page.keyboard.press("Enter");
    await expect(announcer).toHaveText("Move me was dropped in In Progress.");
    await expect(card(column(page, "In Progress"), "Move me")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden(); // Enter dropped, it didn't open the editor

    await page.reload();
    await expect(card(column(page, "In Progress"), "Move me")).toBeVisible();
  });
});
