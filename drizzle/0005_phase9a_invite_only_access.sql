CREATE TABLE "auth_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT 'c5a6e372-c2b7-4692-82e2-6af9057f7b06' NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_source" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "auth_invitations_organization_fixed_check" CHECK ("auth_invitations"."organization_id" = 'c5a6e372-c2b7-4692-82e2-6af9057f7b06'::uuid),
	CONSTRAINT "auth_invitations_status_check" CHECK ("auth_invitations"."status" IN ('pending', 'accepted', 'revoked')),
	CONSTRAINT "auth_invitations_created_source_check" CHECK ("auth_invitations"."created_source" IN ('cli', 'admin_ui')),
	CONSTRAINT "auth_invitations_email_shape_check" CHECK ("auth_invitations"."email" = lower("auth_invitations"."email")
        AND "auth_invitations"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
	CONSTRAINT "auth_invitations_status_shape_check" CHECK ((
        "auth_invitations"."status" = 'pending'
        AND "auth_invitations"."accepted_by_user_id" IS NULL AND "auth_invitations"."accepted_at" IS NULL
        AND "auth_invitations"."revoked_by_user_id" IS NULL AND "auth_invitations"."revoked_at" IS NULL
      ) OR (
        "auth_invitations"."status" = 'accepted'
        AND "auth_invitations"."accepted_by_user_id" IS NOT NULL AND "auth_invitations"."accepted_at" IS NOT NULL
        AND "auth_invitations"."revoked_by_user_id" IS NULL AND "auth_invitations"."revoked_at" IS NULL
      ) OR (
        "auth_invitations"."status" = 'revoked'
        AND "auth_invitations"."revoked_by_user_id" IS NOT NULL AND "auth_invitations"."revoked_at" IS NOT NULL
        AND "auth_invitations"."accepted_by_user_id" IS NULL AND "auth_invitations"."accepted_at" IS NULL
      ))
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_verified_teachps_email_check";--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_created_by_org_fk" FOREIGN KEY ("created_by_user_id","organization_id") REFERENCES "public"."user"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_accepted_by_org_fk" FOREIGN KEY ("accepted_by_user_id","organization_id") REFERENCES "public"."user"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_revoked_by_org_fk" FOREIGN KEY ("revoked_by_user_id","organization_id") REFERENCES "public"."user"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_invitations_pending_email_unique_idx" ON "auth_invitations" USING btree ("organization_id","email") WHERE "auth_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "auth_invitations_email_idx" ON "auth_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "auth_invitations_status_idx" ON "auth_invitations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_verified_email_check" CHECK ("user"."email_verified" = true
        AND "user"."email" = lower("user"."email")
        AND "user"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+$');