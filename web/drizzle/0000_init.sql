CREATE TYPE "public"."account_status" AS ENUM('active', 'needs_reconnect', 'error');--> statement-breakpoint
CREATE TYPE "public"."auth_type" AS ENUM('oauth', 'canvas_token', 'canvas_feed');--> statement-breakpoint
CREATE TYPE "public"."calendar_kind" AS ENUM('calendar', 'course');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('event', 'deadline');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('google', 'microsoft', 'canvas', 'apple', 'atlas');--> statement-breakpoint
CREATE TYPE "public"."history_kind" AS ENUM('created', 'edited', 'moved', 'deleted', 'removed_at_source', 'hidden', 'unhidden', 'note', 'priority', 'importance', 'overlap', 'conflict_flagged', 'conflict_resolved');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('microsoft', 'canvas', 'google', 'apple');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sync_trigger" AS ENUM('connect', 'manual', 'daily');--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"time_zone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "acknowledged_conflicts" (
	"user_id" text NOT NULL,
	"event_a" uuid NOT NULL,
	"event_b" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acknowledged_conflicts_event_a_event_b_pk" PRIMARY KEY("event_a","event_b"),
	CONSTRAINT "acknowledged_conflicts_ordered" CHECK ("acknowledged_conflicts"."event_a" < "acknowledged_conflicts"."event_b")
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" "provider" NOT NULL,
	"auth_type" "auth_type" NOT NULL,
	"external_account_id" text NOT NULL,
	"label" text NOT NULL,
	"base_url" text,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"feed_url_enc" text,
	"scopes" text,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_manual_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_accounts_once" UNIQUE("user_id","provider","external_account_id"),
	CONSTRAINT "connected_accounts_has_credentials" CHECK ("connected_accounts"."access_token_enc" is not null or "connected_accounts"."feed_url_enc" is not null)
);
--> statement-breakpoint
CREATE TABLE "event_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_ids" uuid[] NOT NULL,
	"kind" "history_kind" NOT NULL,
	"summary" text NOT NULL,
	"hid" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_overrides" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"notes" text,
	"priority" "priority",
	"important" boolean,
	"hidden" boolean,
	"overlap_friendly" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" "event_source" NOT NULL,
	"source_calendar_id" uuid,
	"external_id" text,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"kind" "event_kind" DEFAULT 'event' NOT NULL,
	"location" text,
	"course_name" text,
	"source_url" text,
	"deleted_at" timestamp with time zone,
	"last_seen_run_id" uuid,
	"category" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_once_per_calendar" UNIQUE("source_calendar_id","external_id"),
	CONSTRAINT "events_end_after_start" CHECK ("events"."ends_at" >= "events"."starts_at"),
	CONSTRAINT "events_external_id_matches_source" CHECK (("events"."source" = 'atlas') = ("events"."external_id" is null))
);
--> statement-breakpoint
CREATE TABLE "source_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "calendar_kind" DEFAULT 'calendar' NOT NULL,
	"color" text,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_calendars_once" UNIQUE("account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"trigger" "sync_trigger" NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "acknowledged_conflicts" ADD CONSTRAINT "acknowledged_conflicts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledged_conflicts" ADD CONSTRAINT "acknowledged_conflicts_event_a_events_id_fk" FOREIGN KEY ("event_a") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledged_conflicts" ADD CONSTRAINT "acknowledged_conflicts_event_b_events_id_fk" FOREIGN KEY ("event_b") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_history" ADD CONSTRAINT "event_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_overrides" ADD CONSTRAINT "event_overrides_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_overrides" ADD CONSTRAINT "event_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_calendar_id_source_calendars_id_fk" FOREIGN KEY ("source_calendar_id") REFERENCES "public"."source_calendars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_calendars" ADD CONSTRAINT "source_calendars_account_id_connected_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_account_id_connected_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connected_accounts_user" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_history_events" ON "event_history" USING gin ("event_ids");--> statement-breakpoint
CREATE INDEX "event_history_user_at" ON "event_history" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "events_user_starts" ON "events" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_user_ends" ON "events" USING btree ("user_id","ends_at");--> statement-breakpoint
CREATE INDEX "sync_runs_account_started" ON "sync_runs" USING btree ("account_id","started_at");