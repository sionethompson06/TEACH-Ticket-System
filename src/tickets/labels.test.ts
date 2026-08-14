import { describe, expect, it } from "vitest";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "./labels";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "./ticket-status";

describe("TICKET_STATUS_LABELS", () => {
  it("has a friendly label for every documented status, with no internal value leaking through", () => {
    for (const status of TICKET_STATUSES) {
      expect(TICKET_STATUS_LABELS[status]).toBeTypeOf("string");
      expect(TICKET_STATUS_LABELS[status]).not.toBe(status);
    }
  });

  it("matches the exact documented labels", () => {
    expect(TICKET_STATUS_LABELS.submitted).toBe("Received");
    expect(TICKET_STATUS_LABELS.in_progress).toBe("In progress");
    expect(TICKET_STATUS_LABELS.waiting_for_requester).toBe("Waiting for you");
    expect(TICKET_STATUS_LABELS.resolved).toBe("Resolved");
    expect(TICKET_STATUS_LABELS.reopened).toBe("Reopened");
    expect(TICKET_STATUS_LABELS.closed).toBe("Closed");
  });
});

describe("TICKET_PRIORITY_LABELS", () => {
  it("has a friendly label for every documented priority", () => {
    for (const priority of TICKET_PRIORITIES) {
      expect(TICKET_PRIORITY_LABELS[priority]).toBeTypeOf("string");
    }
  });
});
