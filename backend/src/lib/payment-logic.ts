/**
 * Pure business logic functions for payment milestones and notifications.
 * Extracted here so they can be unit-tested without network/DB dependencies.
 */

// ─── Milestone definitions ────────────────────────────────────────────────────
// Each entry: name → days before due date (negative = days past due)
export const MILESTONES: Record<string, number> = {
  created: Infinity, // fired manually at creation
  "60d": 60,
  "45d": 45,
  "30d": 30,
  "15d": 15,
  due: 0,
  "1w_late": -7,
  "2w_late": -14,
  "3w_late": -21,
  "4w_late": -28,
};

/**
 * Given how many days remain until a payment is due (negative = overdue),
 * return the list of milestone names that should fire.
 *
 * @param daysUntilDue   Positive = days left, 0 = due today, negative = days overdue
 * @param alreadySent    Set of milestone names already sent for this period
 */
export function getMilestonesToFire(
  daysUntilDue: number,
  alreadySent: Set<string>
): string[] {
  const toFire: string[] = [];

  for (const [name, daysBefore] of Object.entries(MILESTONES)) {
    if (name === "created") continue; // only sent on creation
    // Fire when we're at or past the threshold and haven't sent yet
    if (daysUntilDue <= daysBefore && !alreadySent.has(name)) {
      toFire.push(name);
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
