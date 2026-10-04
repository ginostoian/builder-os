ALTER TABLE "project_tasks" DROP CONSTRAINT "project_tasks_assignee_fk";
--> statement-breakpoint
ALTER TABLE "project_tasks" DROP COLUMN "assignee_member_id";