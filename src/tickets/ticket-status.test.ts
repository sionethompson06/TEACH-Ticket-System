import { describe, expect, it } from "vitest";
import { canTransitionTicketStatus } from "./ticket-status";

describe("canTransitionTicketStatus", () => {
  it("allows moving between active states", () => {
    expect(canTransitionTicketStatus("submitted", "in_progress")).toBe(true);
    expect(
      canTransitionTicketStatus("in_progress", "waiting_for_requester"),
    ).toBe(true);
    expect(
      canTransitionTicketStatus("waiting_for_requester", "in_progress"),
    ).toBe(true);
  });

  it("allows moving an active ticket to resolved", () => {
    expect(canTransitionTicketStatus("in_progress", "resolved")).toBe(true);
  });

  it("does not allow moving directly to closed from an active state", () => {
    expect(canTransitionTicketStatus("submitted", "closed")).toBe(false);
    expect(canTransitionTicketStatus("in_progress", "closed")).toBe(false);
  });

  it("allows a resolved ticket to be reopened", () => {
    expect(canTransitionTicketStatus("resolved", "reopened")).toBe(true);
  });

  it("allows a resolved ticket to be closed", () => {
    expect(canTransitionTicketStatus("resolved", "closed")).toBe(true);
  });

  it("does not allow any transition out of closed", () => {
    for (const next of [
      "submitted",
      "in_progress",
      "waiting_for_requester",
      "resolved",
      "reopened",
    ] as const) {
      expect(canTransitionTicketStatus("closed", next)).toBe(false);
    }
  });

  it("allows a reopened ticket to move back into active work", () => {
    expect(canTransitionTicketStatus("reopened", "in_progress")).toBe(true);
    expect(canTransitionTicketStatus("reopened", "resolved")).toBe(true);
  });

  it("rejects a no-op transition to the same status", () => {
    expect(canTransitionTicketStatus("in_progress", "in_progress")).toBe(false);
  });
});
