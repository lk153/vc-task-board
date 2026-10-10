import { card, column, createTask, expect, expectAccessible, signUp, test } from "./support";

test.describe("search and filters", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, { name: "Fran Filter" });
    await createTask(page, { title: "Alpha crash", priority: "High", type: "Bug" });
    await createTask(page, { title: "Beta handbook", priority: "Low", type: "Documentation" });
    await createTask(page, {
      title: "Gamma refactor",
      description: "touches the alpha module",
      priority: "Medium",
      type: "Tech Solution",
      assignee: "Fran Filter",
    });
  });

  test("/ focuses search; matches title and description", async ({ page }) => {
    await page.locator("body").press("/");
    const search = page.getByRole("searchbox", { name: "Search tasks" });
    await expect(search).toBeFocused();

    await search.fill("ALPHA");
    await expect(card(page, "Alpha crash")).toBeVisible();
    await expect(card(page, "Gamma refactor")).toBeVisible(); // description match
    await expect(card(page, "Beta handbook")).toHaveCount(0);
    await expect(column(page, "To Do")).toContainText("2 of 3");

    await search.fill("nothing like this");
    await expect(column(page, "To Do")).toContainText("No matching tasks");

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(column(page, "To Do").locator("[data-card-id]")).toHaveCount(3);
  });

  test("dropdowns: OR within a group, AND across groups, clear, Esc closes", async ({ page }) => {
    await page.getByRole("button", { name: "Filters" }).click();
    const panel = page.locator("#board-filters");
    const todo = column(page, "To Do").locator("[data-card-id]");
    const priority = panel.getByRole("button", { name: /^Priority/ });
    await expect(priority).toHaveAccessibleName("Priority All priorities");
    await expectAccessible(page);

    // Several values in one group: the menu stays open between picks.
    await priority.click();
    const menu = page.getByRole("menu");
    await menu.getByRole("menuitemcheckbox", { name: "High" }).click();
    await expect(todo).toHaveCount(1);
    await menu.getByRole("menuitemcheckbox", { name: "Low" }).click();
    await expect(todo).toHaveCount(2);
    await expectAccessible(page);
    await page.keyboard.press("Escape"); // closes the menu, not the panel
    await expect(menu).toBeHidden();
    await expect(priority).toHaveAccessibleName("Priority Low, High");

    // Another group narrows the result (AND).
    await panel.getByRole("button", { name: /^Task type/ }).click();
    await page.getByRole("menuitemcheckbox", { name: "Documentation" }).click();
    await page.keyboard.press("Escape");
    await expect(todo).toHaveCount(1);
    await expect(card(page, "Beta handbook")).toBeVisible();
    await expect(page.getByRole("button", { name: "Filters (3 active)" })).toBeVisible();

    // Clear one group from its menu, then everything.
    await panel.getByRole("button", { name: /^Task type/ }).click();
    await page.getByRole("menuitem", { name: "Clear task type filter" }).click();
    await expect(todo).toHaveCount(2);
    await panel.getByRole("button", { name: "Clear all" }).click();
    await expect(todo).toHaveCount(3);
    await expect(priority).toHaveAccessibleName("Priority All priorities");

    await panel.getByRole("button", { name: /^Assignee/ }).click();
    await page.getByRole("menuitemcheckbox", { name: "Unassigned" }).click();
    await page.keyboard.press("Escape");
    await expect(todo).toHaveCount(2);
    await expect(card(page, "Gamma refactor")).toHaveCount(0);

    await page.locator("body").press("Escape");
    await expect(panel).toBeHidden();
  });
});
