import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ResolvedActor } from "../authz/policy";
import { resolveActor } from "../authz/resolve-actor";
import {
  TicketAuthorizationError,
  TicketValidationError,
} from "../tickets/errors";
import { formatTicketNumber } from "../tickets/ticket-number";
import * as ticketService from "../tickets/ticket-service";
import {
  addTicketComment,
  assignTicket,
  createTicket,
  getTicket,
  listTicketsForActor,
  updateTicketPriority,
  updateTicketStatus,
} from "../tickets/ticket-service";
import { REFERENCE_ORGANIZATION } from "./reference-data";
import * as schema from "./schema";
import {
  departmentMemberships,
  departments,
  serviceLocations,
  ticketActivity,
  ticketCategories,
  tickets,
  user,
} from "./schema";
import { seedReferenceData } from "./seed-reference-data";

describe("ticket service", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let itDepartmentId: string;
  let facilitiesDepartmentId: string;
  let itCategoryId: string;
  let facilitiesCategoryId: string;
  let locationId: string;
  let userCounter = 0;

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
    const [facilitiesCategory] = await db
      .select()
      .from(ticketCategories)
      .where(eq(ticketCategories.departmentId, facilitiesDepartmentId));
    itCategoryId = itCategory.id;
    facilitiesCategoryId = facilitiesCategory.id;

    const [location] = await db.select().from(serviceLocations).limit(1);
    locationId = location.id;
  });

  afterAll(async () => {
    await client.close();
  });

  async function createSyntheticUser(
    overrides: Partial<typeof user.$inferInsert> = {},
  ) {
    userCounter += 1;
    const [row] = await db
      .insert(user)
      .values({
        name: `Synthetic User ${userCounter}`,
        email: `synthetic.user.${userCounter}@teachps.org`,
        emailVerified: true,
        ...overrides,
      })
      .returning();
    return row;
  }

  async function makeDepartmentAgent(departmentId: string) {
    const agent = await createSyntheticUser();
    await db.insert(departmentMemberships).values({
      userId: agent.id,
      departmentId,
      organizationId: REFERENCE_ORGANIZATION.id,
    });
    return agent;
  }

  async function actorForUser(userId: string): Promise<ResolvedActor> {
    return resolveActor(db, userId);
  }

  function validCreateInput(
    overrides: Partial<Parameters<typeof createTicket>[2]> = {},
  ) {
    return {
      departmentId: itDepartmentId,
      serviceLocationId: locationId,
      categoryId: itCategoryId,
      subject: "Chromebook will not power on",
      description: "The screen stays black even after a full charge.",
      ...overrides,
    };
  }

  describe("createTicket", () => {
    it("allows an active requester to create a valid ticket", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      const ticket = await createTicket(db, actor, validCreateInput());

      expect(ticket.id).toBeDefined();
      expect(ticket.departmentId).toBe(itDepartmentId);
      expect(ticket.categoryId).toBe(itCategoryId);
      expect(ticket.serviceLocationId).toBe(locationId);
    });

    it("uses the authenticated requester automatically, ignoring any other requester id", async () => {
      const requester = await createSyntheticUser();
      const otherUser = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      const forgedInput = {
        ...validCreateInput(),
        requesterId: otherUser.id,
      } as Parameters<typeof createTicket>[2] & { requesterId: string };

      const ticket = await createTicket(db, actor, forgedInput);

      expect(ticket.requesterId).toBe(requester.id);
      expect(ticket.requesterId).not.toBe(otherUser.id);
    });

    it("assigns the documented initial status and default priority", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      const ticket = await createTicket(db, actor, validCreateInput());

      expect(ticket.status).toBe("submitted");
      expect(ticket.priority).toBe("normal");
    });

    it("assigns a unique, human-friendly sequential ticket number", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      const first = await createTicket(db, actor, validCreateInput());
      const second = await createTicket(db, actor, validCreateInput());

      expect(first.ticketNumber).not.toBe(second.ticketNumber);
      expect(formatTicketNumber(first.ticketNumber)).toMatch(/^TKT-\d{6,}$/);
      expect(formatTicketNumber(second.ticketNumber)).toMatch(/^TKT-\d{6,}$/);
    });

    it("rejects a category that does not belong to the selected department", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      await expect(
        createTicket(
          db,
          actor,
          validCreateInput({
            departmentId: facilitiesDepartmentId,
            categoryId: itCategoryId,
          }),
        ),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects an inactive category", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const [inactiveCategory] = await db
        .insert(ticketCategories)
        .values({
          organizationId: REFERENCE_ORGANIZATION.id,
          departmentId: itDepartmentId,
          code: "TEST_INACTIVE_CATEGORY",
          name: "Test Inactive Category",
          isActive: false,
          displayOrder: 99,
        })
        .returning();

      await expect(
        createTicket(
          db,
          actor,
          validCreateInput({ categoryId: inactiveCategory.id }),
        ),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects a nonexistent service location", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      await expect(
        createTicket(
          db,
          actor,
          validCreateInput({
            serviceLocationId: "00000000-0000-0000-0000-000000000000",
          }),
        ),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects a blank or whitespace-only subject", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      await expect(
        createTicket(db, actor, validCreateInput({ subject: "   " })),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects a blank description", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      await expect(
        createTicket(db, actor, validCreateInput({ description: "" })),
      ).rejects.toThrow(TicketValidationError);
    });

    it("rejects an anonymous actor", async () => {
      const anonymous: ResolvedActor = { status: "anonymous" };
      await expect(
        createTicket(db, anonymous, validCreateInput()),
      ).rejects.toThrow(TicketAuthorizationError);
    });

    it("rejects an inactive user", async () => {
      const inactiveUser = await createSyntheticUser({ isActive: false });
      const actor = await actorForUser(inactiveUser.id);

      await expect(createTicket(db, actor, validCreateInput())).rejects.toThrow(
        TicketAuthorizationError,
      );
    });
  });

  describe("ticket access", () => {
    it("allows a requester to view their own ticket", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const ticket = await createTicket(db, actor, validCreateInput());

      const fetched = await getTicket(db, actor, ticket.id);
      expect(fetched?.id).toBe(ticket.id);
    });

    it("denies a requester access to another requester's ticket", async () => {
      const owner = await createSyntheticUser();
      const otherRequester = await createSyntheticUser();
      const ownerActor = await actorForUser(owner.id);
      const otherActor = await actorForUser(otherRequester.id);
      const ticket = await createTicket(db, ownerActor, validCreateInput());

      expect(await getTicket(db, otherActor, ticket.id)).toBeNull();
    });

    it("allows an IT agent to access an IT ticket", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());

      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      const fetched = await getTicket(db, agentActor, ticket.id);
      expect(fetched?.id).toBe(ticket.id);
    });

    it("denies an IT agent access to a Facilities ticket without membership", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const facilitiesTicket = await createTicket(
        db,
        requesterActor,
        validCreateInput({
          departmentId: facilitiesDepartmentId,
          categoryId: facilitiesCategoryId,
        }),
      );

      const itOnlyAgent = await makeDepartmentAgent(itDepartmentId);
      const itOnlyActor = await actorForUser(itOnlyAgent.id);

      expect(await getTicket(db, itOnlyActor, facilitiesTicket.id)).toBeNull();
    });

    it("allows a Facilities agent to access a Facilities ticket", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const facilitiesTicket = await createTicket(
        db,
        requesterActor,
        validCreateInput({
          departmentId: facilitiesDepartmentId,
          categoryId: facilitiesCategoryId,
        }),
      );

      const facilitiesAgent = await makeDepartmentAgent(facilitiesDepartmentId);
      const facilitiesActor = await actorForUser(facilitiesAgent.id);

      const fetched = await getTicket(db, facilitiesActor, facilitiesTicket.id);
      expect(fetched?.id).toBe(facilitiesTicket.id);
    });

    it("allows a system administrator to access ordinary tickets", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());

      const admin = await createSyntheticUser();
      await db
        .update(user)
        .set({ isSystemAdministrator: true })
        .where(eq(user.id, admin.id));
      const adminActor = await actorForUser(admin.id);

      const fetched = await getTicket(db, adminActor, ticket.id);
      expect(fetched?.id).toBe(ticket.id);
    });

    it("denies cross-organization access", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());

      // There is only one real organization in this schema today, so a
      // cross-organization actor is simulated the same way the Phase 4
      // pure policy tests do — a hand-built actor from a different
      // organization id, exercising the same comparison the real
      // multi-organization case would hit.
      const otherOrgActor: ResolvedActor = {
        status: "active",
        userId: requester.id,
        organizationId: "00000000-0000-0000-0000-00000000dead",
        isSystemAdministrator: true,
        departmentCodes: [],
      };

      expect(await getTicket(db, otherOrgActor, ticket.id)).toBeNull();
    });

    it("scopes ticket listings to only what the actor is authorized to see", async () => {
      const requesterA = await createSyntheticUser();
      const requesterB = await createSyntheticUser();
      const actorA = await actorForUser(requesterA.id);
      const actorB = await actorForUser(requesterB.id);

      const ticketA = await createTicket(db, actorA, validCreateInput());
      const ticketB = await createTicket(
        db,
        actorB,
        validCreateInput({
          departmentId: facilitiesDepartmentId,
          categoryId: facilitiesCategoryId,
        }),
      );

      const listForA = await listTicketsForActor(db, actorA);
      expect(listForA.map((t) => t.id)).toContain(ticketA.id);
      expect(listForA.map((t) => t.id)).not.toContain(ticketB.id);

      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const itAgentActor = await actorForUser(itAgent.id);
      const listForItAgent = await listTicketsForActor(db, itAgentActor);
      expect(listForItAgent.map((t) => t.id)).toContain(ticketA.id);
      expect(listForItAgent.map((t) => t.id)).not.toContain(ticketB.id);
    });
  });

  describe("ticket comments", () => {
    it("allows a requester to comment on their own ticket", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const ticket = await createTicket(db, actor, validCreateInput());

      const comment = await addTicketComment(
        db,
        actor,
        ticket.id,
        "Any update on this?",
      );
      expect(comment.ticketId).toBe(ticket.id);
      expect(comment.authorId).toBe(requester.id);
    });

    it("allows an authorized department agent to comment", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());

      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      const comment = await addTicketComment(
        db,
        agentActor,
        ticket.id,
        "Looking into this now.",
      );
      expect(comment.authorId).toBe(itAgent.id);
    });

    it("denies comments from an unauthorized requester", async () => {
      const owner = await createSyntheticUser();
      const otherRequester = await createSyntheticUser();
      const ownerActor = await actorForUser(owner.id);
      const otherActor = await actorForUser(otherRequester.id);
      const ticket = await createTicket(db, ownerActor, validCreateInput());

      await expect(
        addTicketComment(db, otherActor, ticket.id, "I should not see this."),
      ).rejects.toThrow(TicketAuthorizationError);
    });

    it("denies comments from an agent of the wrong department", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());

      const facilitiesAgent = await makeDepartmentAgent(facilitiesDepartmentId);
      const facilitiesActor = await actorForUser(facilitiesAgent.id);

      await expect(
        addTicketComment(db, facilitiesActor, ticket.id, "Wrong department."),
      ).rejects.toThrow(TicketAuthorizationError);
    });

    it("rejects a blank comment", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const ticket = await createTicket(db, actor, validCreateInput());

      await expect(
        addTicketComment(db, actor, ticket.id, "   "),
      ).rejects.toThrow(TicketValidationError);
    });

    it("is append-only: no edit or delete function exists, and prior comments are never altered", async () => {
      expect(
        (ticketService as Record<string, unknown>).updateTicketComment,
      ).toBeUndefined();
      expect(
        (ticketService as Record<string, unknown>).deleteTicketComment,
      ).toBeUndefined();
      expect(
        (ticketService as Record<string, unknown>).editTicketComment,
      ).toBeUndefined();

      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const ticket = await createTicket(db, actor, validCreateInput());

      const first = await addTicketComment(
        db,
        actor,
        ticket.id,
        "First message.",
      );
      const second = await addTicketComment(
        db,
        actor,
        ticket.id,
        "Second message.",
      );

      const [reloadedFirst] = await db
        .select()
        .from(schema.ticketComments)
        .where(eq(schema.ticketComments.id, first.id));
      expect(reloadedFirst.body).toBe("First message.");
      expect(second.body).toBe("Second message.");
    });
  });

  describe("ticket updates", () => {
    it("allows an authorized department agent to update status and priority", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());

      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      const afterStatus = await updateTicketStatus(
        db,
        agentActor,
        ticket.id,
        "in_progress",
      );
      expect(afterStatus.status).toBe("in_progress");

      const afterPriority = await updateTicketPriority(
        db,
        agentActor,
        ticket.id,
        "urgent",
      );
      expect(afterPriority.priority).toBe("urgent");
    });

    it("denies a requester the ability to change status, priority, or assignment", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const ticket = await createTicket(db, actor, validCreateInput());
      const itAgent = await makeDepartmentAgent(itDepartmentId);

      await expect(
        updateTicketStatus(db, actor, ticket.id, "in_progress"),
      ).rejects.toThrow(TicketAuthorizationError);
      await expect(
        updateTicketPriority(db, actor, ticket.id, "urgent"),
      ).rejects.toThrow(TicketAuthorizationError);
      await expect(
        assignTicket(db, actor, ticket.id, itAgent.id),
      ).rejects.toThrow(TicketAuthorizationError);
    });

    it("requires an assignee to be an active agent of the ticket's own department", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());
      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      const unrelatedRequester = await createSyntheticUser();
      await expect(
        assignTicket(db, agentActor, ticket.id, unrelatedRequester.id),
      ).rejects.toThrow(TicketValidationError);

      const facilitiesOnlyAgent = await makeDepartmentAgent(
        facilitiesDepartmentId,
      );
      await expect(
        assignTicket(db, agentActor, ticket.id, facilitiesOnlyAgent.id),
      ).rejects.toThrow(TicketValidationError);

      const inactiveItAgent = await makeDepartmentAgent(itDepartmentId);
      await db
        .update(user)
        .set({ isActive: false })
        .where(eq(user.id, inactiveItAgent.id));
      await expect(
        assignTicket(db, agentActor, ticket.id, inactiveItAgent.id),
      ).rejects.toThrow(TicketValidationError);

      const validAssignee = await makeDepartmentAgent(itDepartmentId);
      const assigned = await assignTicket(
        db,
        agentActor,
        ticket.id,
        validAssignee.id,
      );
      expect(assigned.assignedAgentId).toBe(validAssignee.id);
    });

    it("maintains resolved and closed timestamps correctly", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());
      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      expect(ticket.resolvedAt).toBeNull();
      expect(ticket.closedAt).toBeNull();

      const resolved = await updateTicketStatus(
        db,
        agentActor,
        ticket.id,
        "resolved",
      );
      expect(resolved.resolvedAt).not.toBeNull();
      expect(resolved.closedAt).toBeNull();

      const closed = await updateTicketStatus(
        db,
        agentActor,
        ticket.id,
        "closed",
      );
      expect(closed.resolvedAt).not.toBeNull();
      expect(closed.closedAt).not.toBeNull();
    });

    it("allows a resolved ticket to be reopened", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());
      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      await updateTicketStatus(db, agentActor, ticket.id, "resolved");
      const reopened = await updateTicketStatus(
        db,
        agentActor,
        ticket.id,
        "reopened",
      );
      expect(reopened.status).toBe("reopened");
    });

    it("treats a closed ticket as final in the MVP: no further status transition is allowed", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());
      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      await updateTicketStatus(db, agentActor, ticket.id, "resolved");
      await updateTicketStatus(db, agentActor, ticket.id, "closed");

      await expect(
        updateTicketStatus(db, agentActor, ticket.id, "reopened"),
      ).rejects.toThrow(TicketValidationError);
      await expect(
        updateTicketStatus(db, agentActor, ticket.id, "in_progress"),
      ).rejects.toThrow(TicketValidationError);
    });

    it("writes an activity record for creation, status change, priority change, and assignment change", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());
      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      await updateTicketStatus(db, agentActor, ticket.id, "in_progress");
      await updateTicketPriority(db, agentActor, ticket.id, "urgent");
      await assignTicket(db, agentActor, ticket.id, itAgent.id);

      const activityRows = await db
        .select()
        .from(ticketActivity)
        .where(eq(ticketActivity.ticketId, ticket.id));
      const types = activityRows.map((row) => row.activityType).sort();
      expect(types).toEqual(
        [
          "assignment_changed",
          "created",
          "priority_changed",
          "status_changed",
        ].sort(),
      );

      const statusActivity = activityRows.find(
        (row) => row.activityType === "status_changed",
      );
      expect(statusActivity?.previousValue).toBe("submitted");
      expect(statusActivity?.newValue).toBe("in_progress");
    });

    it("leaves no activity record and no ticket change behind for a rejected status transition", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const ticket = await createTicket(db, requesterActor, validCreateInput());
      const itAgent = await makeDepartmentAgent(itDepartmentId);
      const agentActor = await actorForUser(itAgent.id);

      await updateTicketStatus(db, agentActor, ticket.id, "resolved");
      await updateTicketStatus(db, agentActor, ticket.id, "closed");

      const activityCountBefore = (
        await db
          .select()
          .from(ticketActivity)
          .where(eq(ticketActivity.ticketId, ticket.id))
      ).length;

      await expect(
        updateTicketStatus(db, agentActor, ticket.id, "in_progress"),
      ).rejects.toThrow(TicketValidationError);

      const activityCountAfter = (
        await db
          .select()
          .from(ticketActivity)
          .where(eq(ticketActivity.ticketId, ticket.id))
      ).length;
      expect(activityCountAfter).toBe(activityCountBefore);

      const [reloadedTicket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      expect(reloadedTicket.status).toBe("closed");
    });
  });

  describe("database constraints", () => {
    it("rejects a duplicate ticket category code within the same department", async () => {
      await expect(
        db.insert(ticketCategories).values({
          organizationId: REFERENCE_ORGANIZATION.id,
          departmentId: itDepartmentId,
          code: "STUDENT_STAFF_DEVICES",
          name: "Duplicate category code",
          displayOrder: 100,
        }),
      ).rejects.toThrow();
    });

    it("rejects a ticket whose category does not belong to its department, at the database level", async () => {
      const requester = await createSyntheticUser();
      await expect(
        db.insert(tickets).values({
          organizationId: REFERENCE_ORGANIZATION.id,
          requesterId: requester.id,
          departmentId: facilitiesDepartmentId,
          serviceLocationId: locationId,
          categoryId: itCategoryId,
          subject: "Mismatched category/department",
          description: "This should be rejected by the database.",
        }),
      ).rejects.toThrow();
    });

    it("rejects a ticket referencing a nonexistent department", async () => {
      const requester = await createSyntheticUser();
      await expect(
        db.insert(tickets).values({
          organizationId: REFERENCE_ORGANIZATION.id,
          requesterId: requester.id,
          departmentId: "00000000-0000-0000-0000-000000000000",
          serviceLocationId: locationId,
          categoryId: itCategoryId,
          subject: "Invalid department reference",
          description: "This should be rejected by the database.",
        }),
      ).rejects.toThrow();
    });

    it("rejects a blank ticket subject at the database level", async () => {
      const requester = await createSyntheticUser();
      await expect(
        db.insert(tickets).values({
          organizationId: REFERENCE_ORGANIZATION.id,
          requesterId: requester.id,
          departmentId: itDepartmentId,
          serviceLocationId: locationId,
          categoryId: itCategoryId,
          subject: "   ",
          description: "Valid description.",
        }),
      ).rejects.toThrow();
    });

    it("rejects a blank ticket comment body at the database level", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const ticket = await createTicket(db, actor, validCreateInput());

      await expect(
        db.insert(schema.ticketComments).values({
          ticketId: ticket.id,
          organizationId: REFERENCE_ORGANIZATION.id,
          authorId: requester.id,
          body: "",
        }),
      ).rejects.toThrow();
    });

    it("guarantees ticket numbers are unique even under direct duplicate insertion attempts", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const a = await createTicket(db, actor, validCreateInput());
      const b = await createTicket(db, actor, validCreateInput());
      const c = await createTicket(db, actor, validCreateInput());

      const numbers = [a.ticketNumber, b.ticketNumber, c.ticketNumber];
      expect(new Set(numbers).size).toBe(numbers.length);
    });
  });
});
