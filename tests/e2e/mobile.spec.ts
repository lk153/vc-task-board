import { card, editor, expect, expectAccessible, fillTask, signUp, test } from "./support";

test.describe("mobile layout (< 720px)", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Mo Bile" });
  });

  test("status tabs, floating + button, and a bottom-sheet editor", async ({ page }) => {
    const tabs = page.getByRole("navigation", { name: "Status" });
    await expect(tabs.getByRole("button", { name: /To Do/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("button", { name: "New task", exact: true })).toBeVisible(); // the FAB
    await expectAccessible(page);

    // FAB creates in the selected tab; the editor slides up from the bottom.
    await page.getByRole("button", { name: "New task", exact: true }).click();
    const sheet = editor(page);
    const bottom = async () => {
      const box = (await sheet.boundingBox())!;
      return Math.round(box.y + box.height);
    };
    await expect.poll(bottom).toBe(page.viewportSize()!.height);
    await fillTask(page, { title: "Phone task" });
    await sheet.getByRole("button", { name: "Create task" }).click();
    await expect(card(page, "Phone task")).toBeVisible();

    await tabs.getByRole("button", { name: /In Progress/ }).click();
    await expect(card(page, "Phone task")).toBeHidden();
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await expect(editor(page).getByLabel("Status")).toHaveValue("progress");
    await page.keyboard.press("Escape");
  });

  test("status changes go through the form (no dragging)", async ({ page }) => {
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await fillTask(page, { title: "Finish on phone" });
    await editor(page).getByRole("button", { name: "Create task" }).click();

    const created = card(page, "Finish on phone");
    await expect(created).not.toHaveAttribute("aria-label", /M to move/);

    await created.click();
    await fillTask(page, { status: "Done" });
    await editor(page).getByRole("button", { name: "Save changes" }).click();
    await expect(created).toBeHidden();

    await page
      .getByRole("navigation", { name: "Status" })
      .getByRole("button", { name: /Done/ })
      .click();
    await expect(card(page, "Finish on phone")).toBeVisible();
  });

  test("select several tasks and change their status at once", async ({ page }) => {
    for (const title of ["Phone A", "Phone B"]) {
      await page.getByRole("button", { name: "New task", exact: true }).click();
      await fillTask(page, { title });
      await editor(page).getByRole("button", { name: "Create task" }).click();
      await expect(card(page, title)).toBeVisible();
    }

    await page.getByRole("button", { name: "Select tasks" }).click();
    await expect(page.getByRole("button", { name: "New task", exact: true })).toBeHidden(); // FAB
    await card(page, "Phone A").click();
    await card(page, "Phone B").click();
    const bar = page.getByRole("toolbar", { name: "Selected tasks" });
    await expect(bar).toContainText("2 selected");
    await expectAccessible(page);

    await bar.getByRole("button", { name: "Move to" }).click();
    await page.getByRole("menuitem", { name: "In Progress" }).click();
    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Moved 2 tasks to In Progress",
    );
    await expect(card(page, "Phone A")).toBeHidden();

    await page
      .getByRole("navigation", { name: "Status" })
      .getByRole("button", { name: /In Progress/ })
      .click();
    await expect(card(page, "Phone A")).toBeVisible();
    await expect(card(page, "Phone B")).toBeVisible();
  });
});
