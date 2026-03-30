import { describe, it, expect } from "bun:test";
import {
  getMilestonesToFire,
  buildReminderMessage,
  calculatePlatformFee,
} from "../lib/payment-logic";

// ─── getMilestonesToFire ──────────────────────────────────────────────────────

describe("getMilestonesToFire", () => {
  it("fires the 60d milestone when exactly 60 days remain", () => {
    const result = getMilestonesToFire(60, new Set());
    expect(result).toContain("60d");
  });

  it("fires multiple past-threshold milestones at once", () => {
    // 0 days left means "due today" → 60d, 45d, 30d, 15d, and "due" should all fire
    const result = getMilestonesToFire(0, new Set());
    expect(result).toContain("60d");
    expect(result).toContain("45d");
    expect(result).toContain("30d");
    expect(result).toContain("15d");
    expect(result).toContain("due");
  });

  it("fires overdue milestones when payment is 7 days late", () => {
    const result = getMilestonesToFire(-7, new Set());
    expect(result).toContain("1w_late");
  });

  it("fires all overdue milestones when 28 days late", () => {
    const result = getMilestonesToFire(-28, new Set());
    expect(result).toContain("1w_late");
    expect(result).toContain("2w_late");
    expect(result).toContain("3w_late");
    expect(result).toContain("4w_late");
  });

  it("does not fire milestones that are already sent", () => {
    const alreadySent = new Set(["60d", "45d"]);
    const result = getMilestonesToFire(60, alreadySent);
    expect(result).not.toContain("60d");
    expect(result).not.toContain("45d");
  });

  it("does not fire any milestones when payment is far in the future", () => {
    const result = getMilestonesToFire(90, new Set());
    expect(result).toHaveLength(0);
  });

  it("never fires the 'created' milestone", () => {
    const result = getMilestonesToFire(-100, new Set());
    expect(result).not.toContain("created");
  });

  it("fires nothing when all milestones already sent", () => {
    const allSent = new Set(["60d", "45d", "30d", "15d", "due", "1w_late", "2w_late", "3w_late", "4w_late"]);
    const result = getMilestonesToFire(-28, allSent);
    expect(result).toHaveLength(0);
  });
});

// ─── buildReminderMessage ────────────────────────────────────────────────────

describe("buildReminderMessage", () => {
  const periodTitle = "Season Dues";
  const amount = 150;
  const dueDate = new Date("2025-06-15");

  it("builds a 'due in N days' message for future payments", () => {
    const { title, body } = buildReminderMessage(30, periodTitle, amount, dueDate);
    expect(title).toBe("Payment Due in 30 Days");
    expect(body).toContain("Season Dues");
    expect(body).toContain("$150");
  });

  it("uses singular 'Day' when exactly 1 day remains", () => {
    const { title } = buildReminderMessage(1, periodTitle, amount, dueDate);
    expect(title).toBe("Payment Due in 1 Day");
  });

  it("builds a 'due today' message when daysUntilDue is 0", () => {
    const { title, body } = buildReminderMessage(0, periodTitle, amount, dueDate);
    expect(title).toBe("Payment Due Today");
    expect(body).toContain("due today");
  });

  it("builds an overdue message when payment is past due", () => {
    const { title, body } = buildReminderMessage(-7, periodTitle, amount, dueDate);
    expect(title).toBe("Payment 7 Days Overdue");
    expect(body).toContain("Season Dues");
    expect(body).toContain("$150");
  });

  it("uses singular 'Day' when exactly 1 day overdue", () => {
    const { title } = buildReminderMessage(-1, periodTitle, amount, dueDate);
    expect(title).toBe("Payment 1 Day Overdue");
  });

  it("includes the due date string in future payment messages", () => {
    const { body } = buildReminderMessage(15, periodTitle, amount, dueDate);
    expect(body).toContain("June 15, 2025");
  });
});

// ─── calculatePlatformFee ────────────────────────────────────────────────────

describe("calculatePlatformFee", () => {
  it("calculates 0.5% fee on $100 (10000 cents)", () => {
    expect(calculatePlatformFee(10000, "0.5")).toBe(50);
  });

  it("calculates 1% fee correctly", () => {
    expect(calculatePlatformFee(10000, "1")).toBe(100);
  });

  it("rounds to the nearest cent", () => {
    // 0.5% of $99.99 = 49.995 cents → rounds to 50
    expect(calculatePlatformFee(9999, "0.5")).toBe(50);
  });

  it("uses 0.5% as the default fee", () => {
    expect(calculatePlatformFee(10000)).toBe(50);
  });

  it("returns 0 for a 0% fee", () => {
    expect(calculatePlatformFee(10000, "0")).toBe(0);
  });

  it("handles large amounts correctly", () => {
    // $500 * 0.5% = $2.50
    expect(calculatePlatformFee(50000, "0.5")).toBe(250);
  });
});
