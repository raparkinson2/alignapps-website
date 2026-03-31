import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getMilestonesToFire, buildReminderMessage } from "../lib/payment-logic";
import { readFileSync } from "fs";
import { join } from "path";

const paymentRemindersRouter = new Hono();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const SendManualSchema = z.object({
  periodId: z.string().min(1, "periodId is required"),
  teamId: z.string().min(1, "teamId is required"),
});

const OnCreateSchema = z.object({
  periodId: z.string().min(1, "periodId is required"),
  teamId: z.string().min(1, "teamId is required"),
  playerIds: z.array(z.string()).min(1, "playerIds must have at least one entry"),
  title: z.string().default("Payment"),
  amount: z.number().default(0),
  dueDate: z.string().nullable().optional(),
});

// ─── Persistent sent-milestone tracking ───────────────────────────────────────
// Stored on disk so server restarts don't cause milestone re-fires.
// Falls back to in-memory if the file can't be read/written.
const LOG_PATH = join(import.meta.dir, "../../../data/payment-milestone-log.json");

type MilestoneLog = Record<string, string[]>; // periodId → milestone keys[]

function readLog(): MilestoneLog {
  try {
    const text = readFileSync(LOG_PATH, "utf-8");
    return JSON.parse(text) as MilestoneLog;
  } catch {
    return {};
  }
}

function writeLog(log: MilestoneLog): void {
  try {
    Bun.write(LOG_PATH, JSON.stringify(log, null, 2));
  } catch (err) {
    console.error("[payment-reminders] Failed to persist milestone log:", err);
  }
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
    // 1. Fetch all payment periods with a due date (1 query)
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

    // 2. Read the milestone log ONCE upfront (not per-period)
    const log = readLog();
    let logDirty = false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 3. First pass: determine which periods actually need action
    type PeriodWork = {
      period: typeof periods[number];
      daysUntilDue: number;
      dueDate: Date;
      milestonesToFire: string[];
    };

    const workList: PeriodWork[] = [];

    for (const period of periods) {
      const dueDate = new Date(period.due_date);
      const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const daysUntilDue = Math.round((dueDateMidnight.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const alreadySent = new Set<string>(log[period.id] ?? []);
      const milestonesToFire = getMilestonesToFire(daysUntilDue, alreadySent);

      if (milestonesToFire.length > 0) {
        workList.push({ period, daysUntilDue, dueDate, milestonesToFire });
      }
    }

    if (workList.length === 0) {
      console.log("[payment-reminders] No milestones to fire.");
      return;
    }

    // 4. Batch-fetch ALL player_payments for actionable periods in ONE query
    const periodIds = workList.map((w) => w.period.id);

    const { data: allPlayerPayments, error: ppError } = await supabaseAdmin
      .from("player_payments")
      .select("payment_period_id, player_id, status")
      .in("payment_period_id", periodIds)
      .in("status", ["unpaid", "partial"]);

    if (ppError) {
      console.error("[payment-reminders] Error batch-fetching player payments:", ppError.message);
      return;
    }

    // 5. Group unpaid player IDs by period ID in memory (zero additional queries)
    const unpaidByPeriod = new Map<string, string[]>();
    for (const pp of allPlayerPayments ?? []) {
      if (!unpaidByPeriod.has(pp.payment_period_id)) {
        unpaidByPeriod.set(pp.payment_period_id, []);
      }
      if (pp.player_id) unpaidByPeriod.get(pp.payment_period_id)!.push(pp.player_id);
    }

    // 6. Second pass: send notifications using in-memory grouped data
    for (const { period, daysUntilDue, dueDate, milestonesToFire } of workList) {
      const unpaidPlayerIds = unpaidByPeriod.get(period.id) ?? [];

      if (unpaidPlayerIds.length === 0) {
        // All paid — mark milestones done to prevent future checks
        for (const milestone of milestonesToFire) {
          if (!log[period.id]) log[period.id] = [];
          if (!log[period.id]!.includes(milestone)) {
            log[period.id]!.push(milestone);
            logDirty = true;
          }
        }
        continue;
      }

      for (const milestone of milestonesToFire) {
        const { title, body } = buildReminderMessage(daysUntilDue, period.title, period.amount, dueDate);

        console.log(`[payment-reminders] Firing milestone "${milestone}" for period "${period.title}" to ${unpaidPlayerIds.length} player(s)`);

        await sendReminderToPlayers(unpaidPlayerIds, title, body, {
          type: "payment_reminder",
          periodId: period.id,
          teamId: period.team_id,
          milestone,
        });

        if (!log[period.id]) log[period.id] = [];
        if (!log[period.id]!.includes(milestone)) {
          log[period.id]!.push(milestone);
          logDirty = true;
        }
      }
    }

    // 7. Write the log ONCE at the end if anything changed
    if (logDirty) writeLog(log);

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
paymentRemindersRouter.post("/send-manual", zValidator("json", SendManualSchema), async (c) => {
  const { periodId, teamId } = c.req.valid("json");

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
paymentRemindersRouter.post("/on-create", zValidator("json", OnCreateSchema), async (c) => {
  const { periodId, teamId, playerIds, title, amount, dueDate = null } = c.req.valid("json");

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

  // Mark "created" milestone as sent (read-then-write in one pass)
  const log = readLog();
  if (!log[periodId]) log[periodId] = [];
  if (!log[periodId]!.includes("created")) {
    log[periodId]!.push("created");
    writeLog(log);
  }

  return c.json({ message: "Creation notifications sent", sent: playerIds.length });
});

export { paymentRemindersRouter };
