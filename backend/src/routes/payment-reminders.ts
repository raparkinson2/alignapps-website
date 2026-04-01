import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getMilestonesToFire, buildReminderMessage } from "../lib/payment-logic";
import { readFileSync } from "fs";
import { join } from "path";
import type { Context } from "hono";

const paymentRemindersRouter = new Hono();

function requireInternalSecret(c: Context): Response | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return null;
  const provided = c.req.header("x-admin-secret");
  if (!provided || provided !== secret) {
    return c.json({ error: "Unauthorized" }, 401) as unknown as Response;
  }
  return null;
}

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

// ─── Milestone tracking via Supabase ──────────────────────────────────────────
//
// Table DDL (run once in Supabase SQL Editor):
//
//   CREATE TABLE IF NOT EXISTS payment_milestone_log (
//     period_id  TEXT        NOT NULL,
//     milestone  TEXT        NOT NULL,
//     fired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     PRIMARY KEY (period_id, milestone)
//   );
//
// Benefits over the old file-based approach:
//   - Survives server restarts and redeployments
//   - No unbounded file growth
//   - Visible and queryable from the Supabase dashboard
//   - Works correctly with multiple backend instances
//
// Fallback: if the table doesn't exist yet, the code falls back to the local
// JSON file so existing deployments keep working until the table is created.

type MilestoneLog = Record<string, string[]>; // periodId → milestone keys[]

// ── Supabase-backed log helpers ───────────────────────────────────────────────

async function readLogFromSupabase(): Promise<MilestoneLog | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("payment_milestone_log")
      .select("period_id, milestone");

    if (error) {
      // Table likely doesn't exist yet — caller will fall back to file
      console.warn("[payment-reminders] Supabase milestone log unavailable:", error.message);
      return null;
    }

    const log: MilestoneLog = {};
    for (const row of data ?? []) {
      if (!log[row.period_id]) log[row.period_id] = [];
      log[row.period_id]!.push(row.milestone);
    }
    return log;
  } catch (err) {
    console.warn("[payment-reminders] Supabase milestone log read error:", err);
    return null;
  }
}

async function markSentInSupabase(periodId: string, milestones: string[]): Promise<boolean> {
  if (milestones.length === 0) return true;
  try {
    const rows = milestones.map((milestone) => ({
      period_id: periodId,
      milestone,
      fired_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("payment_milestone_log")
      .upsert(rows, { onConflict: "period_id,milestone" });

    if (error) {
      console.warn("[payment-reminders] Supabase milestone write error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[payment-reminders] Supabase milestone upsert error:", err);
    return false;
  }
}

// ── File-based fallback (used only when Supabase table isn't available yet) ───

const LOG_PATH = join(import.meta.dir, "../../../data/payment-milestone-log.json");

function readLogFromFile(): MilestoneLog {
  try {
    const text = readFileSync(LOG_PATH, "utf-8");
    return JSON.parse(text) as MilestoneLog;
  } catch {
    return {};
  }
}

function writeLogToFile(log: MilestoneLog): void {
  try {
    Bun.write(LOG_PATH, JSON.stringify(log, null, 2));
  } catch (err) {
    console.error("[payment-reminders] Failed to persist milestone log to file:", err);
  }
}

// ── Unified read/write helpers (Supabase with file fallback) ──────────────────

async function readLog(): Promise<{ log: MilestoneLog; usingSupabase: boolean }> {
  const supabaseLog = await readLogFromSupabase();
  if (supabaseLog !== null) {
    return { log: supabaseLog, usingSupabase: true };
  }
  console.warn("[payment-reminders] Falling back to file-based milestone log.");
  return { log: readLogFromFile(), usingSupabase: false };
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

    // 2. Read the milestone log ONCE upfront
    const { log, usingSupabase } = await readLog();

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

    // 6. Second pass: send notifications and collect all newly-fired milestones
    // Track new milestones per period so we can write them in one batch
    const newMilestonesByPeriod = new Map<string, string[]>();

    for (const { period, daysUntilDue, dueDate, milestonesToFire } of workList) {
      const unpaidPlayerIds = unpaidByPeriod.get(period.id) ?? [];

      for (const milestone of milestonesToFire) {
        if (unpaidPlayerIds.length > 0) {
          const { title, body } = buildReminderMessage(daysUntilDue, period.title, period.amount, dueDate);
          console.log(`[payment-reminders] Firing milestone "${milestone}" for period "${period.title}" to ${unpaidPlayerIds.length} player(s)`);
          await sendReminderToPlayers(unpaidPlayerIds, title, body, {
            type: "payment_reminder",
            periodId: period.id,
            teamId: period.team_id,
            milestone,
          });
        } else {
          // All paid — still mark as sent so we stop checking
          console.log(`[payment-reminders] Period "${period.title}" fully paid — marking "${milestone}" as sent`);
        }

        if (!newMilestonesByPeriod.has(period.id)) newMilestonesByPeriod.set(period.id, []);
        newMilestonesByPeriod.get(period.id)!.push(milestone);
      }
    }

    // 7. Persist newly-fired milestones in one pass
    if (newMilestonesByPeriod.size > 0) {
      if (usingSupabase) {
        // Batch upsert all new milestones in parallel (one upsert per period)
        await Promise.all(
          Array.from(newMilestonesByPeriod.entries()).map(([periodId, milestones]) =>
            markSentInSupabase(periodId, milestones)
          )
        );
      } else {
        // File fallback: update the in-memory log and write once
        for (const [periodId, milestones] of newMilestonesByPeriod) {
          if (!log[periodId]) log[periodId] = [];
          for (const m of milestones) {
            if (!log[periodId]!.includes(m)) log[periodId]!.push(m);
          }
        }
        writeLogToFile(log);
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
 */
paymentRemindersRouter.post("/send-manual", zValidator("json", SendManualSchema), async (c) => {
  const authErr = requireInternalSecret(c);
  if (authErr) return authErr;

  const { periodId, teamId } = c.req.valid("json");

  const { data: period, error: periodError } = await supabaseAdmin
    .from("payment_periods")
    .select("id, title, amount, due_date")
    .eq("id", periodId)
    .single();

  if (periodError || !period) {
    return c.json({ error: "Payment period not found" }, 404);
  }

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
 * Called when a payment period is created. Sends an immediate notification.
 */
paymentRemindersRouter.post("/on-create", zValidator("json", OnCreateSchema), async (c) => {
  const authErr = requireInternalSecret(c);
  if (authErr) return authErr;

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

  // Mark "created" milestone — try Supabase first, fall back to file
  const wrote = await markSentInSupabase(periodId, ["created"]);
  if (!wrote) {
    const log = readLogFromFile();
    if (!log[periodId]) log[periodId] = [];
    if (!log[periodId]!.includes("created")) {
      log[periodId]!.push("created");
      writeLogToFile(log);
    }
  }

  return c.json({ message: "Creation notifications sent", sent: playerIds.length });
});

export { paymentRemindersRouter };
