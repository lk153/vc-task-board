import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { randomInt } from "node:crypto";

/** A different client IP per browser context, so auth rate limits don't leak between tests. */
const fakeIp = () => `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
    await use(context);
  },
});
export { expect };

export const PASSWORD = "e2e-password-1";

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now().toString(36)}${randomInt(1000, 9999)}@example.com`;

/** A second, independent user session (e.g. the person you invite). */
export async function newUserPage(
  browser: Browser,
  options: Parameters<Browser["newContext"]>[0] = {},
) {
  const context = await browser.newContext({
    ...options,
    extraHTTPHeaders: { "x-forwarded-for": fakeIp() },
  });
  return context.newPage();
}

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** Signs up through the real form. Without `next`, waits for the personal board. */
export async function signUp(
  page: Page,
  {
    name = "E2E User",
    email = uniqueEmail("user"),
    password = PASSWORD,
    next,
  }: Partial<Account> & { next?: string } = {},
): Promise<Account> {
  await page.goto(next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  if (!next) await expect(page.getByRole("heading", { level: 1 })).toHaveText("My board");
  return { name, email, password };
}

export async function signIn(page: Page, { email, password }: Pick<Account, "email" | "password">) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export const column = (page: Page, label: string) =>
  page.getByRole("region", { name: label, exact: true });
export const card = (scope: Page | Locator, title: string) =>
  scope.locator("[data-card-id]", { hasText: title });
export const editor = (page: Page) => page.getByRole("dialog");

export interface TaskFields {
  title: string;
  description?: string;
  status?: string;
  priority?: "Low" | "Medium" | "High" | "Critical";
  type?: string;
  assignee?: string;
  points?: string;
}

/** Fills the open task editor. */
export async function fillTask(page: Page, fields: Partial<TaskFields>) {
  const dialog = editor(page);
  if (fields.title !== undefined) await dialog.getByLabel("Title").fill(fields.title);
  if (fields.description !== undefined)
    await dialog.getByLabel("Description").fill(fields.description);
  if (fields.priority) await dialog.getByRole("radio", { name: fields.priority }).click();
  if (fields.status) await dialog.getByLabel("Status").selectOption({ label: fields.status });
  if (fields.type) await dialog.getByLabel("Task type").selectOption({ label: fields.type });
  if (fields.assignee) await dialog.getByLabel("Assignee").selectOption({ label: fields.assignee });
  if (fields.points !== undefined) await dialog.getByLabel("Story points").fill(fields.points);
}

/** Creates a task from the header "New task" button (desktop) and waits for its card. */
export async function createTask(page: Page, fields: TaskFields) {
  await page.getByRole("button", { name: "New task" }).click();
  await fillTask(page, fields);
  await editor(page).getByRole("button", { name: "Create task" }).click();
  await expect(editor(page)).toBeHidden();
  await expect(card(page, fields.title)).toBeVisible();
}

/**
 * Presses N until the editor opens. Right after a (re)load the page may not be
 * hydrated yet, so an early key press has no handler; once a dialog is open
 * further presses are ignored, so retrying is safe.
 */
export async function pressNewTaskShortcut(page: Page) {
  await expect(async () => {
    await page.locator("body").press("n");
    await expect(editor(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/** Fails on serious or critical WCAG 2 A/AA violations. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const problems = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
  expect(problems).toEqual([]);
}

/** Drags with real mouse movement (dnd-kit needs a few px before it starts). */
export async function dragTo(
  page: Page,
  source: Locator,
  target: Locator,
  where: "top" | "center" = "center",
) {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + from.height / 2 + 8, { steps: 4 });
  const y = where === "top" ? to.y + 6 : to.y + to.height / 2;
  await page.mouse.move(to.x + to.width / 2, y, { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/** Card titles in a column, top to bottom. */
export async function titlesIn(page: Page, columnLabel: string) {
  return column(page, columnLabel).locator("[data-card-id] > div:first-child").allTextContents();
}
