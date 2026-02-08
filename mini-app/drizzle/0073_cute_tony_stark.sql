DO $$ BEGIN
 CREATE TYPE "public"."task_period" AS ENUM('none', 'daily', 'weekly', 'monthly', 'yearly', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "public"."task_user_sbt_status" AS ENUM('has_not_sbt', 'pending_creation', 'failed', 'created', 'notified', 'given');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."task_user_point_status" AS ENUM('not_allocated', 'allocated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."task_user_status" AS ENUM('need_to_check', 'in_progress', 'done', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "public"."task_type" AS ENUM('affiliation', 'join_channel', 'join_group', 'x_follow', 'become_organizer', 'watch_video', 'buy_ticket', 'play_a_tournament', 'buy_token');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(255),
	"sbt_id" integer,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_sbt" (
	"id" serial PRIMARY KEY NOT NULL,
	"sbt_title" varchar(255) NOT NULL,
	"sbt_description" text,
	"sbt_image_url" varchar(255),
	"sbt_reward_url" varchar(255),
	"sbt_reward_link" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users_task" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"status" "task_user_status" DEFAULT 'need_to_check' NOT NULL,
	"point_status" "task_user_point_status" DEFAULT 'not_allocated' NOT NULL,
	"task_sbt" "task_user_sbt_status" DEFAULT 'has_not_sbt' NOT NULL,
	"group_sbt" "task_user_sbt_status" DEFAULT 'has_not_sbt' NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"group_id" integer,
	"open_date" date,
	"close_date" date,
	"open_time" time without time zone,
	"close_time" time without time zone,
	"period" "task_period" DEFAULT 'none' NOT NULL,
	"period_interval" integer DEFAULT 1 NOT NULL,
	"task_type" "task_type" DEFAULT 'affiliation' NOT NULL,
	"reward_point" integer DEFAULT 0 NOT NULL,
	"has_sbt" boolean DEFAULT false NOT NULL,
	"has_group_sbt" boolean DEFAULT false NOT NULL,
	"sbt_id" integer,
	"task_connected_item" varchar(255),
	"task_connected_item_types" varchar(100),
	"json_for_checker" jsonb,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_sbt_id_task_sbt_id_fk" FOREIGN KEY ("sbt_id") REFERENCES "public"."task_sbt"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_task" ADD CONSTRAINT "users_task_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_task" ADD CONSTRAINT "users_task_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_group_id_task_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."task_groups"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sbt_id_task_sbt_id_fk" FOREIGN KEY ("sbt_id") REFERENCES "public"."task_sbt"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;


