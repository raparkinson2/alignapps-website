import { Hono } from "hono";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const connectRouter = new Hono();

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

/**
 * GET /api/payments/connect/onboard?teamId=xxx&adminId=xxx
 *
 * Generates a Stripe Connect OAuth URL for the team admin to onboard.
 * The admin is redirected to Stripe, completes onboarding, then Stripe
 * redirects back to /connect/callback with a code.
 */
connectRouter.get("/onboard", async (c) => {
  try {
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      return c.json({ error: "Stripe Connect not configured" }, 500);
    }

    const teamId = c.req.query("teamId");
    const adminId = c.req.query("adminId");

    if (!teamId || !adminId) {
      return c.json({ error: "teamId and adminId are required" }, 400);
    }

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";
    const redirectUri = `${backendUrl}/api/payments/connect/callback`;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "read_write",
      redirect_uri: redirectUri,
      // Pass teamId and adminId through state so we have them on callback
      state: JSON.stringify({ teamId, adminId }),
      "stripe_user[business_type]": "individual",
    });

    const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

    console.log(`[connect] Generated onboard URL for team ${teamId}`);
    return c.json({ url });
  } catch (err: any) {
    console.error("[connect] onboard error:", err?.message);
    return c.json({ error: "Failed to generate onboarding URL" }, 500);
  }
});

/**
 * GET /api/payments/connect/callback?code=xxx&state=xxx
 *
 * Stripe redirects here after the admin completes OAuth onboarding.
 * We exchange the code for the connected account ID and save it to the team.
 * Then redirect the user back into the app via deep link.
 */
connectRouter.get("/callback", async (c) => {
  const code = c.req.query("code");
  const stateRaw = c.req.query("state");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  // Handle user cancellation
  if (error) {
    console.warn(`[connect] OAuth error: ${error} - ${errorDescription}`);
    return c.redirect("alignsports://stripe-connect-cancel");
  }

  if (!code || !stateRaw) {
    return c.html("<p>Missing code or state. Please try again from the app.</p>", 400);
  }

  let teamId: string;
  let adminId: string;

  try {
    const state = JSON.parse(stateRaw) as { teamId: string; adminId: string };
    teamId = state.teamId;
    adminId = state.adminId;
  } catch {
    return c.html("<p>Invalid state parameter.</p>", 400);
  }

  try {
    const stripe = getStripe();

    // Exchange the authorization code for an access token + account ID
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const stripeAccountId = response.stripe_user_id;
    if (!stripeAccountId) {
      throw new Error("No stripe_user_id in OAuth response");
    }

    console.log(`[connect] Connected account ${stripeAccountId} for team ${teamId}`);

    // Save the connected account ID to the teams table in Supabase
    const supabase = getSupabase();
    const { error: dbError } = await supabase
      .from("teams")
      .update({
        stripe_account_id: stripeAccountId,
        stripe_onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teamId);

    if (dbError) {
      console.error("[connect] Failed to save stripe account to team:", dbError.message);
      // Still redirect to success — the account is connected even if DB write failed
    }

    // Redirect back into the app with a deep link
    return c.redirect(`alignsports://stripe-connect-success?teamId=${teamId}&accountId=${stripeAccountId}`);
  } catch (err: any) {
    console.error("[connect] callback error:", err?.message);
    return c.html(
      `<p>Stripe connection failed: ${err?.message ?? "Unknown error"}. Please return to the app and try again.</p>`,
      500
    );
  }
});

/**
 * POST /api/payments/connect/disconnect
 *
 * Removes the Stripe Connect account from a team.
 * Body: { teamId }
 */
connectRouter.post("/disconnect", async (c) => {
  try {
    const { teamId } = await c.req.json<{ teamId: string }>();
    if (!teamId) return c.json({ error: "teamId required" }, 400);

    const supabase = getSupabase();
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
