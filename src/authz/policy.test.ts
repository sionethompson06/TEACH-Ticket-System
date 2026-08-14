import { describe, expect, it } from "vitest";
import {
  authorize,
  type AuthorizationAction,
  type ResolvedActor,
  type TicketResourceDescriptor,
} from "./policy";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";

const REQUESTER_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_REQUESTER_ID = "44444444-4444-4444-4444-444444444444";
const IT_AGENT_ID = "55555555-5555-5555-5555-555555555555";
const FACILITIES_AGENT_ID = "66666666-6666-6666-6666-666666666666";
const BOTH_AGENT_ID = "77777777-7777-7777-7777-777777777777";
const ADMIN_ID = "88888888-8888-8888-8888-888888888888";

function requester(): ResolvedActor {
  return {
    status: "active",
    userId: REQUESTER_ID,
    organizationId: ORG_A,
    isSystemAdministrator: false,
    departmentCodes: [],
  };
}

function itAgent(): ResolvedActor {
  return {
    status: "active",
    userId: IT_AGENT_ID,
    organizationId: ORG_A,
    isSystemAdministrator: false,
    departmentCodes: ["IT"],
  };
}

function facilitiesAgent(): ResolvedActor {
  return {
    status: "active",
    userId: FACILITIES_AGENT_ID,
    organizationId: ORG_A,
    isSystemAdministrator: false,
    departmentCodes: ["FACILITIES"],
  };
}

function bothDepartmentsAgent(): ResolvedActor {
  return {
    status: "active",
    userId: BOTH_AGENT_ID,
    organizationId: ORG_A,
    isSystemAdministrator: false,
    departmentCodes: ["IT", "FACILITIES"],
  };
}

function systemAdministrator(): ResolvedActor {
  return {
    status: "active",
    userId: ADMIN_ID,
    organizationId: ORG_A,
    isSystemAdministrator: true,
    departmentCodes: [],
  };
}

function itTicket(
  overrides: Partial<TicketResourceDescriptor> = {},
): TicketResourceDescriptor {
  return {
    organizationId: ORG_A,
    requesterId: REQUESTER_ID,
    departmentCode: "IT",
    ...overrides,
  };
}

function facilitiesTicket(
  overrides: Partial<TicketResourceDescriptor> = {},
): TicketResourceDescriptor {
  return {
    organizationId: ORG_A,
    requesterId: REQUESTER_ID,
    departmentCode: "FACILITIES",
    ...overrides,
  };
}

const CREATE_TICKET: AuthorizationAction = { kind: "create_ticket" };
const ADMINISTER: AuthorizationAction = { kind: "administer" };

describe("authorize", () => {
  it("allows an authenticated requester to create a ticket", () => {
    expect(authorize(requester(), CREATE_TICKET)).toBe(true);
  });

  it("allows a requester to access a ticket they own", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ requesterId: REQUESTER_ID }),
    };
    expect(authorize(requester(), action)).toBe(true);
  });

  it("denies a requester access to another requester's ticket", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(requester(), action)).toBe(false);
  });

  it("allows an IT agent to access an IT ticket", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(itAgent(), action)).toBe(true);
  });

  it("denies an IT agent access to a Facilities ticket", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: facilitiesTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(itAgent(), action)).toBe(false);
  });

  it("allows a Facilities agent to access a Facilities ticket", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: facilitiesTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(facilitiesAgent(), action)).toBe(true);
  });

  it("denies a Facilities agent access to an IT ticket", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(facilitiesAgent(), action)).toBe(false);
  });

  it("allows a user assigned to both departments to access both", () => {
    const itAction: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    const facilitiesAction: AuthorizationAction = {
      kind: "access_ticket",
      resource: facilitiesTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(bothDepartmentsAgent(), itAction)).toBe(true);
    expect(authorize(bothDepartmentsAgent(), facilitiesAction)).toBe(true);
  });

  it("allows a system administrator to perform administrative actions", () => {
    expect(authorize(systemAdministrator(), ADMINISTER)).toBe(true);
  });

  it("denies an ordinary requester administrative actions", () => {
    expect(authorize(requester(), ADMINISTER)).toBe(false);
  });

  it("still allows a system administrator ordinary ticket access", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(systemAdministrator(), action)).toBe(true);
  });

  it("allows an IT agent to manage an IT ticket's status, priority, and assignment", () => {
    const action: AuthorizationAction = {
      kind: "manage_ticket",
      resource: itTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(itAgent(), action)).toBe(true);
  });

  it("denies a requester management of their own ticket", () => {
    const action: AuthorizationAction = {
      kind: "manage_ticket",
      resource: itTicket({ requesterId: REQUESTER_ID }),
    };
    expect(authorize(requester(), action)).toBe(false);
  });

  it("denies a Facilities agent management of an IT ticket", () => {
    const action: AuthorizationAction = {
      kind: "manage_ticket",
      resource: itTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(facilitiesAgent(), action)).toBe(false);
  });

  it("allows a system administrator to manage any ticket in their organization", () => {
    const action: AuthorizationAction = {
      kind: "manage_ticket",
      resource: facilitiesTicket({ requesterId: OTHER_REQUESTER_ID }),
    };
    expect(authorize(systemAdministrator(), action)).toBe(true);
  });

  it("denies cross-organization ticket management even for an assigned department agent", () => {
    const action: AuthorizationAction = {
      kind: "manage_ticket",
      resource: itTicket({ organizationId: ORG_B }),
    };
    expect(authorize(itAgent(), action)).toBe(false);
  });

  it("denies every action for an anonymous actor", () => {
    const anonymous: ResolvedActor = { status: "anonymous" };
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket(),
    };
    expect(authorize(anonymous, CREATE_TICKET)).toBe(false);
    expect(authorize(anonymous, action)).toBe(false);
    expect(authorize(anonymous, ADMINISTER)).toBe(false);
  });

  it("denies every action when the session user has no matching database row", () => {
    const missing: ResolvedActor = { status: "user_not_found" };
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket(),
    };
    expect(authorize(missing, CREATE_TICKET)).toBe(false);
    expect(authorize(missing, action)).toBe(false);
    expect(authorize(missing, ADMINISTER)).toBe(false);
  });

  it("denies every action for an inactive user", () => {
    const inactive: ResolvedActor = { status: "inactive" };
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket(),
    };
    expect(authorize(inactive, CREATE_TICKET)).toBe(false);
    expect(authorize(inactive, action)).toBe(false);
    expect(authorize(inactive, ADMINISTER)).toBe(false);
  });

  it("denies access to a ticket in a different organization, even for its own requester", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ requesterId: REQUESTER_ID, organizationId: ORG_B }),
    };
    expect(authorize(requester(), action)).toBe(false);
  });

  it("denies cross-organization access even for a system administrator", () => {
    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: itTicket({ organizationId: ORG_B }),
    };
    expect(authorize(systemAdministrator(), action)).toBe(false);
  });

  it("fails closed for an unrecognized action kind", () => {
    const unknownAction = {
      kind: "self_destruct",
    } as unknown as AuthorizationAction;
    expect(authorize(systemAdministrator(), unknownAction)).toBe(false);
  });

  it("ignores a role or department claim forged onto the resource rather than the actor", () => {
    // Simulates a client attempting to smuggle an elevated claim through
    // the resource payload instead of through the (server-trusted) actor.
    // authorize() has no code path that reads such a field, so it must be
    // silently ignored and the real actor's fields must still govern.
    const forgedResource = {
      ...itTicket({ requesterId: OTHER_REQUESTER_ID }),
      isSystemAdministrator: true,
      departmentCode: "IT",
    } as TicketResourceDescriptor & { isSystemAdministrator: boolean };

    const action: AuthorizationAction = {
      kind: "access_ticket",
      resource: forgedResource,
    };
    expect(authorize(requester(), action)).toBe(false);
  });
});
