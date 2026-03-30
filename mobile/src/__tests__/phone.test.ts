import { describe, it, expect } from "bun:test";
import {
  formatPhoneNumber,
  formatPhoneInput,
  unformatPhone,
} from "../lib/phone";

// ─── formatPhoneNumber ────────────────────────────────────────────────────────

describe("formatPhoneNumber", () => {
  it("formats a plain 10-digit string", () => {
    expect(formatPhoneNumber("5551234567")).toBe("(555)123-4567");
  });

  it("formats a number with existing dashes", () => {
    expect(formatPhoneNumber("555-123-4567")).toBe("(555)123-4567");
  });

  it("formats a number with spaces", () => {
    expect(formatPhoneNumber("555 123 4567")).toBe("(555)123-4567");
  });

  it("formats a number with country code +1", () => {
    expect(formatPhoneNumber("+15551234567")).toBe("(555)123-4567");
  });

  it("formats a number with country code 1 (no +)", () => {
    expect(formatPhoneNumber("15551234567")).toBe("(555)123-4567");
  });

  it("returns an empty string for null input", () => {
    expect(formatPhoneNumber(null)).toBe("");
  });

  it("returns an empty string for undefined input", () => {
    expect(formatPhoneNumber(undefined)).toBe("");
  });

  it("returns an empty string for empty string input", () => {
    expect(formatPhoneNumber("")).toBe("");
  });

  it("returns partial/international numbers as-is", () => {
    expect(formatPhoneNumber("12345")).toBe("12345");
  });
});

// ─── formatPhoneInput ────────────────────────────────────────────────────────

describe("formatPhoneInput", () => {
  it("returns empty string for empty input", () => {
    expect(formatPhoneInput("")).toBe("");
  });

  it("formats first 3 digits with opening paren", () => {
    expect(formatPhoneInput("555")).toBe("(555");
  });

  it("formats 6 digits with area code and prefix", () => {
    expect(formatPhoneInput("555123")).toBe("(555)123");
  });

  it("formats full 10 digits into (XXX)XXX-XXXX", () => {
    expect(formatPhoneInput("5551234567")).toBe("(555)123-4567");
  });

  it("strips non-numeric characters before formatting", () => {
    expect(formatPhoneInput("555abc123")).toBe("(555)123");
  });

  it("truncates to 10 digits maximum", () => {
    expect(formatPhoneInput("55512345678901")).toBe("(555)123-4567");
  });
});

// ─── unformatPhone ────────────────────────────────────────────────────────────

describe("unformatPhone", () => {
  it("strips parentheses, dashes, and spaces", () => {
    expect(unformatPhone("(555)123-4567")).toBe("5551234567");
  });

  it("returns only digits from a mixed string", () => {
    expect(unformatPhone("+1 (555) 123-4567")).toBe("15551234567");
  });

  it("returns empty string for an empty input", () => {
    expect(unformatPhone("")).toBe("");
  });

  it("returns the same string when input is already digits only", () => {
    expect(unformatPhone("5551234567")).toBe("5551234567");
  });
});
