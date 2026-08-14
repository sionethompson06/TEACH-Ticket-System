import { describe, expect, it, vi } from "vitest";
import type { AuthAccessMode } from "../auth/access-mode";
import {
  bootstrapFirstSystemAdministrator,
  normalizeEmailForAccessMode,
} from "./bootstrap";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";

const WORKSPACE_MODE: AuthAccessMode = {
  kind: "workspace",
  allowedDomain: "teachps.org",
};

// Dependency-injected fake database — no PGlite/network needed. Mirrors
// only the query shapes bootstrap.ts issues in workspace mode: a single
// select().from(user).where(...) lookup, and (in apply mode, when
// applicable) a single update().set().where(...) mutation. This is a pure
// unit test of the workspace-mode branching logic; src/db/admin-bootstrap.test.ts
// separately exercises both modes (including invite_only's Google-account
// and accepted-invitation requirements) against a real, synthetic PGlite
// database.
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

describe("normalizeEmailForAccessMode", () => {
  it("normalizes case and surrounding whitespace in workspace mode", () => {
    expect(
      normalizeEmailForAccessMode(
        "  Pat.Administrator@TEACHPS.ORG  ",
        WORKSPACE_MODE,
      ),
    ).toBe("pat.administrator@teachps.org");
  });

  it("rejects a personal email domain in workspace mode", () => {
    expect(
      normalizeEmailForAccessMode("pat@gmail.com", WORKSPACE_MODE),
    ).toBeNull();
  });

  it("rejects a malformed email in workspace mode", () => {
    expect(
      normalizeEmailForAccessMode("not-an-email", WORKSPACE_MODE),
    ).toBeNull();
  });

  it("rejects an empty string in workspace mode", () => {
    expect(normalizeEmailForAccessMode("", WORKSPACE_MODE)).toBeNull();
  });

  it("accepts any valid-shape email domain in invite_only mode", () => {
    expect(
      normalizeEmailForAccessMode("pat@gmail.com", { kind: "invite_only" }),
    ).toBe("pat@gmail.com");
  });

  it("rejects a malformed email in invite_only mode", () => {
    expect(
      normalizeEmailForAccessMode("not-an-email", { kind: "invite_only" }),
    ).toBeNull();
  });
});

describe("bootstrapFirstSystemAdministrator (unit, fake database, workspace mode)", () => {
  it("rejects a non-@teachps.org email without querying the database", async () => {
    const { db, updateSet } = createFakeDb(undefined);

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "someone@gmail.com",
      apply: false,
      accessMode: WORKSPACE_MODE,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("errors when no user with that email exists", async () => {
    const { db } = createFakeDb(undefined);

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "nobody@teachps.org",
      apply: false,
      accessMode: WORKSPACE_MODE,
    });

    expect(outcome.kind).toBe("error");
  });

  it("errors for an inactive user and never updates", async () => {
    const { db, updateSet } = createFakeDb(baseRow({ isActive: false }));

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      confirmEmail: "pat.administrator@teachps.org",
      apply: true,
      accessMode: WORKSPACE_MODE,
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
      accessMode: WORKSPACE_MODE,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("requires --confirm-email together with --apply and never updates", async () => {
    const { db, updateSet } = createFakeDb(baseRow());

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      apply: true,
      accessMode: WORKSPACE_MODE,
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
      accessMode: WORKSPACE_MODE,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("describes the planned action in dry-run mode and never updates", async () => {
    const { db, updateSet } = createFakeDb(baseRow());

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      apply: false,
      accessMode: WORKSPACE_MODE,
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
      accessMode: WORKSPACE_MODE,
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

  it("is idempotent when the user is already a system administrator", async () => {
    const { db, updateSet } = createFakeDb(
      baseRow({ isSystemAdministrator: true }),
    );

    const dryRunOutcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      apply: false,
      accessMode: WORKSPACE_MODE,
    });
    expect(dryRunOutcome).toEqual({
      kind: "dry_run",
      targetName: "Pat Administrator",
      targetEmail: "pat.administrator@teachps.org",
      alreadyAdministrator: true,
    });

    const applyOutcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "pat.administrator@teachps.org",
      confirmEmail: "pat.administrator@teachps.org",
      apply: true,
      accessMode: WORKSPACE_MODE,
    });
    expect(applyOutcome).toEqual({
      kind: "no_change",
      targetName: "Pat Administrator",
      targetEmail: "pat.administrator@teachps.org",
    });

    expect(updateSet).not.toHaveBeenCalled();
  });

  it("normalizes email casing and surrounding whitespace before matching", async () => {
    const { db, updateSet } = createFakeDb(baseRow());

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "  PAT.ADMINISTRATOR@TEACHPS.ORG  ",
      confirmEmail: "  PAT.ADMINISTRATOR@TEACHPS.ORG  ",
      apply: true,
      accessMode: WORKSPACE_MODE,
    });

    expect(outcome.kind).toBe("applied");
    expect(updateSet).toHaveBeenCalledTimes(1);
  });

  it("never creates a user for an unknown email, even in apply mode", async () => {
    const { db, updateSet } = createFakeDb(undefined);

    const outcome = await bootstrapFirstSystemAdministrator(db as never, {
      email: "brand.new.user@teachps.org",
      confirmEmail: "brand.new.user@teachps.org",
      apply: true,
      accessMode: WORKSPACE_MODE,
    });

    expect(outcome.kind).toBe("error");
    expect(updateSet).not.toHaveBeenCalled();
  });
});
