CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_org_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "departments_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "department_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "department_memberships_user_department_unique" UNIQUE("user_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_system_administrator" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_department_org_fk" FOREIGN KEY ("department_id","organization_id") REFERENCES "public"."departments"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_memberships_user_id_idx" ON "department_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "department_memberships_department_id_idx" ON "department_memberships" USING btree ("department_id");