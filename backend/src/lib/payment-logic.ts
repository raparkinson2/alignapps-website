/**
 * Pure business logic functions for payment milestones and notifications.
 * Extracted here so they can be unit-tested without network/DB dependencies.
 */

// ─── Milestone definitions ────────────────────────────────────────────────────
// Each entry: name → days before due date (negative = days past due)
// "created" is fired manually at creation and excluded from scheduled checks.
export const MILESTONES: Record<string, number> = {
  created: Infinity,
  "60d": 60,
  "45d": 45,
  "30d": 30,
  "15d": 15,
  "7d": 7,
  due: 0,
};

// How many days past a threshold we still allow it to fire (scheduler catch-up grace window).
// e.g., GRACE_DAYS=2 means the "30d" milestone fires when daysUntilDue is 28–30.
// This intentionally does NOT fire old milestones after a restart when many days have passed.
const GRACE_DAYS = 2;

/**
 * Given how many days remain until a payment is due (negative = overdue),
 * return the list of milestone keys that should fire.
 *
 * Pre-due milestones use an exact window (threshold to threshold - GRACE_DAYS)
 * so they never fire retroactively after a server restart.
 *
 * Overdue milestones use a per-day key (overdue_YYYY-MM-DD) so they fire at
 * most once per calendar day, regardless of how many times the scheduler runs.
 *
 * @param daysUntilDue   Positive = days left, 0 = due today, negative = days overdue
 * @param alreadySent    Set of milestone keys already sent for this period
 */
export function getMilestonesToFire(
  daysUntilDue: number,
  alreadySent: Set<string>
): string[] {
  const toFire: string[] = [];

  if (daysUntilDue >= 0) {
    // Pre-due and due: only fire within the grace window of each threshold
    for (const [name, daysBefore] of Object.entries(MILESTONES)) {
      if (name === "created") continue;
      // Fire when daysUntilDue is within [daysBefore - GRACE_DAYS, daysBefore]
      if (
        daysUntilDue <= daysBefore &&
        daysUntilDue >= daysBefore - GRACE_DAYS &&
        !alreadySent.has(name)
      ) {
        toFire.push(name);
      }
    }
  } else {
    // Overdue: fire once per calendar day using the date as the dedup key
    const todayKey = `overdue_${new Date().toISOString().slice(0, 10)}`;
    if (!alreadySent.has(todayKey)) {
      toFire.push(todayKey);
    }
  }

  return toFire;
}

/**
 * Build the push notification title and body for a payment reminder.
 *
 * @param daysUntilDue   Positive = days left, 0 = due today, negative = days overdue
 * @param periodTitle    Name of the payment period (e.g. "Season Dues")
 * @param amount         Dollar amount owed
 * @param dueDate        The due date Date object
 */
export function buildReminderMessage(
  daysUntilDue: number,
  periodTitle: string,
  amount: number,
  dueDate: Date
): { title: string; body: string } {
  const dueDateStr = dueDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (daysUntilDue > 0) {
    return {
      title: `Payment Due in ${daysUntilDue} Day${daysUntilDue !== 1 ? "s" : ""}`,
      body: `"${periodTitle}" — $${amount} is due on ${dueDateStr}. Don't forget to pay!`,
    };
  }

  if (daysUntilDue === 0) {
    return {
      title: "Payment Due Today",
      body: `"${periodTitle}" — $${amount} is due today. Please pay as soon as possible.`,
    };
  }

  const daysLate = Math.abs(daysUntilDue);
  return {
    title: `Payment ${daysLate} Day${daysLate !== 1 ? "s" : ""} Overdue`,
    body: `"${periodTitle}" — $${amount} was due ${dueDateStr}. Please pay to stay up to date.`,
  };
}

/**
 * Calculate the platform application fee for a given payment amount.
 *
 * @param amountCents        Amount in cents
 * @param feePctString       Fee percentage string (e.g. "0.5" = 0.5%)
 */
export function calculatePlatformFee(
  amountCents: number,
  feePctString: string = "0.5"
): number {
  const feePct = parseFloat(feePctString) / 100;
  return Math.round(amountCents * feePct);
}
