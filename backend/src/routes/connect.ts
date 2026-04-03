import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const connectRouter = new Hono();

const DisconnectSchema = z.object({
  teamId: z.string().min(1, "teamId is required"),
  adminId: z.string().min(1, "adminId is required"),
});

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(supabase: any, adminId: string, teamId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("players")
    .select("roles")
    .eq("id", adminId)
    .eq("team_id", teamId)
    .maybeSingle() as { data: { roles: unknown } | null; error: unknown };
  if (error || !data) return false;
  const roles: string[] = Array.isArray(data.roles) ? (data.roles as string[]) : [];
  return roles.includes("admin") || roles.includes("coach");
}

/**
 * GET /api/payments/connect/onboard?teamId=xxx&adminId=xxx
 *
 * Creates a Stripe Express account for the team (if one doesn't exist yet)
 * and returns an Account Link URL for the admin to complete onboarding.
 * No OAuth client ID required — Stripe handles account creation.
 */
connectRouter.get("/onboard", async (c) => {
  try {
    const teamId = c.req.query("teamId");
    const adminId = c.req.query("adminId");

    if (!teamId || !adminId) {
      return c.json({ error: "teamId and adminId are required" }, 400);
    }

    const supabase = getSupabase();
    const isAdmin = await verifyAdmin(supabase, adminId, teamId);
    if (!isAdmin) {
      console.warn(`[connect] Unauthorized onboard attempt: player ${adminId} is not admin of team ${teamId}`);
      return c.json({ error: "Unauthorized" }, 403);
    }

    const stripe = getStripe();

    // Check if this team already has a Stripe Express account
    const { data: team } = await supabase
      .from("teams")
      .select("stripe_account_id")
      .eq("id", teamId)
      .maybeSingle();

    let stripeAccountId: string = team?.stripe_account_id;

    if (!stripeAccountId) {
      // Create a new Express account for this team
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      stripeAccountId = account.id;

      // Persist the account ID immediately so we can reuse it if onboarding is interrupted
      await supabase
        .from("teams")
        .update({ stripe_account_id: stripeAccountId, updated_at: new Date().toISOString() })
        .eq("id", teamId);

      console.log(`[connect] Created Express account ${stripeAccountId} for team ${teamId}`);
    }

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

    // Generate an Account Link — this is the URL the admin visits to complete onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      // If the link expires, redirect back here to generate a fresh one
      refresh_url: `${backendUrl}/api/payments/connect/onboard?teamId=${teamId}&adminId=${adminId}`,
      // After successful onboarding, send the admin back to the app
      return_url: `https://alignapps.com/stripe-connect-success?teamId=${teamId}&accountId=${stripeAccountId}`,
      type: "account_onboarding",
    });

    console.log(`[connect] Generated Account Link for team ${teamId}`);
    return c.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("[connect] onboard error:", err?.message);
    return c.json({ error: "Failed to generate onboarding URL" }, 500);
  }
});

/**
 * POST /api/payments/connect/disconnect
 *
 * Removes the Stripe Connect account from a team.
 */
connectRouter.post("/disconnect", zValidator("json", DisconnectSchema), async (c) => {
  try {
    const { teamId, adminId } = c.req.valid("json");

    const supabase = getSupabase();
    const isAdmin = await verifyAdmin(supabase, adminId, teamId);
    if (!isAdmin) {
      console.warn(`[connect] Unauthorized disconnect attempt: player ${adminId} is not admin of team ${teamId}`);
      return c.json({ error: "Unauthorized" }, 403);
    }

    const { error } = await supabase
      .from("teams")
      .update({
        stripe_account_id: null,
        stripe_onboarding_complete: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teamId);

    if (error) throw new Error(error.message);

    console.log(`[connect] Disconnected Stripe for team ${teamId}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.error("[connect] disconnect error:", err?.message);
    return c.json({ error: "Failed to disconnect" }, 500);
  }
});

/**
 * GET /api/payments/connect/status?teamId=xxx
 *
 * Returns the current Stripe Connect status for a team.
 */
connectRouter.get("/status", async (c) => {
  try {
    const teamId = c.req.query("teamId");
    if (!teamId) return c.json({ error: "teamId required" }, 400);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("teams")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", teamId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return c.json({
      connected: !!data?.stripe_account_id,
      onboardingComplete: data?.stripe_onboarding_complete ?? false,
      accountId: data?.stripe_account_id ?? null,
    });
  } catch (err: any) {
    console.error("[connect] status error:", err?.message);
    return c.json({ error: "Failed to get status" }, 500);
  }
});

export { connectRouter };
