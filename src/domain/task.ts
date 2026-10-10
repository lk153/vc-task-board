import { z } from "zod";
import { LIMITS, PRIORITIES, STATUSES, TASK_TYPES } from "@/config/board";

export type Status = (typeof STATUSES)[number]["id"];
export type Priority = (typeof PRIORITIES)[number]["id"];
export type TaskType = (typeof TASK_TYPES)[number]["id"];
export type Role = "owner" | "member";

const ids = <T extends { id: string }>(list: readonly T[]) =>
  list.map((item) => item.id) as [T["id"], ...T["id"][]];

export const statusSchema = z.enum(ids(STATUSES));
export const prioritySchema = z.enum(ids(PRIORITIES));
export const taskTypeSchema = z.enum(ids(TASK_TYPES));

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
  status: statusSchema,
  priority: prioritySchema,
  type: taskTypeSchema.nullable(),
  assigneeId: z.string().min(1).nullable(),
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
  status: Status;
  priority: Priority;
  type: TaskType | null;
  assigneeId: string | null;
  points: number | null;
  position: string;
  createdAt: string;
  updatedAt: string;
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
  members: Member[];
  /** Pending invites — only filled in for owners. */
  invites: Invite[];
  tasks: Task[];
}

export const statusLabel = (id: Status) => STATUSES.find((s) => s.id === id)?.label ?? id;
