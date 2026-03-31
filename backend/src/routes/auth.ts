import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createHash } from "crypto";

const authRouter = new Hono();

const VerifyPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const DeleteAccountSchema = z.object({
  playerId: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
}).refine((d) => d.playerId || d.email, {
  message: "playerId or email is required",
});

const EraseTeamDataSchema = z.object({
  teamId: z.string().min(1, "teamId is required"),
});

const DeleteTeamSchema = z.object({
  teamId: z.string().min(1, "teamId is required"),
});

/**
 * POST /api/auth/verify-password
 * Verifies a player's password using the service role key (bypasses RLS).
 * Returns player+team rows if the password matches.
 */
authRouter.post("/verify-password", zValidator("json", VerifyPasswordSchema), async (c) => {
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: "Supabase admin not configured" }, 503);
  }

  const { email: rawEmail, password } = c.req.valid("json");
  const email = rawEmail.toLowerCase().trim();

  // Compute the SHA-256 hash the same way the mobile app does
  const SHARED_SALT = process.env.AUTH_SHARED_SALT ?? "align_sports_shared_salt_v1";
  const passwordHash = createHash("sha256")
    .update(`${SHARED_SALT}:${password}`)
    .digest("hex");

  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  // Fetch all player rows for this email (service role bypasses RLS)
  const playersRes = await fetch(
    `${supabaseUrl}/rest/v1/players?email=eq.${encodeURIComponent(email)}&select=id,team_id,email,password`,
    { headers }
  );

  if (!playersRes.ok) {
    return c.json({ error: "Failed to query players" }, 500);
  }

  const players: { id: string; team_id: string; email: string; password: string | null }[] =
    await playersRes.json() as any[];

  if (!players || players.length === 0) {
    return c.json({ error: "No account found" }, 404);
  }

  // Find any player row with a matching password
  const matchedPlayer = players.find(
    (p) => p.password && p.password === passwordHash
  );

  if (!matchedPlayer) {
    return c.json({ error: "Incorrect password" }, 401);
  }

  // Return all team IDs for this email so the app can load all teams
  return c.json({
    success: true,
    players: players.map((p) => ({ id: p.id, team_id: p.team_id })),
  });
});

function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function deleteAuthUserById(supabaseUrl: string, serviceKey: string, userId: string): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  return res.ok;
}

async function getAuthUserByEmail(supabaseUrl: string, serviceKey: string, email: string): Promise<{ id: string; email: string } | null> {
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as { users?: any[] };
  const user = (data.users || []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  return user ? { id: user.id, email: user.email } : null;
}


/**
 * POST /api/auth/delete-account
 * "Delete Account" — removes the player from Supabase players table
 * and deletes their auth account. Uses playerId + email from the request.
 */
authRouter.post("/delete-account", zValidator("json", DeleteAccountSchema), async (c) => {
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: "Supabase admin not configured" }, 503);
  }

  const { playerId, email } = c.req.valid("json");

  try {
    // 1. Delete player row from Supabase (this handles all other teams too via the players table)
    if (playerId) {
      await fetch(`${supabaseUrl}/rest/v1/players?id=eq.${encodeURIComponent(playerId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
      });
      console.log(`delete-account: deleted player row ${playerId}`);
    }

    // 2. Delete auth user by email
    if (email) {
      const authUser = await getAuthUserByEmail(supabaseUrl, serviceKey, email);
      if (authUser) {
        await deleteAuthUserById(supabaseUrl, serviceKey, authUser.id);
        console.log(`delete-account: deleted auth user ${authUser.id} (${email})`);
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("delete-account: unexpected error:", err);
    return c.json({ error: "Unexpected error" }, 500);
  }
});

/**
 * POST /api/auth/erase-team-data
 * "Erase All Data" — deletes all team content (games, events, chat, photos,
 * payments, polls, links, notifications) but leaves the team row and players intact.
 * All data is fetched from Supabase server-side — no client data trusted.
 */
authRouter.post("/erase-team-data", zValidator("json", EraseTeamDataSchema), async (c) => {
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: "Supabase admin not configured" }, 503);
  }

  const { teamId } = c.req.valid("json");

  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  const tables = [
    "games",
    "events",
    "chat_messages",
    "photos",
    "payment_periods",
    "polls",
    "team_links",
    "notifications",
  ];

  try {
    await Promise.all(
      tables.map((table) =>
        fetch(`${supabaseUrl}/rest/v1/${table}?team_id=eq.${encodeURIComponent(teamId)}`, {
          method: "DELETE",
          headers,
        })
      )
    );
    console.log(`erase-team-data: wiped all content for team ${teamId}`);
    return c.json({ success: true });
  } catch (err) {
    console.error("erase-team-data: unexpected error:", err);
    return c.json({ error: "Unexpected error" }, 500);
  }
});

/**
 * POST /api/auth/delete-team
 * "Delete Team" — nuclear option.
 * 1. Fetches all players on the team from Supabase.
 * 2. Finds players NOT on any other team (server-side check).
 * 3. Deletes their auth accounts.
 * 4. Deletes the team row (CASCADE removes all content).
 */
authRouter.post("/delete-team", zValidator("json", DeleteTeamSchema), async (c) => {
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: "Supabase admin not configured" }, 503);
  }

  const { teamId } = c.req.valid("json");

  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  try {
    // 1. Fetch all players on this team
    const playersRes = await fetch(
      `${supabaseUrl}/rest/v1/players?team_id=eq.${encodeURIComponent(teamId)}&select=id,email`,
      { headers }
    );
    const teamPlayers: { id: string; email: string | null }[] = playersRes.ok
      ? (await playersRes.json() as { id: string; email: string | null }[])
      : [];

    const teamEmails = teamPlayers
      .map((p) => p.email?.toLowerCase())
      .filter((e): e is string => !!e);

    // 2. Batch-check: fetch all players with those emails who are on a DIFFERENT team.
    //    Any email NOT in that result set belongs exclusively to this team.
    const emailsExclusiveToThisTeam: string[] = [];
    if (teamEmails.length > 0) {
      const emailList = teamEmails.map((e) => `"${e}"`).join(",");
      const res = await fetch(
        `${supabaseUrl}/rest/v1/players?email=in.(${encodeURIComponent(emailList)})&team_id=neq.${encodeURIComponent(teamId)}&select=email`,
        { headers }
      );
      const onOtherTeams: { email: string }[] = res.ok ? (await res.json() as { email: string }[]) : [];
      const onOtherTeamsSet = new Set(onOtherTeams.map((p) => p.email?.toLowerCase()).filter(Boolean));
      for (const email of teamEmails) {
        if (!onOtherTeamsSet.has(email)) {
          emailsExclusiveToThisTeam.push(email);
        }
      }
    }

    // 3. Delete auth accounts for exclusive players.
    if (emailsExclusiveToThisTeam.length > 0) {
      const authUsers = await Promise.all(
        emailsExclusiveToThisTeam.map((email) => getAuthUserByEmail(supabaseUrl!, serviceKey!, email))
      );
      const toDelete = authUsers.filter((u): u is { id: string; email: string } => u !== null);
      await Promise.all(toDelete.map((u) => deleteAuthUserById(supabaseUrl!, serviceKey!, u.id)));
      console.log(`delete-team: deleted ${toDelete.length} auth accounts for team ${teamId}`);
    }

    // 4. Delete the team row — CASCADE wipes all related rows
    await fetch(
      `${supabaseUrl}/rest/v1/teams?id=eq.${encodeURIComponent(teamId)}`,
      { method: "DELETE", headers }
    );
    console.log(`delete-team: deleted team ${teamId}`);

    return c.json({ success: true });
  } catch (err) {
    console.error("delete-team: unexpected error:", err);
    return c.json({ error: "Unexpected error" }, 500);
  }
});

export { authRouter };
