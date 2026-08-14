import { describe, expect, it, vi } from "vitest";
import {
  bootstrapFirstSystemAdministrator,
  normalizeTeachEmail,
} from "./bootstrap";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";

// Dependency-injected fake database — no PGlite/network needed. Mirrors
// only the query shapes bootstrap.ts actually issues: a single
// select().from(user).where(...) lookup, and (in apply mode, when
// applicable) a single update().set().where(...) mutation. This is a pure
// unit test of the branching logic; src/db/admin-bootstrap.test.ts
// separately exercises the same function against a real (synthetic,
// PGlite) database.
function createFakeDb(userRow: Record<string, unknown> | undefined) {
  const updateSet = vi.fn();
  const db = {
    select: () => ({
      from: () => ({
        where: async () => (userRow ? [userRow] : []),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updateSet(values);
        return { where: async () => undefined };
      },
    }),
  };
  return { db, updateSet };
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Pat Administrator",
    email: "pat.administrator@teachps.org",
    isActive: true,
    isSystemAdministrator: false,
    organizationId: REFERENCE_ORGANIZATION.id,
    ...overrides,
  };
}

describe("normalizeTeachEmail", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeTeachEmail("  Pat.Administrator@TEACHPS.ORG  ")).toBe(
      "pat.administrator@teachps.org",
    );
  });

  it("rejects a personal email domain", () => {
    expect(normalizeTeachEmail("pat@gmail.com")).toBeNull();
  });

  it("rejects a malformed email", () => {
    expect(normalizeTeachEmail("not-an-email")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(normalizeTeachEmail("")).toBeNull();
  });
});

describe("bootstrapFirstSystemAdministrator (unit, fake database)", () => {
  it("rejects a non-@teachps.org email without querying the database", async () => {
    const { db, updateSet } = createFakeDb(undefined);

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "someone@gmail.com",
      apply: false,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("errors when no user with that email exists", async () => {
    const { db } = createFakeDb(undefined);

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "nobody@teachps.org",
      apply: false,
    });

    expect(outcome.kind).toBe("error");
  });

  it("errors for an inactive user and never updates", async () => {
    const { db, updateSet } = createFakeDb(baseRow({ isActive: false }));

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      confirmEmail: "pat.administrator@teachps.org",
      apply: true,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("errors for a user outside the canonical TEACH organization and never updates", async () => {
    const { db, updateSet } = createFakeDb(
      baseRow({ organizationId: "22222222-2222-2222-2222-222222222222" }),
    );

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      confirmEmail: "pat.administrator@teachps.org",
      apply: true,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("requires --confirm-email together with --apply and never updates", async () => {
    const { db, updateSet } = createFakeDb(baseRow());

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      apply: true,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirm-email and never updates", async () => {
    const { db, updateSet } = createFakeDb(baseRow());

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      confirmEmail: "someone.else@teachps.org",
      apply: true,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("describes the planned action in dry-run mode and never updates", async () => {
    const { db, updateSet } = createFakeDb(baseRow());

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      apply: false,
    });

    expect(outcome).toEqual({
      kind: "dry_run",
      targetName: "Pat Administrator",
      targetEmail: "pat.administrator@teachps.org",
      alreadyAdministrator: false,
    });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("applies the change only with a matching --apply and --confirm-email", async () => {
    const { db, updateSet } = createFakeDb(baseRow());

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      confirmEmail: "pat.administrator@teachps.org",
      apply: true,
    });

    expect(outcome).toEqual({
      kind: "applied",
      targetName: "Pat Administrator",
      targetEmail: "pat.administrator@teachps.org",
    });
    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ isSystemAdministrator: true }),
    );
  });

  it("is idempotent in dry-run mode when already an administrator", async () => {
    const { db, updateSet } = createFakeDb(
      baseRow({ isSystemAdministrator: true }),
    );

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      apply: false,
    });

    expect(outcome).toEqual({
      kind: "dry_run",
      targetName: "Pat Administrator",
      targetEmail: "pat.administrator@teachps.org",
      alreadyAdministrator: true,
    });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("is idempotent in apply mode when already an administrator, making no change", async () => {
    const { db, updateSet } = createFakeDb(
      baseRow({ isSystemAdministrator: true }),
    );

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      confirmEmail: "pat.administrator@teachps.org",
      apply: true,
    });

    expect(outcome).toEqual({
      kind: "no_change",
      targetName: "Pat Administrator",
      targetEmail: "pat.administrator@teachps.org",
    });
    expect(updateSet).not.toHaveBeenCalled();
  });
});
