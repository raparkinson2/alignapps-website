import { Hono } from "hono";
import Stripe from "stripe";

const paymentsRouter = new Hono();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

/**
 * POST /api/payments/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for a player paying a team payment period.
 *
 * Body:
 *   amount            - Amount in cents (e.g. 5000 = $50.00)
 *   playerName        - Player's name (for metadata)
 *   teamName          - Team name (for metadata)
 *   paymentPeriodId   - The payment period ID (for metadata, used by webhook)
 *   playerId          - The player ID (for metadata, used by webhook)
 *   teamStripeAccountId (optional) - Connected Stripe account for the team
 *
 * Returns: { clientSecret, paymentIntentId }
 */
paymentsRouter.post("/create-payment-intent", async (c) => {
  try {
    const body = await c.req.json<{
      amount: number;
      playerName?: string;
      teamName?: string;
      paymentPeriodId?: string;
      playerId?: string;
      teamStripeAccountId?: string;
    }>();

    const { amount, playerName, teamName, paymentPeriodId, playerId, teamStripeAccountId } = body;

    if (!amount || amount < 50) {
      return c.json({ error: "Amount must be at least 50 cents ($0.50)" }, 400);
    }

    const stripe = getStripe();

    // Platform fee: configurable percent of the transaction
    const feePct = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "0.5") / 100;
    const applicationFeeAmount = Math.round(amount * feePct);

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        playerName: playerName ?? "",
        teamName: teamName ?? "",
        paymentPeriodId: paymentPeriodId ?? "",
        playerId: playerId ?? "",
      },
    };

    // If the team has a connected Stripe account, route the payment there
    if (teamStripeAccountId) {
      intentParams.application_fee_amount = applicationFeeAmount;
      intentParams.transfer_data = { destination: teamStripeAccountId };
      intentParams.on_behalf_of = teamStripeAccountId;
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    console.log(`[payments] Created PaymentIntent ${paymentIntent.id} for ${amount} cents`);

    return c.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error("[payments] create-payment-intent error:", error?.message ?? error);
    return c.json({ error: "PaymentIntent creation failed", details: error?.message }, 500);
  }
});

/**
 * POST /api/payments/webhook
 *
 * Stripe webhook endpoint. Receives events from Stripe and updates
 * player payment status in Supabase automatically.
 *
 * Events handled:
 *   - payment_intent.succeeded  → mark player payment as "paid"
 *   - payment_intent.payment_failed → log the failure
 */
paymentsRouter.post("/webhook", async (c) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = c.req.header("stripe-signature");
  const rawBody = await c.req.text();

  let event: Stripe.Event;

  try {
    const stripe = getStripe();

    if (webhookSecret && signature) {
      // Bun uses Web Crypto API which requires the async variant
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } else {
      // In development without a webhook secret, parse directly
      event = JSON.parse(rawBody) as Stripe.Event;
      console.warn("[payments] webhook: no secret configured, skipping signature verification");
    }
  } catch (err: any) {
    console.error("[payments] webhook signature verification failed:", err?.message);
    return c.json({ error: "Webhook signature verification failed" }, 400);
  }

  console.log(`[payments] webhook received: ${event.type}`);

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const { playerId, paymentPeriodId } = intent.metadata ?? {};
    const amountPaid = intent.amount_received; // in cents

    console.log(`[payments] payment_intent.succeeded: player=${playerId} period=${paymentPeriodId} amount=${amountPaid}`);

    if (playerId && paymentPeriodId) {
      await handlePaymentSucceeded({ playerId, paymentPeriodId, amountPaid });
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const { playerId, paymentPeriodId } = intent.metadata ?? {};
    console.warn(`[payments] payment_intent.payment_failed: player=${playerId} period=${paymentPeriodId}`);
  }

  return c.json({ received: true });
});

/**
 * Update player payment status in Supabase after a successful payment.
 */
async function handlePaymentSucceeded({
  playerId,
  paymentPeriodId,
  amountPaid,
}: {
  playerId: string;
  paymentPeriodId: string;
  amountPaid: number;
}) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("[payments] Supabase not configured, skipping payment status update");
      return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const amountInDollars = amountPaid / 100;

    // Upsert the player_payment record to mark as paid
    const { error: upsertError } = await supabase
      .from("player_payments")
      .upsert(
        {
          payment_period_id: paymentPeriodId,
          player_id: playerId,
          status: "paid",
          amount: amountInDollars,
          paid_at: new Date().toISOString(),
          notes: "Paid via Stripe",
        },
        { onConflict: "payment_period_id,player_id" }
      );

    if (upsertError) {
      console.error("[payments] Failed to update player_payments:", upsertError.message);
    } else {
      console.log(`[payments] Marked player ${playerId} as paid for period ${paymentPeriodId}`);
    }

    // Also insert a payment_entry record for the audit trail
    const { error: entryError } = await supabase.from("payment_entries").insert({
      player_payment_id: `${paymentPeriodId}_${playerId}`,
      amount: amountInDollars,
      date: new Date().toISOString().split("T")[0],
      note: "Stripe payment",
    });

    if (entryError) {
      // Non-critical — the upsert above is what matters
      console.warn("[payments] Could not insert payment_entry:", entryError.message);
    }
  } catch (err: any) {
    console.error("[payments] handlePaymentSucceeded error:", err?.message ?? err);
  }
}

/**
 * POST /api/payments/create-checkout-session
 *
 * Creates a Stripe Checkout Session for WebView-based payment flow.
 * Used when @stripe/stripe-react-native is not available (Expo Go / managed workflow).
 *
 * Body:
 *   amount            - Amount in cents
 *   playerName        - Player's name
 *   teamName          - Team name
 *   paymentPeriodTitle - Payment period title (shown on checkout)
 *   paymentPeriodId   - For webhook metadata
 *   playerId          - For webhook metadata
 *   successUrl        - Redirect URL after success (app deep link)
 *   cancelUrl         - Redirect URL on cancel (app deep link)
 *   teamStripeAccountId (optional) - Connected Stripe account
 *
 * Returns: { url } - the Stripe Checkout URL to open in WebView
 */
paymentsRouter.post("/create-checkout-session", async (c) => {
  try {
    const body = await c.req.json<{
      amount: number;
      playerName?: string;
      teamName?: string;
      paymentPeriodTitle?: string;
      paymentPeriodId?: string;
      playerId?: string;
      successUrl?: string;
      cancelUrl?: string;
      teamStripeAccountId?: string;
    }>();

    const {
      amount,
      playerName,
      teamName,
      paymentPeriodTitle,
      paymentPeriodId,
      playerId,
      successUrl = "vibecode://payment-success",
      cancelUrl = "vibecode://payment-cancel",
      teamStripeAccountId,
    } = body;

    if (!amount || amount < 50) {
      return c.json({ error: "Amount must be at least 50 cents ($0.50)" }, 400);
    }

    const stripe = getStripe();
    const feePct = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "0.5") / 100;
    const applicationFeeAmount = Math.round(amount * feePct);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: paymentPeriodTitle ?? "Team Payment",
              description: teamName ? `Payment to ${teamName}` : undefined,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        playerName: playerName ?? "",
        teamName: teamName ?? "",
        paymentPeriodId: paymentPeriodId ?? "",
        playerId: playerId ?? "",
      },
      payment_intent_data: {
        metadata: {
          playerName: playerName ?? "",
          teamName: teamName ?? "",
          paymentPeriodId: paymentPeriodId ?? "",
          playerId: playerId ?? "",
        },
        ...(teamStripeAccountId && {
          application_fee_amount: applicationFeeAmount,
          transfer_data: { destination: teamStripeAccountId },
          on_behalf_of: teamStripeAccountId,
        }),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[payments] Created Checkout Session ${session.id} for ${amount} cents`);

    return c.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error("[payments] create-checkout-session error:", error?.message ?? error);
    return c.json({ error: "Checkout session creation failed", details: error?.message }, 500);
  }
});

export { paymentsRouter };
