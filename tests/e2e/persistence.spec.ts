import { card, createTask, expect, newUserPage, signIn, signUp, test } from "./support";

test.describe("saved on the server", () => {
  test("tasks survive a reload and show up on another device", async ({ page, browser }) => {
    const account = await signUp(page, { name: "Sam Synced" });
    await createTask(page, { title: "Saved on the server" });
    await page.reload();
    await expect(card(page, "Saved on the server")).toBeVisible();

    const otherDevice = await newUserPage(browser);
    await signIn(otherDevice, account);
    await expect(card(otherDevice, "Saved on the server")).toBeVisible();

    // A change on one device appears on the other without reloading (polling).
    await createTask(otherDevice, { title: "Made on the other device" });
    await expect(card(page, "Made on the other device")).toBeVisible({ timeout: 25_000 });
  });

  test("nothing is written to localStorage", async ({ page }) => {
    await signUp(page);
    await createTask(page, { title: "No local storage" });
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
  });
});
