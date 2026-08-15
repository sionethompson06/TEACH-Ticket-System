import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveActor } from "../authz/resolve-actor";
import {
  checkAndRecordRateLimit,
  computeRateLimitFingerprint,
  RATE_LIMIT_MAX_PER_WINDOW,
} from "../public-intake/rate-limit";
import { TicketValidationError } from "../tickets/errors";
import { getTicketDetailByNumber } from "../tickets/ticket-queries";
import { formatTicketNumber } from "../tickets/ticket-number";
import {
  createPublicTicket,
  type PublicTicketIntakeInput,
} from "../tickets/public-intake-service";
import {
  REFERENCE_ORGANIZATION,
  REFERENCE_PUBLIC_INTAKE_USER,
} from "./reference-data";
import * as schema from "./schema";
import {
  departments,
  publicIntakeRateLimits,
  serviceLocations,
  ticketCategories,
  user,
} from "./schema";
import { seedReferenceData } from "./seed-reference-data";

describe("public ticket intake (Phase 9B, synthetic data only)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let itDepartmentId: string;
  let itCategoryId: string;
  let facilitiesDepartmentId: string;
  let locationId: string;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedReferenceData(db);

    const [it] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));
    const [facilities] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "FACILITIES"));
    itDepartmentId = it.id;
    facilitiesDepartmentId = facilities.id;

    const [itCategory] = await db
      .select()
      .from(ticketCategories)
      .where(eq(ticketCategories.departmentId, itDepartmentId));
    itCategoryId = itCategory.id;

    const [location] = await db.select().from(serviceLocations).limit(1);
    locationId = location.id;
  });

  afterAll(async () => {
    await client.close();
  });

  function validInput(
    overrides: Partial<PublicTicketIntakeInput> = {},
  ): PublicTicketIntakeInput {
    return {
      requesterName: "Pat Public",
      requesterEmail: "pat.public@example.com",
      departmentId: itDepartmentId,
      serviceLocationId: locationId,
      categoryId: itCategoryId,
      subject: "Chromebook won't turn on",
      description: "Tried charging overnight, still won't power on.",
      ...overrides,
    };
  }

  describe("the reserved Public Intake user", () => {
    it("exists, seeded by seedReferenceData(), and is inactive", async () => {
      const [row] = await db
        .select()
        .from(user)
        .where(eq(user.id, REFERENCE_PUBLIC_INTAKE_USER.id));
      expect(row).toBeDefined();
      expect(row.email).toBe(REFERENCE_PUBLIC_INTAKE_USER.email);
      expect(row.isActive).toBe(false);
      expect(row.organizationId).toBe(REFERENCE_ORGANIZATION.id);
    });

    it("never resolves as an active actor", async () => {
      const actor = await resolveActor(db, REFERENCE_PUBLIC_INTAKE_USER.id);
      expect(actor.status).toBe("inactive");
    });
  });

  describe("createPublicTicket", () => {
    it("creates a ticket for the fixed organization and reserved requester", async () => {
      const ticket = await createPublicTicket(db, validInput());

      expect(ticket.organizationId).toBe(REFERENCE_ORGANIZATION.id);
      expect(ticket.requesterId).toBe(REFERENCE_PUBLIC_INTAKE_USER.id);
      expect(ticket.submissionSource).toBe("public");
    });

    it("stores the public requester name/email snapshot, normalized", async () => {
      const ticket = await createPublicTicket(
        db,
        validInput({
          requesterName: "  Pat Public  ",
          requesterEmail: "  Pat.Public@EXAMPLE.com  ",
        }),
      );

      expect(ticket.publicRequesterName).toBe("Pat Public");
      expect(ticket.publicRequesterEmail).toBe("pat.public@example.com");
    });

    it("ignores an organizationId or requesterId supplied by the caller", async () => {
      const maliciousInput = {
        ...validInput(),
        organizationId: "00000000-0000-0000-0000-000000000000",
        requesterId: "00000000-0000-0000-0000-000000000000",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const ticket = await createPublicTicket(db, maliciousInput);

      expect(ticket.organizationId).toBe(REFERENCE_ORGANIZATION.id);
      expect(ticket.requesterId).toBe(REFERENCE_PUBLIC_INTAKE_USER.id);
    });

    it("rejects a blank requester name", async () => {
      await expect(
        createPublicTicket(db, validInput({ requesterName: "   " })),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects a requester name longer than the limit", async () => {
      await expect(
        createPublicTicket(db, validInput({ requesterName: "a".repeat(201) })),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects a malformed requester email", async () => {
      await expect(
        createPublicTicket(db, validInput({ requesterEmail: "not-an-email" })),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects an unknown department", async () => {
      await expect(
        createPublicTicket(
          db,
          validInput({
            departmentId: "00000000-0000-0000-0000-000000000000",
          }),
        ),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects a category that belongs to a different department", async () => {
      const [facilitiesCategory] = await db
        .select()
        .from(ticketCategories)
        .where(eq(ticketCategories.departmentId, facilitiesDepartmentId));

      await expect(
        createPublicTicket(
          db,
          validInput({ categoryId: facilitiesCategory.id }),
        ),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects an unknown service location", async () => {
      await expect(
        createPublicTicket(
          db,
          validInput({
            serviceLocationId: "00000000-0000-0000-0000-000000000000",
          }),
        ),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects a blank subject/description", async () => {
      await expect(
        createPublicTicket(db, validInput({ subject: "   " })),
      ).rejects.toThrow(TicketValidationError);
      await expect(
        createPublicTicket(db, validInput({ description: "" })),
      ).rejects.toThrow(TicketValidationError);
    });

    it("a ticket number alone grants no access — the public confirmation cannot be used as an authorization token", async () => {
      const ticket = await createPublicTicket(db, validInput());
      const anonymousResult = await getTicketDetailByNumber(
        db,
        { status: "anonymous" },
        formatTicketNumber(ticket.ticketNumber),
      ).catch((error: unknown) => error);
      // getTicketDetailByNumber asserts an active actor; an anonymous
      // "actor" must never be able to call it successfully at all.
      expect(anonymousResult).toBeInstanceOf(Error);
    });
  });

  describe("checkAndRecordRateLimit", () => {
    it("allows up to the configured maximum submissions per fingerprint per window", async () => {
      const fingerprint = "test-fingerprint-sequential";
      for (let i = 0; i < RATE_LIMIT_MAX_PER_WINDOW; i++) {
        const result = await checkAndRecordRateLimit(db, fingerprint);
        expect(result.allowed).toBe(true);
      }
      const oneOver = await checkAndRecordRateLimit(db, fingerprint);
      expect(oneOver.allowed).toBe(false);
    });

    it("tracks different fingerprints independently", async () => {
      const a = await checkAndRecordRateLimit(db, "fingerprint-a");
      const b = await checkAndRecordRateLimit(db, "fingerprint-b");
      expect(a.allowed).toBe(true);
      expect(b.allowed).toBe(true);
    });

    it("never stores the raw client IP address — only its HMAC fingerprint", async () => {
      const rawIp = "203.0.113.77";
      const fingerprint = computeRateLimitFingerprint("a".repeat(32), rawIp);
      await checkAndRecordRateLimit(db, fingerprint);

      const rows = await db
        .select()
        .from(publicIntakeRateLimits)
        .where(eq(publicIntakeRateLimits.fingerprint, fingerprint));

      expect(rows).toHaveLength(1);
      expect(rows[0].fingerprint).not.toContain(rawIp);
      expect(JSON.stringify(rows[0])).not.toContain(rawIp);
    });

    it("is concurrency-safe: exactly the configured maximum of concurrent requests are allowed", async () => {
      const fingerprint = "test-fingerprint-concurrent";
      const attempts = RATE_LIMIT_MAX_PER_WINDOW + 5;
      const results = await Promise.all(
        Array.from({ length: attempts }, () =>
          checkAndRecordRateLimit(db, fingerprint),
        ),
      );
      const allowedCount = results.filter((r) => r.allowed).length;
      expect(allowedCount).toBe(RATE_LIMIT_MAX_PER_WINDOW);
    });
  });
});
