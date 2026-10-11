/**
 * Demo data for local development and Preview database branches.
 *
 *   pnpm db:seed           create whatever is missing; never changes existing data
 *   pnpm db:seed --reset   delete the Demo board (tasks, members, invites) and rebuild it
 *
 * Creates three demo accounts (password: 1234567890) sharing a "Demo board"
 * with the sample tasks from the design. Existing accounts keep their passwords.
 */
import { and, eq } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import type { CreateTaskInput } from "@/domain/task";
import { auth } from "@/server/auth";
import { insertDefaultStatuses, listStatuses } from "@/server/services/statuses";
import { db } from "@/server/db/client";
import { board, boardMember, task, user } from "@/server/db/schema";

if (process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed the Production database.");
  process.exit(1);
}

const reset = process.argv.includes("--reset");
const PASSWORD = "1234567890";
const DEMO_BOARD = "Demo board";
const people = {
  vtq: { name: "Viet Nguyen TQ", email: "viet@example.com" },
  vnn: { name: "Vu Nguyen Nguyen", email: "vu.nguyen@example.com" },
  vvq: { name: "Vu Vy Quoc", email: "vu.vy@example.com" },
} as const;
type Person = keyof typeof people;

/** `column` is the status name on the Demo board. */
type SeedTask = Omit<CreateTaskInput, "assigneeId" | "statusId"> & {
  column: string;
  assignee: Person | null;
};
const t = (
  column: string,
  title: string,
  description: string,
  assignee: Person | null,
  priority: SeedTask["priority"],
  type: SeedTask["type"],
  points: number | null,
): SeedTask => ({ column, title, description, assignee, priority, type, points });

// The sample tasks from design/design.html.
const tasks: SeedTask[] = [
  t(
    "To Do",
    "[Tech][Spike] CSV Download",
    "Propose solution for CSV download feature across reporting pages",
    "vnn",
    "high",
    "tech",
    null,
  ),
  t(
    "To Do",
    "[Kick-Off] Prepare Miro board on Inception Deck 2",
    "Reference others team Kick-off for technical alignment",
    "vtq",
    "high",
    "tech",
    null,
  ),
  t(
    "To Do",
    "[Kick-Off] Well-document on how A/N works as-is on OPUS",
    "",
    "vtq",
    "high",
    "tech",
    null,
  ),
  t(
    "To Do",
    "[Testing] Test Cases Workflow Efficiency",
    "Reason why fail with Gherkin Cucumber scenarios on CI",
    "vtq",
    "high",
    "testing",
    null,
  ),
  t("To Do", "[MDS] Knowledge Catchup", "", "vtq", "medium", "tech", null),
  t(
    "In Progress",
    "[Tech][Backend] Investigate data model integration",
    "",
    "vtq",
    "high",
    "tech",
    1,
  ),
  t(
    "In Progress",
    "[UI] Check MDS compatible with our system",
    "Check MDS compatible with our system and list the gaps",
    "vvq",
    "medium",
    "uiux",
    null,
  ),
  t("In Progress", "[Code] Fix Audit Issue braces package", "", "vtq", "critical", "review", null),
  t(
    "Backlog",
    "[Docs] Onboarding guide for new joiners",
    "Local setup, environments and release process",
    "vnn",
    "low",
    "docs",
    null,
  ),
  t(
    "In Review",
    "[Bug] Date picker loses timezone offset",
    "Selected date shifts by one day for UTC− users",
    "vvq",
    "high",
    "bug",
    2,
  ),
  t("Done", "[Setup] Configure CI pipeline for monorepo", "", "vtq", "medium", "tech", 3),
];

async function ensureUser(person: Person): Promise<{ id: string; created: boolean }> {
  const { name, email } = people[person];
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) return { id: existing.id, created: false };
  const created = await auth.api.signUpEmail({ body: { name, email, password: PASSWORD } });
  return { id: created.user.id, created: true };
}

async function findDemoBoard(ownerId: string) {
  const [row] = await db
    .select({ id: board.id })
    .from(board)
    .where(and(eq(board.name, DEMO_BOARD), eq(board.createdBy, ownerId)))
    .limit(1);
  return row;
}

async function createDemoBoard(ids: Record<Person, string>) {
  const [demo] = await db
    .insert(board)
    .values({ name: DEMO_BOARD, createdBy: ids.vtq })
    .returning({ id: board.id });
  await db.insert(boardMember).values([
    { boardId: demo.id, userId: ids.vtq, role: "owner" },
    { boardId: demo.id, userId: ids.vnn, role: "member" },
    { boardId: demo.id, userId: ids.vvq, role: "member" },
  ]);
  await insertDefaultStatuses(db, demo.id);
  for (const status of await listStatuses(demo.id)) {
    const column = tasks.filter((x) => x.column === status.name);
    if (column.length === 0) continue;
    const positions = generateNKeysBetween(null, null, column.length);
    await db.insert(task).values(
      column.map((item, i) => ({
        title: item.title,
        description: item.description,
        priority: item.priority,
        type: item.type,
        points: item.points,
        boardId: demo.id,
        statusId: status.id,
        assigneeId: item.assignee ? ids[item.assignee] : null,
        position: positions[i],
        createdBy: ids.vtq,
      })),
    );
  }
}

async function main() {
  const ids = {} as Record<Person, string>;
  const newAccounts: string[] = [];
  for (const person of Object.keys(people) as Person[]) {
    const { id, created } = await ensureUser(person);
    ids[person] = id;
    if (created) newAccounts.push(people[person].email);
  }
  console.log(
    newAccounts.length
      ? `Created accounts: ${newAccounts.join(", ")} (password: ${PASSWORD})`
      : "Demo accounts already exist — passwords left unchanged.",
  );

  const existing = await findDemoBoard(ids.vtq);
  if (existing && !reset) {
    console.log(`"${DEMO_BOARD}" already exists — left unchanged. Use --reset to rebuild it.`);
    return;
  }
  if (existing) {
    await db.delete(board).where(eq(board.id, existing.id));
    console.log(`Deleted the existing "${DEMO_BOARD}" (--reset).`);
  }
  await createDemoBoard(ids);
  console.log(`Created "${DEMO_BOARD}" with ${tasks.length} tasks and 3 members.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
