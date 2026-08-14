import { describe, expect, it } from "vitest";
import { formatTicketNumber } from "./ticket-number";

describe("formatTicketNumber", () => {
  it("formats a small ticket number with zero-padding", () => {
    expect(formatTicketNumber(1)).toBe("TKT-000001");
  });

  it("formats a larger ticket number without truncating digits", () => {
    expect(formatTicketNumber(123456)).toBe("TKT-123456");
    expect(formatTicketNumber(1234567)).toBe("TKT-1234567");
  });
});
