-- Task types and assignees become per-board lists that owners manage.
-- Every board gets the six original task types, and every member (or anyone
-- still assigned a task) becomes a person on the board with their usual
-- color. Tasks — including soft-deleted ones — keep their type and assignee.
CREATE TABLE "board_task_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tone" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tone" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_task_type" ADD CONSTRAINT "board_task_type_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_person" ADD CONSTRAINT "board_person_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_person" ADD CONSTRAINT "board_person_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_task_type_name_idx" ON "board_task_type" USING btree ("board_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "board_task_type_default_idx" ON "board_task_type" USING btree ("board_id") WHERE "board_task_type"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "board_person_name_idx" ON "board_person" USING btree ("board_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "board_person_user_idx" ON "board_person" USING btree ("board_id","user_id");--> statement-breakpoint
INSERT INTO "board_task_type" ("board_id", "name", "tone", "is_default")
SELECT b."id", t."name", t."tone", t."is_default"
FROM "board" b
CROSS JOIN (VALUES
	('Tech Solution', 'blue', true),
	('UI/UX', 'lavender', false),
	('Review Code', 'purple', false),
	('Bug', 'orange', false),
	('Testing', 'teal', false),
	('Documentation', 'gray', false)
) AS t("name", "tone", "is_default");--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "type_id" uuid;--> statement-breakpoint
UPDATE "task" t
SET "type_id" = bt."id"
FROM "board_task_type" bt, (VALUES
	('tech', 'Tech Solution'),
	('uiux', 'UI/UX'),
	('review', 'Review Code'),
	('bug', 'Bug'),
	('testing', 'Testing'),
	('docs', 'Documentation')
) AS m("key", "name")
WHERE bt."board_id" = t."board_id" AND m."key" = t."type" AND bt."name" = m."name";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_type_id_board_task_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."board_task_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Colors repeat assigneeTone() in src/domain/tone.ts: a 32-bit "hash * 31 + char"
-- over the user id picks one of ASSIGNEE_TONES. Two members with the same name
-- on one board are told apart by their email.
INSERT INTO "board_person" ("board_id", "name", "tone", "user_id")
WITH RECURSIVE "hash"("user_id", "i", "h") AS (
	SELECT u."id", 0, 0::bigint FROM "user" u
	UNION ALL
	SELECT "hash"."user_id", "hash"."i" + 1, ("hash"."h" * 31 + ascii(substr("hash"."user_id", "hash"."i" + 1, 1))) % 4294967296
	FROM "hash" WHERE "hash"."i" < length("hash"."user_id")
),
"people" AS (
	SELECT "board_id", "user_id" FROM "board_member"
	UNION
	SELECT "board_id", "assignee_id" FROM "task" WHERE "assignee_id" IS NOT NULL
),
"named" AS (
	SELECT p."board_id", u."id" AS "user_id", u."name", u."email",
		count(*) OVER (PARTITION BY p."board_id", lower(u."name")) AS "same_name"
	FROM "people" p
	JOIN "user" u ON u."id" = p."user_id"
)
SELECT n."board_id",
	CASE WHEN n."same_name" > 1 THEN n."name" || ' (' || n."email" || ')' ELSE n."name" END,
	(ARRAY['yellow', 'navy', 'forest', 'lavender', 'teal', 'orange', 'purple', 'slate', 'pink', 'blue'])[(h."h" % 10)::int + 1],
	n."user_id"
FROM "named" n
JOIN "hash" h ON h."user_id" = n."user_id" AND h."i" = length(n."user_id");--> statement-breakpoint
ALTER TABLE "task" RENAME COLUMN "assignee_id" TO "assignee_user_id";--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
UPDATE "task" t
SET "assignee_id" = p."id"
FROM "board_person" p
WHERE p."board_id" = t."board_id" AND p."user_id" = t."assignee_user_id";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "assignee_user_id";--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_board_person_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."board_person"("id") ON DELETE set null ON UPDATE no action;
