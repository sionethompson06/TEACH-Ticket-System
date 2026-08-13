ALTER TABLE "service_locations" DROP CONSTRAINT "service_locations_type_structure_check";--> statement-breakpoint
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_type_structure_check" CHECK ((
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
          AND "service_locations"."address_line2" IS NULL
          AND "service_locations"."city" IS NULL
          AND "service_locations"."state" IS NULL
          AND "service_locations"."postal_code" IS NULL)
      ));