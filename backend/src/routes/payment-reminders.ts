import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { getMilestonesToFire, buildReminderMessage } from "../lib/payment-logic";

const paymentRemindersRouter = new Hono();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory tracking: periodId -> Set of milestones already sent
// This persists across scheduler runs within a server session.
// On restart, the scheduler re-evaluates based on dates (may resend due/overdue milestones).
const sentMilestones = new Map<string, Set<string>>();

function getSentForPeriod(periodId: string): Set<string> {
  if (!sentMilestones.has(periodId)) {
    sentMilestones.set(periodId, new Set());
  }
  return sentMilestones.get(periodId)!;
}

function markSent(periodId: string, milestone: string) {
  getSentForPeriod(periodId).add(milestone);
}

// ─── Push notification helper ─────────────────────────────────────────────────
async function sendReminderToPlayers(
  playerIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (playerIds.length === 0) return;

  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const res = await fetch(`${backendUrl}/api/notifications/send-to-players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds, title, body, data }),
    });
    const result = await res.json() as { sent?: number; failed?: number };
    console.log(`[payment-reminders] Push sent: ${result.sent ?? 0} ok, ${result.failed ?? 0} failed`);
  } catch (err) {
    console.error("[payment-reminders] Failed to send push notifications:", err);
  }
}

// ─── Core check: find all periods with due dates, send pending milestones ──────
export async function checkAndSendPaymentReminders() {
  console.log("[payment-reminders] Running scheduled check...");

  try {
    // Fetch all payment periods with a due date
    const { data: periods, error: periodsError } = await supabaseAdmin
      .from("payment_periods")
      .select("id, team_id, title, amount, due_date")
      .not("due_date", "is", null);

    if (periodsError) {
      console.error("[payment-reminders] Error fetching payment periods:", periodsError.message);
      return;
    }

    if (!periods || periods.length === 0) {
      console.log("[payment-reminders] No payment periods with due dates found.");
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const period of periods) {
      const dueDate = new Date(period.due_date);
      const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const daysUntilDue = Math.round((dueDateMidnight.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Determine which milestone(s) to fire based on current days until due
      const milestonesToFire = getMilestonesToFire(daysUntilDue, getSentForPeriod(period.id));

      if (milestonesToFire.length === 0) continue;

      // Get unpaid player IDs for this period
      const { data: playerPayments, error: ppError } = await supabaseAdmin
        .from("player_payments")
        .select("player_id, status, amount")
        .eq("payment_period_id", period.id)
        .in("status", ["unpaid", "partial"]);

      if (ppError) {
        console.error(`[payment-reminders] Error fetching player payments for period ${period.id}:`, ppError.message);
        continue;
      }

      const unpaidPlayerIds = (playerPayments ?? [])
        .map((pp: { player_id: string }) => pp.player_id)
        .filter(Boolean);

      if (unpaidPlayerIds.length === 0) {
        // All paid — mark all milestones as sent to prevent future checks
        for (const milestone of milestonesToFire) {
          markSent(period.id, milestone);
        }
        continue;
      }

      // Build notification message
      for (const milestone of milestonesToFire) {
        const { title, body } = buildReminderMessage(daysUntilDue, period.title, period.amount, dueDate);

        console.log(`[payment-reminders] Firing milestone "${milestone}" for period "${period.title}" to ${unpaidPlayerIds.length} player(s)`);

        await sendReminderToPlayers(unpaidPlayerIds, title, body, {
          type: "payment_reminder",
          periodId: period.id,
          teamId: period.team_id,
          milestone,
        });

        markSent(period.id, milestone);
      }
    }

    console.log("[payment-reminders] Scheduled check complete.");
  } catch (err) {
    console.error("[payment-reminders] Unexpected error during check:", err);
  }
}

// ─── Schedule background job (every 6 hours) ──────────────────────────────────
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function startPaymentReminderScheduler() {
  // Run an initial check after 30s startup delay
  setTimeout(() => {
    checkAndSendPaymentReminders().catch(console.error);
  }, 30_000);

  // Then check every 6 hours
  setInterval(() => {
    checkAndSendPaymentReminders().catch(console.error);
  }, SIX_HOURS_MS);

  console.log("[payment-reminders] Scheduler started (checks every 6 hours).");
}

// ─── API Routes ────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/reminders/send-manual
 * Manually trigger a payment reminder for a specific period to all unpaid players.
 * Called from the admin UI when they tap "Send Reminder".
 */
paymentRemindersRouter.post("/send-manual", async (c) => {
  let periodId = "", teamId = "";
  try {
    const body = await c.req.json();
    periodId = body.periodId || "";
    teamId = body.teamId || "";
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!periodId || !teamId) {
    return c.json({ error: "periodId and teamId are required" }, 400);
  }

  // Fetch period details
  const { data: period, error: periodError } = await supabaseAdmin
    .from("payment_periods")
    .select("id, title, amount, due_date")
    .eq("id", periodId)
    .single();

  if (periodError || !period) {
    return c.json({ error: "Payment period not found" }, 404);
  }

  // Get unpaid players
  const { data: playerPayments, error: ppError } = await supabaseAdmin
    .from("player_payments")
    .select("player_id, status")
    .eq("payment_period_id", periodId)
    .in("status", ["unpaid", "partial"]);

  if (ppError) {
    return c.json({ error: "Failed to fetch player payments" }, 500);
  }

  const unpaidPlayerIds = (playerPayments ?? [])
    .map((pp: { player_id: string }) => pp.player_id)
    .filter(Boolean);

  if (unpaidPlayerIds.length === 0) {
    return c.json({ message: "All players have paid — no reminders sent", sent: 0 });
  }

  // Build message
  const dueDateStr = period.due_date
    ? new Date(period.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const title = "Payment Reminder";
  const body = dueDateStr
    ? `"${period.title}" — $${period.amount} is due on ${dueDateStr}. Please pay soon!`
    : `"${period.title}" — $${period.amount} is outstanding. Please pay when you can.`;

  console.log(`[payment-reminders] Manual reminder for period "${period.title}" to ${unpaidPlayerIds.length} player(s)`);

  await sendReminderToPlayers(unpaidPlayerIds, title, body, {
    type: "payment_reminder",
    periodId,
    teamId,
    milestone: "manual",
  });

  return c.json({ message: "Reminders sent", sent: unpaidPlayerIds.length });
});

/**
 * POST /api/payments/reminders/on-create
 * Called when a payment period with a due date is created.
 * Sends an immediate "new payment period" notification to all assigned players.
 */
paymentRemindersRouter.post("/on-create", async (c) => {
  let periodId = "", teamId = "", playerIds: string[] = [], title = "", amount = 0, dueDate: string | null = null;
  try {
    const body = await c.req.json();
    periodId = body.periodId || "";
    teamId = body.teamId || "";
    playerIds = body.playerIds || [];
    title = body.title || "Payment";
    amount = body.amount || 0;
    dueDate = body.dueDate || null;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!periodId || !teamId || playerIds.length === 0) {
    return c.json({ error: "periodId, teamId, and playerIds are required" }, 400);
  }

  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const notifTitle = "New Payment Period";
  const notifBody = dueDateStr
    ? `"${title}" — $${amount} is due by ${dueDateStr}.`
    : `"${title}" — $${amount} has been added.`;

  console.log(`[payment-reminders] Creation notification for period "${title}" to ${playerIds.length} player(s)`);

  await sendReminderToPlayers(playerIds, notifTitle, notifBody, {
    type: "payment_created",
    periodId,
    teamId,
  });

  // Mark "created" milestone as sent
  markSent(periodId, "created");

  return c.json({ message: "Creation notifications sent", sent: playerIds.length });
});

export { paymentRemindersRouter };
