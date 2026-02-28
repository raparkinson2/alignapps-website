import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

const notificationsRouter = new Hono();

// Service-role Supabase client - bypasses RLS to read/write push tokens
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Send push notifications directly via APNs HTTP/2 API using a .p8 auth key.
 * Raw APNs device tokens are 64-char hex strings obtained via getDevicePushTokenAsync.
 */
async function sendAPNsNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number; stale: string[] }> {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY; // PEM string, newlines as \n
  const bundleId = process.env.APNS_BUNDLE_ID || "com.vibecode.alignsports-jy5wjr";

  if (!teamId || !keyId || !privateKey) {
    console.error("[push] APNs env vars missing: APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY");
    // Fallback to Expo push service for any Expo-format tokens
    return sendViaExpoPushService(tokens, title, body, data);
  }

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  // Generate JWT for APNs
  let jwtToken: string;
  try {
    jwtToken = await generateAPNsJWT(teamId, keyId, privateKey);
  } catch (err) {
    console.error("[push] Failed to generate APNs JWT:", err);
    return sendViaExpoPushService(tokens, title, body, data);
  }

  const apnsUrl = "https://api.push.apple.com";

  for (const token of tokens) {
    // Skip Expo-format tokens — they go through Expo's service
    if (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) {
      console.log(`[push] Expo token found, routing via Expo: ${token.substring(0, 30)}`);
      const result = await sendViaExpoPushService([token], title, body, data);
      sent += result.sent;
      failed += result.failed;
      stale.push(...result.stale);
      continue;
    }

    try {
      const payload = JSON.stringify({
        aps: {
          alert: { title, body },
          sound: "default",
          badge: 1,
          "content-available": 1,
        },
        ...data,
      });

      const res = await fetch(`${apnsUrl}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwtToken}`,
          "apns-topic": bundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: payload,
      });

      if (res.status === 200) {
        console.log(`[push] APNs ok for token ${token.substring(0, 16)}...`);
        sent++;
      } else {
        const errBody = await res.json().catch(() => ({})) as { reason?: string };
        console.error(`[push] APNs error ${res.status} for token ${token.substring(0, 16)}...: ${errBody.reason}`);
        if (errBody.reason === "BadDeviceToken" || errBody.reason === "Unregistered") {
          stale.push(token);
        }
        failed++;
      }
    } catch (err) {
      console.error(`[push] APNs request failed for token ${token.substring(0, 16)}...:`, err);
      failed++;
    }
  }

  return { sent, failed, stale };
}

/**
 * Generate a short-lived APNs JWT using the .p8 private key.
 */
async function generateAPNsJWT(teamId: string, keyId: string, privateKeyPem: string): Promise<string> {
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Parse the PEM key — handle both real newlines and literal \n from .env files
  const pemBody = privateKeyPem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/-----BEGIN EC PRIVATE KEY-----/, "")
    .replace(/-----END EC PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(signingInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${signingInput}.${encodedSignature}`;
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

  const { error } = await supabaseAdmin.from("push_tokens").upsert(
    { player_id: playerId, token: pushToken, platform, app_build: appBuild, last_seen: new Date().toISOString() },
    { onConflict: "token" }
  );

  if (error) {
    console.error("[push] save-token error:", error.message);
    return c.json({ error: error.message }, 500);
  }

  console.log(`[push] save-token: upserted token for player ${playerId}`);
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
 * Tests APNs JWT generation and sends a real notification to a specific token.
 * Body: { token: string, title?: string, body?: string }
 */
notificationsRouter.post("/test-apns", async (c) => {
  const req = await c.req.json() as { token?: string; title?: string; body?: string };
  const token = req.token || "";
  const title = req.title || "Test";
  const body = req.body || "APNs test from backend";

  if (!token) return c.json({ error: "token required" }, 400);

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY;
  const bundleId = process.env.APNS_BUNDLE_ID || "com.vibecode.alignsports-jy5wjr";

  if (!teamId || !keyId || !privateKey) {
    return c.json({ error: "APNs env vars missing", teamId: !!teamId, keyId: !!keyId, privateKey: !!privateKey }, 500);
  }

  let jwtToken: string;
  try {
    jwtToken = await generateAPNsJWT(teamId, keyId, privateKey);
    console.log("[push] test-apns: JWT generated ok, length:", jwtToken.length);
  } catch (err: any) {
    console.error("[push] test-apns: JWT generation failed:", err);
    return c.json({ error: "JWT generation failed", detail: err?.message || String(err) }, 500);
  }

  const apnsUrl = "https://api.push.apple.com";
  const payload = JSON.stringify({
    aps: { alert: { title, body }, sound: "default", badge: 1 },
  });

  try {
    const res = await fetch(`${apnsUrl}/3/device/${token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwtToken}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: payload,
    });

    const statusCode = res.status;
    let apnsId = res.headers.get("apns-id");
    let responseBody: any = {};
    try { responseBody = await res.json(); } catch { /* empty response on success */ }

    console.log(`[push] test-apns: APNs responded ${statusCode}`, responseBody);
    return c.json({ statusCode, apnsId, response: responseBody, bundleId, tokenPrefix: token.substring(0, 16) });
  } catch (err: any) {
    console.error("[push] test-apns: fetch failed:", err);
    return c.json({ error: "fetch to APNs failed", detail: err?.message || String(err) }, 500);
  }
});

export { notificationsRouter };
