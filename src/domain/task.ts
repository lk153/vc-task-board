import { z } from "zod";
import { LIMITS, PRIORITIES, TONES, type Tone } from "@/config/board";

export type Priority = (typeof PRIORITIES)[number]["id"];
export type Role = "owner" | "member";

const ids = <T extends { id: string }>(list: readonly T[]) =>
  list.map((item) => item.id) as [T["id"], ...T["id"][]];

/** A status (column) id on the same board. */
export const statusIdSchema = z.uuid("Unknown status.");
export const prioritySchema = z.enum(ids(PRIORITIES));
/** A task type on the same board. */
export const typeIdSchema = z.uuid("Unknown task type.");
/** A person on the same board's assignee list. */
export const personIdSchema = z.uuid("Unknown assignee.");

/** fractional-indexing keys are base-62 strings. */
export const positionSchema = z.string().regex(/^[0-9A-Za-z]{1,128}$/, "Invalid position");

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Give the task a title.")
  .max(LIMITS.title, `Keep the title under ${LIMITS.title} characters.`);

export const pointsSchema = z.number().finite().min(0).max(LIMITS.points).nullable();

const taskFields = {
  title: titleSchema,
  description: z.string().trim().max(LIMITS.description),
  statusId: statusIdSchema,
  priority: prioritySchema,
  typeId: typeIdSchema.nullable(),
  assigneeId: personIdSchema.nullable(),
  points: pointsSchema,
};

export const createTaskSchema = z.object({
  id: z.uuid().optional(),
  ...taskFields,
  description: taskFields.description.default(""),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({ ...taskFields, position: positionSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Bulk status change (and its Undo). At most 500 tasks per request, no duplicates. */
export const bulkMoveSchema = z.object({
  tasks: z
    .array(
      z.object({ id: z.uuid(), statusId: statusIdSchema, position: positionSchema.optional() }),
    )
    .min(1, "Select at least one task.")
    .max(500, "Move at most 500 tasks at a time.")
    .refine((list) => new Set(list.map((t) => t.id)).size === list.length, "Duplicate task ids."),
});
export type BulkMoveInput = z.infer<typeof bulkMoveSchema>;

export const statusNameSchema = z
  .string()
  .trim()
  .min(1, "Give the status a name.")
  .max(LIMITS.statusName, `Keep the name under ${LIMITS.statusName} characters.`);

export const createStatusSchema = z.object({ name: statusNameSchema, tone: z.enum(TONES) });

/** Rename, recolor, reorder, or make it the column for new tasks. */
export const updateStatusSchema = z
  .object({
    name: statusNameSchema,
    tone: z.enum(TONES),
    position: positionSchema,
    isDefault: z.literal(true),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const typeNameSchema = z
  .string()
  .trim()
  .min(1, "Give the type a name.")
  .max(LIMITS.typeName, `Keep the name under ${LIMITS.typeName} characters.`);

export const createTaskTypeSchema = z.object({
  name: typeNameSchema,
  tone: z.enum(TONES),
  isDefault: z.boolean().optional(),
});

/** Rename, recolor, or set / unset it as the type for new tasks. */
export const updateTaskTypeSchema = z
  .object({ name: typeNameSchema, tone: z.enum(TONES), isDefault: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const personNameSchema = z
  .string()
  .trim()
  .min(1, "Give the person a name.")
  .max(LIMITS.personName, `Keep the name under ${LIMITS.personName} characters.`);

export const createPersonSchema = z.object({ name: personNameSchema, tone: z.enum(TONES) });

export const updatePersonSchema = z
  .object({ name: personNameSchema, tone: z.enum(TONES) })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const boardNameSchema = z
  .string()
  .trim()
  .min(1, "Give the board a name.")
  .max(LIMITS.boardName, `Keep the name under ${LIMITS.boardName} characters.`);

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(LIMITS.email)),
});

export interface Task {
  id: string;
  boardId: string;
  title: string;
  description: string;
  statusId: string;
  priority: Priority;
  /** A task type on this board, or none. */
  typeId: string | null;
  /** A person on this board's assignee list, or nobody. */
  assigneeId: string | null;
  points: number | null;
  position: string;
  createdAt: string;
  updatedAt: string;
}

/** A board column. */
export interface BoardStatus {
  id: string;
  name: string;
  tone: Tone;
  position: string;
  /** Where "New task" and the N key put new tasks. */
  isDefault: boolean;
}

/** A task type. Each board has its own list, managed by its owners. */
export interface BoardTaskType {
  id: string;
  name: string;
  tone: Tone;
  /** Given to new tasks. At most one per board; there may be none. */
  isDefault: boolean;
}

/**
 * Someone tasks can be assigned to. Each board has its own list, managed by
 * its owners. People don't need an account; members are added automatically
 * (linked by `userId`) when they create or join the board.
 */
export interface BoardPerson {
  id: string;
  name: string;
  tone: Tone;
  userId: string | null;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
}

export interface Invite {
  id: string;
  email: string;
  token: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
}

export interface BoardSummary {
  id: string;
  name: string;
  role: Role;
}

/** Everything the board screen needs, returned by GET /api/boards/:boardId. */
export interface BoardView {
  board: BoardSummary;
  /** Columns, in order. */
  statuses: BoardStatus[];
  /** Task types and assignees, by name. */
  types: BoardTaskType[];
  people: BoardPerson[];
  members: Member[];
  /** Pending invites — only filled in for owners. */
  invites: Invite[];
  tasks: Task[];
}

/** The status a new task goes to: the board's default, else its first column. */
export const defaultStatus = (statuses: readonly BoardStatus[]) =>
  statuses.find((s) => s.isDefault) ?? statuses[0];

/** The type new tasks get, if the board has one set. */
export const defaultTypeId = (types: readonly BoardTaskType[]) =>
  types.find((t) => t.isDefault)?.id ?? null;

const byNameCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Task types and people are listed by name (accents and case ignored, numbers in order). */
export const sortByName = <T extends { name: string; id: string }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => byNameCollator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1));
