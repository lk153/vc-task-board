import {
  expect,
  expectAccessible,
  newUserPage,
  PASSWORD,
  signIn,
  signUp,
  test,
  uniqueEmail,
} from "./support";

test.describe("email + password accounts", () => {
  test("sign up lands on a personal board; sign out and back in", async ({ page }) => {
    await page.goto("/sign-in");
    await expectAccessible(page);

    const account = await signUp(page, { name: "Pat Example" });
    await expect(page.getByText("0 tasks")).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menu")).toContainText(account.email);
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await signIn(page, account);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
  });

  test("shows clear errors for a wrong password and a taken email", async ({ page, browser }) => {
    const account = await signUp(page);

    const other = await newUserPage(browser);
    await signIn(other, { email: account.email, password: "not-the-password" });
    await expect(other.getByRole("main").getByRole("alert")).toHaveText("Wrong email or password.");

    await other.goto("/sign-up");
    await other.getByLabel("Name", { exact: true }).fill("Copy Cat");
    await other.getByLabel("Email", { exact: true }).fill(account.email);
    await other.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await other.getByRole("button", { name: "Create account" }).click();
    await expect(other.getByRole("main").getByRole("alert")).toContainText("already exists");
  });

  test("validates the sign-up form before submitting", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter your name.");
    await page.getByLabel("Name", { exact: true }).fill("Short Pw");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("short"));
    await page.getByLabel("Password", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Use at least 8 characters for your password.",
    );
  });

  test("changes the password", async ({ page, browser }) => {
    const account = await signUp(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Change password" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Current password").fill(account.password);
    await dialog.getByLabel("New password").fill("a-brand-new-password");
    await dialog.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("status", { name: "Notifications" })).toContainText(
      "Password changed",
    );

    const other = await newUserPage(browser);
    await signIn(other, account);
    await expect(other.getByRole("main").getByRole("alert")).toHaveText("Wrong email or password.");
    await signIn(other, { email: account.email, password: "a-brand-new-password" });
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("My board");
  });

  test("sends signed-out visitors to sign in and back", async ({ page }) => {
    const account = await signUp(page);
    const boardPath = new URL(page.url()).pathname;
    await page.context().clearCookies();

    await page.goto(boardPath);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`${boardPath}$`));
  });

  test("rate-limits repeated sign-in attempts", async ({ page }) => {
    const email = uniqueEmail("ratelimit");
    await page.goto("/sign-in");
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill("wrong-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    }
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(/Too many attempts/);
  });
});
