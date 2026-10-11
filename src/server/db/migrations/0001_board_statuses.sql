-- Statuses become per-board rows (they were fixed keys in code).
-- Every existing board gets the five original columns, and every task —
-- including soft-deleted ones — is pointed at the matching new status.
CREATE TABLE "board_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tone" text NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_status" ADD CONSTRAINT "board_status_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_status_board_idx" ON "board_status" USING btree ("board_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "board_status_name_idx" ON "board_status" USING btree ("board_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "board_status_default_idx" ON "board_status" USING btree ("board_id") WHERE "board_status"."is_default";--> statement-breakpoint
INSERT INTO "board_status" ("board_id", "name", "tone", "position", "is_default")
SELECT b."id", s."name", s."tone", s."position", s."is_default"
FROM "board" b
CROSS JOIN (VALUES
	('Backlog', 'yellow', 'a0', false),
	('To Do', 'gray', 'a1', true),
	('In Progress', 'blue', 'a2', false),
	('In Review', 'orange', 'a3', false),
	('Done', 'green', 'a4', false)
) AS s("name", "tone", "position", "is_default");--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "status_id" uuid;--> statement-breakpoint
UPDATE "task" t
SET "status_id" = bs."id"
FROM "board_status" bs, (VALUES
	('backlog', 'Backlog'),
	('todo', 'To Do'),
	('progress', 'In Progress'),
	('review', 'In Review'),
	('done', 'Done')
) AS m("key", "name")
WHERE bs."board_id" = t."board_id" AND m."key" = t."status" AND bs."name" = m."name";--> statement-breakpoint
-- Anything unexpected lands in the board's default column rather than failing.
UPDATE "task" t
SET "status_id" = bs."id"
FROM "board_status" bs
WHERE t."status_id" IS NULL AND bs."board_id" = t."board_id" AND bs."is_default";--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_status_id_board_status_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."board_status"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DROP INDEX "task_board_column_idx";--> statement-breakpoint
CREATE INDEX "task_board_column_idx" ON "task" USING btree ("board_id","status_id","position") WHERE "task"."deleted_at" is null;
