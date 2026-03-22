import { Hono } from "hono";

const authRouter = new Hono();

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

async function getAllAuthUsers(supabaseUrl: string, serviceKey: string): Promise<{ id: string; email: string }[]> {
  const all: { id: string; email: string }[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=${perPage}&page=${page}`, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    });
    if (!res.ok) break;
    const data = await res.json() as { users?: any[] };
    const users = (data.users || []).filter((u: any) => u.email).map((u: any) => ({ id: u.id, email: u.email as string }));
    all.push(...users);
    if (users.length < perPage) break; // last page
    page++;
  }
  return all;
}

/**
 * POST /api/auth/delete-account
 * "Delete Account" — removes the player from Supabase players table
 * and deletes their auth account. Uses playerId + email from the request.
 */
authRouter.post("/delete-account", async (c) => {
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: "Supabase admin not configured" }, 503);
  }

  let playerId: string | undefined;
  let email: string | undefined;
  try {
    const body = await c.req.json();
    playerId = body.playerId;
    email = body.email;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!playerId && !email) {
    return c.json({ error: "playerId or email is required" }, 400);
  }

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
authRouter.post("/erase-team-data", async (c) => {
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: "Supabase admin not configured" }, 503);
  }

  let teamId: string | undefined;
  try {
    const body = await c.req.json();
    teamId = body.teamId;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!teamId) {
    return c.json({ error: "teamId is required" }, 400);
  }

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
        fetch(`${supabaseUrl}/rest/v1/${table}?team_id=eq.${encodeURIComponent(teamId!)}`, {
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
authRouter.post("/delete-team", async (c) => {
  const { url: supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!supabaseUrl || !serviceKey) {
    return c.json({ error: "Supabase admin not configured" }, 503);
  }

  let teamId: string | undefined;
  try {
    const body = await c.req.json();
    teamId = body.teamId;
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  if (!teamId) {
    return c.json({ error: "teamId is required" }, 400);
  }

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
        `${supabaseUrl}/rest/v1/players?email=in.(${encodeURIComponent(emailList)})&team_id=neq.${encodeURIComponent(teamId!)}&select=email`,
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

    // 3. Delete auth accounts for exclusive players
    if (emailsExclusiveToThisTeam.length > 0) {
      const allAuthUsers = await getAllAuthUsers(supabaseUrl, serviceKey);
      const emailsLower = new Set(emailsExclusiveToThisTeam);
      const toDelete = allAuthUsers.filter((u) => emailsLower.has(u.email.toLowerCase()));
      await Promise.all(toDelete.map((u) => deleteAuthUserById(supabaseUrl, serviceKey, u.id)));
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
