import { expect, newUserPage, signUp, test } from "./support";

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const LIGHT_BG = "rgb(247, 247, 248)";
const DARK_BG = "rgb(17, 17, 21)";

test.describe("dark / light mode", () => {
  test("starts from the system setting", async ({ browser }) => {
    const dark = await newUserPage(browser, { colorScheme: "dark" });
    await dark.goto("/sign-in");
    expect(await background(dark)).toBe(DARK_BG);

    const light = await newUserPage(browser, { colorScheme: "light" });
    await light.goto("/sign-in");
    expect(await background(light)).toBe(LIGHT_BG);
  });

  test("the toggle overrides the system setting and is remembered", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await signUp(page);
    await expect.poll(() => background(page)).toBe(DARK_BG);

    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect.poll(() => background(page)).toBe(LIGHT_BG);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "tb-theme")?.value).toBe("light");

    await page.reload();
    expect(await page.locator("html").getAttribute("data-theme")).toBe("light");
    await expect.poll(() => background(page)).toBe(LIGHT_BG);
  });
});
