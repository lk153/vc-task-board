import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Priority, Role, Status, TaskType } from "@/domain/task";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => timestamptz("created_at").notNull().defaultNow();
const updatedAt = () =>
  timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** fractional-indexing keys must sort by byte order, not the database locale. */
const positionKey = customType<{ data: string }>({
  dataType: () => 'text COLLATE "C"',
});

// ─── Better Auth (field names must match Better Auth's model) ───────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** True only for Google accounts — the app sends no email, so password accounts stay unverified. */
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Auth rate-limit counters, shared across serverless instances. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ─── Boards ─────────────────────────────────────────────────────────────────

export const board = pgTable("board", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const boardMember = pgTable(
  "board_member",
  {
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.boardId, t.userId] }),
    index("board_member_user_id_idx").on(t.userId),
  ],
);

export const boardInvite = pgTable(
  "board_invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    /** Lower-cased; only an account with this email can accept. */
    email: text("email").notNull(),
    /** Secret part of the invite link. */
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    expiresAt: timestamptz("expires_at").notNull(),
    acceptedAt: timestamptz("accepted_at"),
    acceptedBy: text("accepted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("board_invite_pending_email_idx")
      .on(t.boardId, t.email)
      .where(sql`${t.acceptedAt} is null`),
  ],
);

export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<Status>().notNull(),
    priority: text("priority").$type<Priority>().notNull(),
    type: text("type").$type<TaskType>(),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    points: real("points"),
    position: positionKey("position").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    /** Soft delete, so Undo works for every member. */
    deletedAt: timestamptz("deleted_at"),
  },
  (t) => [
    index("task_board_column_idx")
      .on(t.boardId, t.status, t.position)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const authSchema = { user, session, account, verification, rateLimit };
