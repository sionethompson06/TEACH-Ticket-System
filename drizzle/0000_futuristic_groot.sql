CREATE TYPE "public"."location_type" AS ENUM('school_campus', 'central_office', 'system_wide');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"grade_band" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_org_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "schools_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "service_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"school_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"location_type" "location_type" NOT NULL,
	"grade_band" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" varchar(2),
	"postal_code" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_locations_org_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "service_locations_type_structure_check" CHECK ((
        ("service_locations"."location_type" = 'school_campus'
          AND "service_locations"."school_id" IS NOT NULL
          AND "service_locations"."address_line1" IS NOT NULL
          AND "service_locations"."city" IS NOT NULL
          AND "service_locations"."state" IS NOT NULL
          AND "service_locations"."postal_code" IS NOT NULL)
        OR
        ("service_locations"."location_type" = 'central_office'
          AND "service_locations"."school_id" IS NULL
          AND "service_locations"."address_line1" IS NOT NULL
          AND "service_locations"."city" IS NOT NULL
          AND "service_locations"."state" IS NOT NULL
          AND "service_locations"."postal_code" IS NOT NULL)
        OR
        ("service_locations"."location_type" = 'system_wide'
          AND "service_locations"."school_id" IS NULL
          AND "service_locations"."address_line1" IS NULL
          AND "service_locations"."city" IS NULL
          AND "service_locations"."state" IS NULL
          AND "service_locations"."postal_code" IS NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_school_org_fk" FOREIGN KEY ("school_id","organization_id") REFERENCES "public"."schools"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_code_unique_idx" ON "organizations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "service_locations_school_id_idx" ON "service_locations" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "service_locations_location_type_idx" ON "service_locations" USING btree ("location_type");