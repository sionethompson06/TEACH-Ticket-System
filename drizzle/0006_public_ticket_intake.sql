CREATE TABLE "public_intake_rate_limits" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_intake_rate_limits_count_not_negative_check" CHECK ("public_intake_rate_limits"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "submission_source" text DEFAULT 'authenticated' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "public_requester_name" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "public_requester_email" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_submission_source_check" CHECK ("tickets"."submission_source" IN ('authenticated', 'public'));--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_public_requester_snapshot_check" CHECK ((
        "tickets"."submission_source" = 'public'
        AND "tickets"."public_requester_name" IS NOT NULL
        AND btrim("tickets"."public_requester_name") <> ''
        AND char_length("tickets"."public_requester_name") <= 200
        AND "tickets"."public_requester_email" IS NOT NULL
        AND btrim("tickets"."public_requester_email") <> ''
        AND char_length("tickets"."public_requester_email") <= 320
        AND "tickets"."public_requester_email" = lower("tickets"."public_requester_email")
        AND "tickets"."public_requester_email" ~ '^[^@[:space:]]+@[^@[:space:]]+$'
      ) OR (
        "tickets"."submission_source" = 'authenticated'
        AND "tickets"."public_requester_name" IS NULL
        AND "tickets"."public_requester_email" IS NULL
      ));