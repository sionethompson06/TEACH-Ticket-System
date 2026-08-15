export type LocationType = "school_campus" | "central_office" | "system_wide";

export interface ReferenceOrganization {
  id: string;
  code: string;
  name: string;
}

export interface ReservedSystemUser {
  id: string;
  name: string;
  email: string;
}

export interface ReferenceSchool {
  id: string;
  code: string;
  name: string;
  gradeBand: string;
}

export interface ReferenceDepartment {
  id: string;
  code: string;
  name: string;
}

export interface ReferenceTicketCategory {
  id: string;
  departmentCode: string;
  code: string;
  name: string;
  displayOrder: number;
}

export interface ReferenceServiceLocation {
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  schoolCode: string | null;
  gradeBand: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

// Stable, hand-assigned UUIDs for the canonical TEACH reference records.
// These must never be regenerated — the seed relies on them staying fixed
// across every run and every environment.
export const REFERENCE_ORGANIZATION: ReferenceOrganization = {
  id: "c5a6e372-c2b7-4692-82e2-6af9057f7b06",
  code: "TEACHPS",
  name: "TEACH Public Schools",
};

// Phase 9B: the reserved internal "Public Intake" user. Used only as the
// database requester/activity-actor for tickets submitted through the
// temporary public (unauthenticated) intake path — it has no Better Auth
// account, session, or credential of any kind, and is marked inactive
// (`is_active = false`) so it can never resolve as an active actor via
// resolveActor()/authorize(), and can never sign in even if a Google
// account were ever linked to its email. Its email uses the reserved
// ".invalid" TLD (RFC 2606) precisely because it must never be a
// deliverable, real address. This constant must never be regenerated —
// seedReferenceData() (src/db/seed-reference-data.ts) idempotently inserts
// this exact id and email after migration 0006 creates the columns it
// depends on, and every public submission's `tickets.requester_id` refers
// to it by this fixed id.
export const REFERENCE_PUBLIC_INTAKE_USER: ReservedSystemUser = {
  id: "281376e5-c088-43ec-9c31-95a912c14cc8",
  name: "Public Intake",
  email: "public-intake@teach-ticket.invalid",
};

export const REFERENCE_SCHOOLS: ReferenceSchool[] = [
  {
    id: "7c2b3b70-3a90-4b38-8062-d36455f0f6c4",
    code: "TPE",
    name: "TEACH Prep Elementary School",
    gradeBand: "TK–5",
  },
  {
    id: "5378b16d-4474-4820-9919-32d45e1ef7f6",
    code: "TAT",
    name: "TEACH Academy of Technologies",
    gradeBand: "5–8",
  },
  {
    id: "42a90713-6eb0-4666-9b64-267f74afbde6",
    code: "TTHS",
    name: "TEACH Tech Charter High School",
    gradeBand: "9–12",
  },
];

// Phase 4 MVP: exactly the two initial departments. No categories, SLAs,
// queues, or other Phase 5 data.
export const REFERENCE_DEPARTMENTS: ReferenceDepartment[] = [
  {
    id: "3576691a-f9ce-45f0-a714-6027194ab176",
    code: "IT",
    name: "Information Technology",
  },
  {
    id: "549f2c7c-0048-4b50-b2c5-fd5ae86ea7f9",
    code: "FACILITIES",
    name: "Facilities",
  },
];

// Phase 5 MVP: the confirmed IT and Facilities categories from
// docs/PROJECT_FOUNDATION.md Sections 4 and 5 — categories only, not the
// representative request types listed alongside them (that level of detail
// is Phase 6+ catalog/form scope).
export const REFERENCE_TICKET_CATEGORIES: ReferenceTicketCategory[] = [
  {
    id: "697234b0-d8bd-48f1-8992-da45fa1866ec",
    departmentCode: "IT",
    code: "STUDENT_STAFF_DEVICES",
    name: "Student and Staff Devices",
    displayOrder: 1,
  },
  {
    id: "89087962-85d9-4d2b-911f-90ec7c9efc5a",
    departmentCode: "IT",
    code: "ACCOUNTS_IDENTITY_ACCESS",
    name: "Accounts, Identity, and Access",
    displayOrder: 2,
  },
  {
    id: "a117b6ba-c917-4504-b14e-7a72545720cf",
    departmentCode: "IT",
    code: "CLASSROOM_TECH_AV",
    name: "Classroom Technology and Audiovisual Equipment",
    displayOrder: 3,
  },
  {
    id: "28fc8e3f-57a9-4817-b43c-bf7e18377790",
    departmentCode: "IT",
    code: "NETWORK_CONNECTIVITY",
    name: "Network and Connectivity",
    displayOrder: 4,
  },
  {
    id: "d0a1df35-dcd7-4aa2-b02c-93b421fe2e8b",
    departmentCode: "IT",
    code: "SOFTWARE_APPS_SUBSCRIPTIONS",
    name: "Software, Applications, and Subscriptions",
    displayOrder: 5,
  },
  {
    id: "4d0cebea-c3dc-497e-9859-928c181a0753",
    departmentCode: "IT",
    code: "PRINTERS_PERIPHERALS",
    name: "Printers and Peripherals",
    displayOrder: 6,
  },
  {
    id: "cc2ec891-17e6-49e5-9080-25201722f1a4",
    departmentCode: "IT",
    code: "IT_ONBOARDING_MOVES_EVENTS",
    name: "IT Onboarding, Moves, and Special Events",
    displayOrder: 7,
  },
  {
    id: "590e7c72-5178-4fec-bd97-926f8efd7c60",
    departmentCode: "FACILITIES",
    code: "HVAC_AIR_QUALITY",
    name: "HVAC and Air Quality",
    displayOrder: 1,
  },
  {
    id: "9d5ac890-27ad-4010-8e52-67b3b35f31c8",
    departmentCode: "FACILITIES",
    code: "ELECTRICAL_LIGHTING",
    name: "Electrical and Lighting",
    displayOrder: 2,
  },
  {
    id: "f5b5559f-7579-439d-a712-df3ee368f5bd",
    departmentCode: "FACILITIES",
    code: "PLUMBING_WATER",
    name: "Plumbing and Water",
    displayOrder: 3,
  },
  {
    id: "4573bb50-c3e9-40de-98f8-5d5a84d75f2c",
    departmentCode: "FACILITIES",
    code: "CUSTODIAL_SERVICES",
    name: "Custodial Services",
    displayOrder: 4,
  },
  {
    id: "aa62e425-d047-4da4-ad44-a499e2c4dc5b",
    departmentCode: "FACILITIES",
    code: "BUILDING_MAINTENANCE",
    name: "Building Maintenance",
    displayOrder: 5,
  },
  {
    id: "b054c121-e27f-4aff-a5f0-046601f55d50",
    departmentCode: "FACILITIES",
    code: "KEYS_LOCKS_ACCESS_CONTROL",
    name: "Keys, Locks, and Access Control",
    displayOrder: 6,
  },
  {
    id: "929ca8e7-75c1-40d7-9aff-4c552f69c079",
    departmentCode: "FACILITIES",
    code: "SAFETY_SECURITY_GROUNDS",
    name: "Safety, Security, and Grounds",
    displayOrder: 7,
  },
  {
    id: "d44b51ec-2e9b-4d9d-b538-084bd1d2b5e7",
    departmentCode: "FACILITIES",
    code: "FURNITURE_MOVES_EVENT_SETUP",
    name: "Furniture, Moves, and Event Setup",
    displayOrder: 8,
  },
];

export const REFERENCE_SERVICE_LOCATIONS: ReferenceServiceLocation[] = [
  {
    id: "3f1bc393-7aad-4821-b3a2-96c236169856",
    code: "TPE",
    name: "TEACH Prep Elementary School",
    locationType: "school_campus",
    schoolCode: "TPE",
    gradeBand: "TK–5",
    addressLine1: "8505 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  {
    id: "7c69db74-f854-49b8-bdcc-4d4a200eada4",
    code: "TAT-56",
    name: "TEACH Academy of Technologies — 5–6 Campus",
    locationType: "school_campus",
    schoolCode: "TAT",
    gradeBand: "5–6",
    addressLine1: "10000 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  {
    id: "4e6277d5-649d-4917-a9e4-329fe0954859",
    code: "TAT-78",
    name: "TEACH Academy of Technologies — 7–8 Campus",
    locationType: "school_campus",
    schoolCode: "TAT",
    gradeBand: "7–8",
    addressLine1: "10045 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  {
    id: "f21616e0-3987-42c7-a3cf-50bab37040ef",
    code: "TTHS",
    name: "TEACH Tech Charter High School",
    locationType: "school_campus",
    schoolCode: "TTHS",
    gradeBand: "9–12",
    addressLine1: "10616 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  {
    id: "bf3a95e0-0bb3-404d-9193-86f0e4220412",
    code: "CMO",
    name: "TEACH Public Schools Central Management Organization",
    locationType: "central_office",
    schoolCode: null,
    gradeBand: null,
    addressLine1: "10600 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  {
    id: "53ef0e78-56e6-4b36-b0c3-55d7f83f7d34",
    code: "SYSTEM",
    name: "Multiple campuses / system-wide",
    locationType: "system_wide",
    schoolCode: null,
    gradeBand: "All",
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
  },
];
