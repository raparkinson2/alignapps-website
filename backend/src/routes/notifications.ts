import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import apn from "@parse/node-apn";

const notificationsRouter = new Hono();

// Service-role Supabase client - bypasses RLS to read/write push tokens
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Create a new APNs provider using @parse/node-apn with proper HTTP/2 support.
 * We create a new provider per call to avoid connection state issues in hot-reload dev.
 */
function createAPNsProvider(): apn.Provider | null {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;

  if (!teamId || !keyId || !privateKey) {
    console.error("[push] APNs env vars missing: APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY");
    return null;
  }

  // Handle both literal \n from .env and real newlines
  const normalizedKey = privateKey.replace(/\\n/g, "\n");

  return new apn.Provider({
    token: {
      key: normalizedKey,
      keyId,
      teamId,
    },
    production: true, // Always use production APNs (for TestFlight + App Store)
  });
}

/**
 * Send push notifications via APNs HTTP/2 using @parse/node-apn.
 * Raw APNs device tokens are 64-char hex strings obtained via getDevicePushTokenAsync.
 */
async function sendAPNsNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number; stale: string[] }> {
  const bundleId = process.env.APNS_BUNDLE_ID || "com.vibecode.alignsports-jy5wjr";

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  // Separate Expo-format tokens from raw APNs tokens
  const expoTokens = tokens.filter(t => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
  const rawApnsTokens = tokens.filter(t => !t.startsWith("ExponentPushToken[") && !t.startsWith("ExpoPushToken["));

  // Handle Expo-format tokens via Expo's push service
  if (expoTokens.length > 0) {
    console.log(`[push] Routing ${expoTokens.length} Expo token(s) via Expo push service`);
    const expoResult = await sendViaExpoPushService(expoTokens, title, body, data);
    sent += expoResult.sent;
    failed += expoResult.failed;
    stale.push(...expoResult.stale);
  }

  // Handle raw APNs tokens via node-apn (proper HTTP/2)
  if (rawApnsTokens.length > 0) {
    const provider = createAPNsProvider();
    if (!provider) {
      console.error("[push] Cannot create APNs provider — credentials missing");
      failed += rawApnsTokens.length;
      return { sent, failed, stale };
    }

    try {
      const notification = new apn.Notification();
      notification.alert = { title, body };
      notification.sound = "default";
      notification.badge = 1;
      notification.topic = bundleId;
      notification.priority = 10;
      notification.pushType = "alert";
      if (data && Object.keys(data).length > 0) {
        notification.payload = data;
      }

      console.log(`[push] Sending APNs to ${rawApnsTokens.length} device token(s) via node-apn`);
      const result = await provider.send(notification, rawApnsTokens);

      sent += result.sent.length;
      console.log(`[push] APNs sent: ${result.sent.length}`);

      for (const failure of result.failed) {
        const tokenPrefix = failure.device?.substring(0, 16) || "unknown";
        console.error(`[push] APNs failed for ${tokenPrefix}...: ${failure.status} — ${failure.response?.reason || failure.error}`);
        if (failure.response?.reason === "BadDeviceToken" || failure.response?.reason === "Unregistered") {
          stale.push(failure.device);
        }
        failed++;
      }
    } catch (err) {
      console.error("[push] APNs provider.send error:", err);
      failed += rawApnsTokens.length;
    } finally {
      provider.shutdown();
    }
  }

  return { sent, failed, stale };
}

/**
 * Fallback: send via Expo push service (for Expo-format tokens or when APNs creds missing).
 */
async function sendViaExpoPushService(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number; stale: string[] }> {
  const validTokens = tokens.filter(t =>
    typeof t === "string" && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
  );

  if (validTokens.length === 0) {
    return { sent: 0, failed: tokens.length, stale: [] };
  }

  const messages = validTokens.map(token => ({ to: token, title, body, data, sound: "default", priority: "high" }));
  let sent = 0;
  const stale: string[] = [];

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (res.ok) {
      const responseData = await res.json() as { data: Array<{ status: string; details?: { error?: string } }> };
      responseData.data?.forEach((ticket, i) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") stale.push(validTokens[i]!);
      });
    }
  } catch (err) {
    console.error("[push] Expo push service error:", err);
  }

  return { sent, failed: validTokens.length - sent, stale };
}

/**
 * Delete stale tokens from push_tokens table.
 */
async function removeStaleTokens(staleTokens: string[]): Promise<void> {
  if (staleTokens.length === 0) return;
  const { error } = await supabaseAdmin.from("push_tokens").delete().in("token", staleTokens);
  if (error) console.error("[push] Failed to remove stale tokens:", error.message);
  else console.log(`[push] Removed ${staleTokens.length} stale token(s)`);
}

/**
 * POST /api/notifications/save-token
 * Upserts a push token. Accepts both raw APNs hex tokens and Expo-format tokens.
 */
notificationsRouter.post("/save-token", async (c) => {
  let playerId = "", pushToken = "", platform = "ios", appBuild: string | null = null;
  try {
    const req = await c.req.json();
    playerId = req.playerId || "";
    pushToken = req.pushToken || "";
    platform = req.platform || "ios";
    appBuild = req.appBuild || null;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!playerId || !pushToken) return c.json({ error: "playerId and pushToken required" }, 400);

  console.log(`[push] save-token: player=${playerId} platform=${platform} token=${pushToken.substring(0, 20)}...`);

  // First: delete any OLD tokens for this player so we don't accumulate stale entries
  // (keeps one token per player — the most recent one wins)
  const { error: deleteOldErr } = await supabaseAdmin
    .from("push_tokens")
    .delete()
    .eq("player_id", playerId)
    .neq("token", pushToken);
  if (deleteOldErr) {
    console.warn("[push] save-token: could not clear old tokens for player:", deleteOldErr.message);
  }

  const { error } = await supabaseAdmin.from("push_tokens").upsert(
    { player_id: playerId, token: pushToken, platform, app_build: appBuild, last_seen: new Date().toISOString() },
    { onConflict: "token", ignoreDuplicates: false }
  );

  if (error) {
    console.error("[push] save-token error:", error.code, error.message, "player:", playerId, "token_prefix:", pushToken.substring(0, 20));
    // Fallback: try direct update if token already exists (race condition or missing constraint)
    const { error: updateErr } = await supabaseAdmin
      .from("push_tokens")
      .update({ player_id: playerId, platform, last_seen: new Date().toISOString() })
      .eq("token", pushToken);
    if (updateErr) {
      console.error("[push] save-token fallback update error:", updateErr.message);
      // Last resort: insert ignoring conflicts
      const { error: insertErr } = await supabaseAdmin
        .from("push_tokens")
        .insert({ player_id: playerId, token: pushToken, platform, app_build: appBuild, last_seen: new Date().toISOString() });
      if (insertErr) {
        console.error("[push] save-token insert error:", insertErr.message);
        return c.json({ error: insertErr.message }, 500);
      }
    }
    console.log(`[push] save-token: fallback updated token for player ${playerId}`);
    return c.json({ success: true });
  }

  console.log(`[push] save-token: upserted token for player ${playerId}, token_prefix: ${pushToken.substring(0, 20)}`);
  return c.json({ success: true });
});

/**
 * POST /api/notifications/send-to-players
 * Looks up push tokens for given player IDs and sends via APNs directly.
 */
notificationsRouter.post("/send-to-players", async (c) => {
  let playerIds: string[] = [], title = "", body = "", data: Record<string, any> = {};

  try {
    const req = await c.req.json();
    playerIds = req.playerIds || [];
    title = req.title || "";
    body = req.body || "";
    data = req.data || {};
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!playerIds.length || !title || !body) {
    return c.json({ error: "playerIds, title, and body are required" }, 400);
  }

  console.log(`[push] send-to-players: ${playerIds.length} players, title: "${title}"`);

  // Fetch tokens from push_tokens table
  const { data: tokenRows, error: tokenError } = await supabaseAdmin
    .from("push_tokens")
    .select("player_id, token, platform")
    .in("player_id", playerIds);

  if (tokenError) console.error("[push] push_tokens fetch error:", tokenError.message);

  const foundPlayerIds = new Set((tokenRows || []).map((r: any) => r.player_id));
  const missingPlayerIds = playerIds.filter((id) => !foundPlayerIds.has(id));
  if (missingPlayerIds.length > 0) {
    console.log(`[push] send-to-players: NO TOKEN for player IDs: ${missingPlayerIds.join(', ')}`);
  }

  const allTokens: string[] = [];
  for (const row of tokenRows || []) {
    if (row.token) {
      allTokens.push(row.token);
      console.log(`[push] player ${row.player_id}: token ${row.token.substring(0, 16)}... (${row.platform})`);
    }
  }

  console.log(`[push] send-to-players: ${playerIds.length} players → ${allTokens.length} tokens`);

  if (allTokens.length === 0) {
    return c.json({ success: true, sent: 0, message: "No push tokens found for given player IDs" });
  }

  const result = await sendAPNsNotifications(allTokens, title, body, data);
  await removeStaleTokens(result.stale);

  return c.json({ success: true, sent: result.sent, failed: result.failed, total_tokens: allTokens.length });
});

/**
 * GET /api/notifications/debug-tokens?teamId=xxx
 */
notificationsRouter.get("/debug-tokens", async (c) => {
  const teamId = c.req.query("teamId");
  if (!teamId) return c.json({ error: "teamId required" }, 400);

  const { data: players, error: playersError } = await supabaseAdmin
    .from("players")
    .select("id, first_name, last_name, email")
    .eq("team_id", teamId);

  if (playersError) return c.json({ error: playersError.message }, 500);

  const playerIds = (players || []).map((p: any) => p.id);
  const { data: tokenRows } = await supabaseAdmin
    .from("push_tokens")
    .select("player_id, token, platform, last_seen")
    .in("player_id", playerIds);

  const tokensByPlayer: Record<string, Array<{ token: string; platform: string; last_seen: string }>> = {};
  for (const row of tokenRows || []) {
    if (!tokensByPlayer[row.player_id]) tokensByPlayer[row.player_id] = [];
    tokensByPlayer[row.player_id]!.push({ token: row.token, platform: row.platform, last_seen: row.last_seen });
  }

  const result = (players || []).map((p: any) => {
    const tokens = tokensByPlayer[p.id] || [];
    return {
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      email: p.email,
      token_count: tokens.length,
      has_token: tokens.length > 0,
      push_tokens: tokens,
    };
  });

  return c.json({ players: result, count: result.length, with_token: result.filter((r: any) => r.has_token).length });
});

/**
 * POST /api/notifications/test-apns
 * Sends a test notification to a specific token via node-apn (proper HTTP/2).
 * Body: { token: string, title?: string, body?: string }
 */
notificationsRouter.post("/test-apns", async (c) => {
  const req = await c.req.json() as { token?: string; title?: string; body?: string };
  const token = req.token || "";
  const title = req.title || "Test";
  const body = req.body || "APNs test from backend";

  if (!token) return c.json({ error: "token required" }, 400);

  const bundleId = process.env.APNS_BUNDLE_ID || "com.vibecode.alignsports-jy5wjr";

  const provider = createAPNsProvider();
  if (!provider) {
    return c.json({ error: "APNs credentials missing", teamId: !!process.env.APNS_TEAM_ID, keyId: !!process.env.APNS_KEY_ID, privateKey: !!process.env.APNS_PRIVATE_KEY }, 500);
  }

  try {
    const notification = new apn.Notification();
    notification.alert = { title, body };
    notification.sound = "default";
    notification.badge = 1;
    notification.topic = bundleId;
    notification.priority = 10;
    notification.pushType = "alert";

    console.log("[push] test-apns: sending via node-apn, token prefix:", token.substring(0, 16));
    const result = await provider.send(notification, [token]);

    const sent = result.sent.length;
    const failed = result.failed.map(f => ({
      device: f.device?.substring(0, 16),
      status: f.status,
      reason: f.response?.reason || f.error?.toString(),
    }));

    console.log(`[push] test-apns: sent=${sent}, failed=${result.failed.length}`);
    return c.json({ sent, failed, bundleId, tokenPrefix: token.substring(0, 16) });
  } catch (err: any) {
    console.error("[push] test-apns: error:", err);
    return c.json({ error: err?.message || String(err) }, 500);
  } finally {
    provider.shutdown();
  }
});

/**
 * POST /api/notifications/registration-diagnostic
 * Called by the app on every push registration attempt (success or failure).
 * Stores the result so we can debug TestFlight issues without Xcode.
 */
notificationsRouter.post("/registration-diagnostic", async (c) => {
  let body: any = {};
  try { body = await c.req.json(); } catch { /* ignore */ }

  const entry = {
    player_id: body.playerId || "unknown",
    platform: body.platform || "unknown",
    os_version: body.osVersion || "unknown",
    app_version: body.appVersion || "unknown",
    permission_status: body.permissionStatus || "unknown",
    token_obtained: body.tokenObtained ?? false,
    token_prefix: body.tokenPrefix || null,
    error_message: body.errorMessage || null,
    backend_url_seen: body.backendUrlSeen || null,
    timestamp: new Date().toISOString(),
  };

  console.log("[push-diag]", JSON.stringify(entry));

  // Also persist to Supabase so you can query it later
  await supabaseAdmin.from("push_diagnostics").insert(entry).then(({ error }) => {
    if (error) console.warn("[push-diag] Could not save to push_diagnostics table:", error.message, "(table may not exist yet — log above is sufficient)");
  });

  return c.json({ received: true });
});

/**
 * GET /api/notifications/registration-diagnostics
 * Returns recent diagnostic entries so you can see what happened on tester devices.
 */
notificationsRouter.get("/registration-diagnostics", async (c) => {
  const { data, error } = await supabaseAdmin
    .from("push_diagnostics")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error) {
    return c.json({ error: error.message, note: "Run the push_diagnostics SQL to create the table" }, 500);
  }
  return c.json({ diagnostics: data, count: data?.length ?? 0 });
});

export { notificationsRouter };
