import { describe, expect, it } from "vitest";
import { formatTicketNumber, parseTicketNumber } from "./ticket-number";

describe("formatTicketNumber", () => {
  it("formats a small ticket number with zero-padding", () => {
    expect(formatTicketNumber(1)).toBe("TKT-000001");
  });

  it("formats a larger ticket number without truncating digits", () => {
    expect(formatTicketNumber(123456)).toBe("TKT-123456");
    expect(formatTicketNumber(1234567)).toBe("TKT-1234567");
  });
});

describe("parseTicketNumber", () => {
  it("parses a well-formed ticket number", () => {
    expect(parseTicketNumber("TKT-000001")).toBe(1);
    expect(parseTicketNumber("TKT-123456")).toBe(123456);
  });

  it("round-trips with formatTicketNumber for any positive integer", () => {
    for (const n of [1, 42, 999999, 1234567]) {
      expect(parseTicketNumber(formatTicketNumber(n))).toBe(n);
    }
  });

  it("rejects a missing or wrong prefix", () => {
    expect(parseTicketNumber("000001")).toBeNull();
    expect(parseTicketNumber("TICKET-000001")).toBeNull();
    expect(parseTicketNumber("tkt-000001")).toBeNull();
  });

  it("rejects too few digits", () => {
    expect(parseTicketNumber("TKT-1")).toBeNull();
    expect(parseTicketNumber("TKT-00001")).toBeNull();
  });

  it("rejects extra characters or a non-numeric value", () => {
    expect(parseTicketNumber("TKT-000001 ")).toBeNull();
    expect(parseTicketNumber(" TKT-000001")).toBeNull();
    expect(parseTicketNumber("TKT-0000ab")).toBeNull();
    expect(parseTicketNumber("TKT-000001/../etc")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseTicketNumber("")).toBeNull();
  });
});
