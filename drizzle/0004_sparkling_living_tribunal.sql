CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('submitted', 'in_progress', 'waiting_for_requester', 'resolved', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."ticket_activity_type" AS ENUM('created', 'status_changed', 'priority_changed', 'assignment_changed');--> statement-breakpoint
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_id_org_unique" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_id_org_unique" UNIQUE("id","organization_id");--> statement-breakpoint
CREATE TABLE "ticket_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_categories_department_code_unique" UNIQUE("department_id","code"),
	CONSTRAINT "ticket_categories_id_department_unique" UNIQUE("id","department_id")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "tickets_ticket_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"service_location_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'submitted' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"assigned_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number"),
	CONSTRAINT "tickets_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "tickets_subject_not_blank_check" CHECK (btrim("tickets"."subject") <> '' AND char_length("tickets"."subject") <= 200),
	CONSTRAINT "tickets_description_not_blank_check" CHECK (btrim("tickets"."description") <> '' AND char_length("tickets"."description") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_comments_body_not_blank_check" CHECK (btrim("ticket_comments"."body") <> '' AND char_length("ticket_comments"."body") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "ticket_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"acting_user_id" uuid NOT NULL,
	"activity_type" "ticket_activity_type" NOT NULL,
	"previous_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_department_org_fk" FOREIGN KEY ("department_id","organization_id") REFERENCES "public"."departments"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_location_id_service_locations_id_fk" FOREIGN KEY ("service_location_id") REFERENCES "public"."service_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_agent_id_user_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_org_fk" FOREIGN KEY ("department_id","organization_id") REFERENCES "public"."departments"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_department_fk" FOREIGN KEY ("category_id","department_id") REFERENCES "public"."ticket_categories"("id","department_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_location_org_fk" FOREIGN KEY ("service_location_id","organization_id") REFERENCES "public"."service_locations"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_org_fk" FOREIGN KEY ("requester_id","organization_id") REFERENCES "public"."user"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_org_fk" FOREIGN KEY ("assigned_agent_id","organization_id") REFERENCES "public"."user"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_org_fk" FOREIGN KEY ("ticket_id","organization_id") REFERENCES "public"."tickets"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_acting_user_id_user_id_fk" FOREIGN KEY ("acting_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_ticket_org_fk" FOREIGN KEY ("ticket_id","organization_id") REFERENCES "public"."tickets"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_categories_department_id_idx" ON "ticket_categories" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "tickets_organization_id_idx" ON "tickets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tickets_requester_id_idx" ON "tickets" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "tickets_department_id_idx" ON "tickets" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "tickets_assigned_agent_id_idx" ON "tickets" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_id_idx" ON "ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_activity_ticket_id_idx" ON "ticket_activity" USING btree ("ticket_id");