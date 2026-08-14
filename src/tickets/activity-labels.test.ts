import { describe, expect, it } from "vitest";
import { describeTicketActivity } from "./activity-labels";

const names: Record<string, string> = {
  "user-jordan": "Jordan Agent",
  "user-alex": "Alex Agent",
};
const resolveUserName = (userId: string) => names[userId] ?? "someone";

describe("describeTicketActivity", () => {
  it("describes ticket creation without reference to status", () => {
    expect(
      describeTicketActivity({
        activityType: "created",
        previousValue: null,
        newValue: "submitted",
        resolveUserName,
      }),
    ).toBe("Ticket submitted");
  });

  it("describes a status change using friendly labels", () => {
    expect(
      describeTicketActivity({
        activityType: "status_changed",
        previousValue: "submitted",
        newValue: "in_progress",
        resolveUserName,
      }),
    ).toBe("Status changed from Received to In progress");
  });

  it("describes a priority change using friendly labels", () => {
    expect(
      describeTicketActivity({
        activityType: "priority_changed",
        previousValue: "normal",
        newValue: "urgent",
        resolveUserName,
      }),
    ).toBe("Priority changed from Normal to Urgent");
  });

  it("describes a first-time assignment by display name", () => {
    expect(
      describeTicketActivity({
        activityType: "assignment_changed",
        previousValue: null,
        newValue: "user-jordan",
        resolveUserName,
      }),
    ).toBe("Assigned to Jordan Agent");
  });

  it("describes a reassignment between two agents", () => {
    expect(
      describeTicketActivity({
        activityType: "assignment_changed",
        previousValue: "user-jordan",
        newValue: "user-alex",
        resolveUserName,
      }),
    ).toBe("Reassigned from Jordan Agent to Alex Agent");
  });

  it("describes an unassignment", () => {
    expect(
      describeTicketActivity({
        activityType: "assignment_changed",
        previousValue: "user-jordan",
        newValue: null,
        resolveUserName,
      }),
    ).toBe("Unassigned from Jordan Agent");
  });

  it("never renders a raw user id — only names from resolveUserName", () => {
    const text = describeTicketActivity({
      activityType: "assignment_changed",
      previousValue: null,
      newValue: "user-jordan",
      resolveUserName,
    });
    expect(text).not.toContain("user-jordan");
  });
});
