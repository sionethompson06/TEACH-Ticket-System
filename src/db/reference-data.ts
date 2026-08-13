export type LocationType = "school_campus" | "central_office" | "system_wide";

export interface ReferenceOrganization {
  id: string;
  code: string;
  name: string;
}

export interface ReferenceSchool {
  id: string;
  code: string;
  name: string;
  gradeBand: string;
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
