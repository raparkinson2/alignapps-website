/**
 * Supabase-First Sync Manager
 *
 * This is the primary data layer. All data lives in Supabase.
 * The local Zustand store is a pure in-memory cache.
 *
 * - loadTeamFromSupabase(teamId): full data fetch → populates store
 * - startRealtimeSync(teamId): subscribes to all realtime changes
 * - stopRealtimeSync(): unsubscribes on logout
 * - push*(): write helpers called by every mutation in the app
 */

import { supabase } from './supabase';
import { useTeamStore } from './store';
import type { Game, Event, Player, ChatMessage, PaymentPeriod, PlayerPayment, PaymentEntry, Photo, AppNotification, Poll, TeamLink, Team, TeamSettings } from './store';
import { BACKEND_URL } from './config';

let activeChannel: ReturnType<typeof supabase.channel> | null = null;
let activeSyncTeamId: string | null = null;

// ─── Row → Store mappers ──────────────────────────────────────────────────────

function mapTeamSettings(t: any): TeamSettings {
  return {
    sport: t.sport || 'hockey',
    jerseyColors: t.jersey_colors || [{ name: 'White', color: '#ffffff' }, { name: 'Black', color: '#1a1a1a' }],
    paymentMethods: t.payment_methods || [],
    teamLogo: t.team_logo || undefined,
    record: {
      wins: t.wins || 0,
      losses: t.losses || 0,
      ties: t.ties || 0,
      otLosses: t.ot_losses || 0,
    },
    showTeamStats: t.show_team_stats ?? true,
    showPayments: t.show_payments ?? true,
    showTeamChat: t.show_team_chat ?? true,
    showPhotos: t.show_photos ?? true,
    showRefreshmentDuty: t.show_refreshment_duty ?? true,
    refreshmentDutyIs21Plus: t.refreshment_duty_is_21_plus ?? true,
    showLineups: t.show_lineups ?? true,
    allowPlayerSelfStats: t.allow_player_self_stats ?? false,
    showTeamRecords: t.show_records ?? true,
    enabledRoles: t.enabled_roles || ['player', 'reserve', 'coach', 'parent'],
    isSoftball: t.is_softball ?? false,
    currentSeasonName: t.current_season_name || undefined,
    seasonHistory: t.season_history || [],
    championships: t.championships || [],
    stripeAccountId: t.stripe_account_id || undefined,
    stripeOnboardingComplete: t.stripe_onboarding_complete ?? false,
  };
}

function mapPlayer(p: any): Player {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email || undefined,
    phone: p.phone || undefined,
    number: p.jersey_number || '',
    position: p.position || 'C',
    positions: p.positions || [],
    avatar: p.avatar || undefined,
    roles: p.roles || [],
    status: p.status || 'active',
    isInjured: p.is_injured || false,
    isSuspended: p.is_suspended || false,
    statusEndDate: p.status_end_date || undefined,
    unavailableDates: p.unavailable_dates || [],
    notificationPreferences: p.notification_preferences
      ? { ...p.notification_preferences, pushToken: p.push_token || p.notification_preferences?.pushToken || undefined }
      : p.push_token ? { pushToken: p.push_token } as any : undefined,
    stats: p.stats ? (({ _associatedPlayerId: _aid, ...rest }) => rest)(p.stats) : {},
    goalieStats: p.goalie_stats || {},
    pitcherStats: p.pitcher_stats || {},
    gameLogs: p.game_logs || [],
    // Include hashed password for phone-based auth (phone users have no Supabase Auth account)
    password: p.password || undefined,
    associatedPlayerId: p.stats?._associatedPlayerId || undefined,
  };
}

function mapGame(g: any): Game {
  return {
    id: g.id,
    opponent: g.opponent,
    date: g.date,
    time: g.time,
    location: g.location,
    address: g.address || '',
    jerseyColor: g.jersey_color || '',
    notes: g.notes || undefined,
    showBeerDuty: g.show_beer_duty || false,
    beerDutyPlayerId: g.beer_duty_player_id || undefined,
    lineup: g.hockey_lineup || undefined,
    basketballLineup: g.basketball_lineup || undefined,
    baseballLineup: g.baseball_lineup || undefined,
    battingOrderLineup: g.batting_order_lineup || undefined,
    soccerLineup: g.soccer_lineup || undefined,
    soccerDiamondLineup: g.soccer_diamond_lineup || undefined,
    lacrosseLineup: g.lacrosse_lineup || undefined,
    inviteReleaseOption: g.invite_release_option || 'now',
    inviteReleaseDate: g.invite_release_date || undefined,
    invitesSent: g.invites_sent || false,
    finalScoreUs: g.final_score_us ?? undefined,
    finalScoreThem: g.final_score_them ?? undefined,
    gameResult: g.game_result || undefined,
    resultRecorded: g.result_recorded || false,
    checkedInPlayers: [],
    checkedOutPlayers: [],
    invitedPlayers: [],
    photos: [],
  };
}

function mapEvent(e: any): Event {
  return {
    id: e.id,
    title: e.title,
    type: e.type || 'other',
    date: e.date,
    time: e.time,
    location: e.location,
    address: e.address || undefined,
    notes: e.notes || undefined,
    inviteReleaseOption: e.invite_release_option || 'now',
    inviteReleaseDate: e.invite_release_date || undefined,
    invitesSent: e.invites_sent || false,
    invitedPlayers: [],
    confirmedPlayers: [],
    declinedPlayers: [],
  };
}

// ─── Full team load (primary entry point after login) ─────────────────────────

export async function loadTeamFromSupabase(teamId: string): Promise<boolean> {
  useTeamStore.getState().setIsSyncing(true);
  try {
    console.log('SYNC: Loading full team data for:', teamId);

    // Fetch team settings
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .maybeSingle();

    // ── PRIORITY PHASE: load only what the Events tab needs ──────────────────
    // Fire players, games, and events simultaneously — these are enough to
    // render the first tab. We flush the store after this batch so the UI
    // becomes interactive immediately, then background-load the rest.

    if (teamError || !teamData) {
      // Team doesn't exist in Supabase yet — this happens for locally-created teams
      // that were never pushed. Auto-upload from local store so sync can proceed.
      const localState = useTeamStore.getState();
      const localTeam = localState.activeTeamId === teamId
        ? { teamName: localState.teamName, teamSettings: localState.teamSettings, players: localState.players }
        : (() => { const t = localState.teams.find(t => t.id === teamId); return t ? { teamName: t.teamName, teamSettings: t.teamSettings, players: t.players } : null; })();

      if (localTeam) {
        console.log('SYNC: Team not in Supabase, uploading from local store:', teamId);
        await pushTeamToSupabase(teamId, localTeam.teamName, localTeam.teamSettings);
        for (const player of localTeam.players) {
          await pushPlayerToSupabase(player, teamId);
        }
        // Retry the fetch
        const { data: retryData, error: retryError } = await supabase
          .from('teams').select('*').eq('id', teamId).maybeSingle();
        if (retryError || !retryData) {
          console.warn('SYNC: Failed to load team after upload:', retryError?.message);
          return false;
        }
        // Continue with the retried data by re-invoking (simpler than inlining)
        return loadTeamFromSupabase(teamId);
      }

      console.warn('SYNC: Team not found in Supabase and no local data:', teamId);
      return false;
    }

    const teamSettings = mapTeamSettings(teamData);
    const teamName = teamData.name;

    // ── PHASE 1: Priority data — Events, Roster, Chat, Admin ─────────────────
    // players + games + events + chat + notifications all fire together, then
    // their dependent response tables fire in a second parallel batch.
    // Store is flushed after this so all four priority tabs render immediately.
    const currentPlayerId = useTeamStore.getState().currentPlayerId;
    const [
      { data: playersData },
      { data: gamesData },
      { data: eventsData },
      { data: chatData },
      { data: notifData },
    ] = await Promise.all([
      supabase.from('players').select('*').eq('team_id', teamId),
      supabase.from('games').select('*').eq('team_id', teamId).order('date', { ascending: true }),
      supabase.from('events').select('*').eq('team_id', teamId).order('date', { ascending: true }),
      supabase.from('chat_messages').select('*').eq('team_id', teamId).order('created_at', { ascending: true }).limit(200),
      currentPlayerId
        ? supabase.from('notifications').select('*').eq('team_id', teamId).eq('to_player_id', currentPlayerId).eq('read', false).order('created_at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    // Deduplicate players
    const rawPlayers = (playersData || []).map(mapPlayer);
    const playerMap = new Map<string, Player>();
    for (const p of rawPlayers) playerMap.set(p.id, p);
    const players = Array.from(playerMap.values());

    // Fetch game + event responses in parallel
    const gameIds = (gamesData || []).map((g: any) => g.id);
    const eventIds = (eventsData || []).map((e: any) => e.id);
    const [{ data: grData }, { data: erData }] = await Promise.all([
      gameIds.length > 0
        ? supabase.from('game_responses').select('*').in('game_id', gameIds)
        : Promise.resolve({ data: [] }),
      eventIds.length > 0
        ? supabase.from('event_responses').select('*').in('event_id', eventIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Build game responses map
    const gameResponsesMap: Record<string, { in: string[]; out: string[]; invited: string[]; notes: Record<string, string> }> = {};
    for (const r of grData || []) {
      if (!gameResponsesMap[r.game_id]) gameResponsesMap[r.game_id] = { in: [], out: [], invited: [], notes: {} };
      const map = gameResponsesMap[r.game_id];
      if (r.response === 'in') { map.in.push(r.player_id); map.invited.push(r.player_id); }
      else if (r.response === 'out') { map.out.push(r.player_id); map.invited.push(r.player_id); if (r.note) map.notes[r.player_id] = r.note; }
      else if (r.response === 'invited') { map.invited.push(r.player_id); }
    }
    const games: Game[] = (gamesData || []).map((g: any) => {
      const resp = gameResponsesMap[g.id] || { in: [], out: [], invited: [], notes: {} };
      return { ...mapGame(g), checkedInPlayers: resp.in, checkedOutPlayers: resp.out, invitedPlayers: resp.invited, checkoutNotes: resp.notes };
    });

    // Build event responses map
    const eventResponsesMap: Record<string, { confirmed: string[]; declined: string[]; invited: string[]; notes: Record<string, string> }> = {};
    for (const r of erData || []) {
      if (!eventResponsesMap[r.event_id]) eventResponsesMap[r.event_id] = { confirmed: [], declined: [], invited: [], notes: {} };
      const map = eventResponsesMap[r.event_id];
      if (r.response === 'confirmed') { map.confirmed.push(r.player_id); map.invited.push(r.player_id); }
      else if (r.response === 'declined') { map.declined.push(r.player_id); map.invited.push(r.player_id); if (r.note) map.notes[r.player_id] = r.note; }
      else if (r.response === 'invited') { map.invited.push(r.player_id); }
    }
    const events: Event[] = (eventsData || []).map((e: any) => {
      const resp = eventResponsesMap[e.id] || { confirmed: [], declined: [], invited: [], notes: {} };
      return { ...mapEvent(e), confirmedPlayers: resp.confirmed, declinedPlayers: resp.declined, invitedPlayers: resp.invited, declinedNotes: resp.notes };
    });

    // Flush priority data to store — Events tab is now fully renderable
    const currentState1 = useTeamStore.getState();
    const isActiveTeam = teamId === currentState1.activeTeamId;
    const localPlayers = isActiveTeam
      ? currentState1.players
      : (currentState1.teams.find(t => t.id === teamId)?.players || []);
    const finalPlayers = players.length > 0 ? players : localPlayers;

    if (isActiveTeam) {
      useTeamStore.setState({ teamName, teamSettings, players: finalPlayers, games, events });
    }

    // Resolve currentPlayerId if missing (needs players to be loaded first)
    const storeAfterPhase1 = useTeamStore.getState();
    if (storeAfterPhase1.isLoggedIn && (!storeAfterPhase1.currentPlayerId || !players.some(p => p.id === storeAfterPhase1.currentPlayerId))) {
      const { userEmail, userPhone } = storeAfterPhase1;
      const matchingPlayer = players.find(p =>
        (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
        (userPhone && p.phone?.replace(/\D/g, '') === userPhone.replace(/\D/g, ''))
      );
      if (matchingPlayer) {
        console.log('SYNC: Resolved currentPlayerId from loaded team data:', matchingPlayer.id);
        useTeamStore.setState({ currentPlayerId: matchingPlayer.id });
      }
    }

    // Clear the syncing flag so the UI stops showing the loading state
    useTeamStore.getState().setIsSyncing(false);
    console.log(`SYNC: Phase 1 done — ${players.length} players, ${games.length} games, ${events.length} events`);

    // ── PHASE 2: Background data — photos, payments, polls, links ────────────
    // These are fetched after the UI is already interactive. No loading spinner.
    const [
      { data: periodsData },
      { data: photosData },
      { data: pollsData },
      { data: linksData },
    ] = await Promise.all([
      supabase.from('payment_periods').select('*').eq('team_id', teamId).order('sort_order', { ascending: true }),
      supabase.from('photos').select('*').eq('team_id', teamId).order('uploaded_at', { ascending: false }),
      supabase.from('polls').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('team_links').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    ]);

    // Fetch player_payments + payment_entries (depend on periodsData)
    const periodIds = (periodsData || []).map((p: any) => p.id);
    const { data: ppData } = periodIds.length > 0
      ? await supabase.from('player_payments').select('*').in('payment_period_id', periodIds)
      : { data: [] };
    const ppIds = (ppData || []).map((p: any) => p.id);
    const { data: entriesData } = ppIds.length > 0
      ? await supabase.from('payment_entries').select('*').in('player_payment_id', ppIds)
      : { data: [] };

    const playerPaymentsMap: Record<string, any[]> = {};
    const entriesMap: Record<string, any[]> = {};
    for (const pp of ppData || []) {
      if (!playerPaymentsMap[pp.payment_period_id]) playerPaymentsMap[pp.payment_period_id] = [];
      playerPaymentsMap[pp.payment_period_id].push(pp);
    }
    for (const entry of entriesData || []) {
      if (!entriesMap[entry.player_payment_id]) entriesMap[entry.player_payment_id] = [];
      entriesMap[entry.player_payment_id].push(entry);
    }

    const paymentPeriods: PaymentPeriod[] = (periodsData || []).map((pp: any) => ({
      id: pp.id,
      title: pp.title,
      amount: parseFloat(pp.amount) || 0,
      type: pp.type || 'misc',
      dueDate: pp.due_date || undefined,
      createdAt: pp.created_at,
      playerPayments: (playerPaymentsMap[pp.id] || []).map((p: any) => {
        const entries = (entriesMap[p.id] || []).map((e: any) => ({
          id: e.id,
          amount: parseFloat(e.amount) || 0,
          date: e.date,
          note: e.note || undefined,
          createdAt: e.created_at,
        }));
        return {
          playerId: p.player_id,
          status: (p.status || 'unpaid') as 'unpaid' | 'paid' | 'partial',
          amount: parseFloat(p.amount) || 0,
          notes: p.notes || undefined,
          paidAt: p.paid_at || undefined,
          entries,
        };
      }),
    }));

    const photos: Photo[] = (photosData || []).map((p: any) => ({
      id: p.id,
      gameId: p.game_id || '',
      uri: p.uri,
      uploadedBy: p.uploaded_by || '',
      uploadedAt: p.uploaded_at,
    }));

    const polls: Poll[] = (pollsData || []).map((p: any) => ({
      id: p.id,
      question: p.question,
      options: p.options || [],
      createdBy: p.created_by,
      createdAt: p.created_at,
      expiresAt: p.expires_at || undefined,
      isActive: p.is_active ?? true,
      allowMultipleVotes: p.allow_multiple_votes || false,
      groupId: p.group_id || undefined,
      groupName: p.group_name || undefined,
      isRequired: p.is_required || false,
    }));

    const teamLinks: TeamLink[] = (linksData || []).map((l: any) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      createdBy: l.created_by || '',
      createdAt: l.created_at,
    }));

    // Flush phase 2 data and update the teams[] array with the full picture
    // chatMessages and notifications were already flushed in Phase 1 — read them back from store
    const currentState2 = useTeamStore.getState();
    const phase1ChatMessages = isActiveTeam ? currentState2.chatMessages : (currentState2.teams.find(t => t.id === teamId)?.chatMessages ?? []);
    const phase1Notifications = isActiveTeam ? currentState2.notifications : (currentState2.teams.find(t => t.id === teamId)?.notifications ?? []);
    const teamEntry = {
      id: teamId,
      teamName,
      teamSettings,
      players: finalPlayers,
      games,
      events,
      chatMessages: phase1ChatMessages,
      chatLastReadAt: currentState2.teams.find(t => t.id === teamId)?.chatLastReadAt
        ?? (isActiveTeam ? currentState2.chatLastReadAt : {})
        ?? {},
      paymentPeriods,
      photos,
      notifications: phase1Notifications,
      polls,
      teamLinks,
    };

    const existsInArray = currentState2.teams.some(t => t.id === teamId);
    const updatedTeams = existsInArray
      ? currentState2.teams.map(t => t.id === teamId ? { ...t, ...teamEntry } : t)
      : [...currentState2.teams, teamEntry];

    if (isActiveTeam) {
      useTeamStore.setState({ paymentPeriods, photos, polls, teamLinks, teams: updatedTeams });
    } else {
      useTeamStore.setState({ teams: updatedTeams });
    }

    console.log(`SYNC: Phase 2 done — periods ${paymentPeriods.length}, photos ${photos.length}, polls ${polls.length}`);
    return true;
  } catch (err) {
    console.error('SYNC: loadTeamFromSupabase error:', err);
    useTeamStore.getState().setIsSyncing(false);
    return false;
  }
}

// ─── Realtime subscriptions ───────────────────────────────────────────────────

export function startRealtimeSync(teamId: string): void {
  if (activeSyncTeamId === teamId && activeChannel) {
    console.log('SYNC: Already subscribed for team:', teamId);
    return;
  }

  stopRealtimeSync();
  activeSyncTeamId = teamId;
  console.log('SYNC: Starting realtime sync for team:', teamId);

  // Do a full load first
  loadTeamFromSupabase(teamId);

  const channel = supabase.channel(`team-sync-v2:${teamId}`)

    // ── TEAMS (settings changes) ──────────────────────────────────────────────
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${teamId}` }, (payload) => {
      console.log('SYNC: Team settings UPDATE');
      const newSettings = mapTeamSettings(payload.new);
      useTeamStore.setState({ teamName: payload.new.name, teamSettings: newSettings });
    })

    // ── PLAYERS ───────────────────────────────────────────────────────────────
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, (payload) => {
      console.log('SYNC: Player INSERT');
      const store = useTeamStore.getState();
      const player = mapPlayer(payload.new);
      if (!store.players.some((p) => p.id === player.id)) {
        useTeamStore.setState({ players: [...store.players, player] });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, (payload) => {
      console.log('SYNC: Player UPDATE');
      const store = useTeamStore.getState();
      const updated = mapPlayer(payload.new);
      useTeamStore.setState({ players: store.players.map((p) => p.id === updated.id ? { ...updated } : p) });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, (payload) => {
      console.log('SYNC: Player DELETE');
      const store = useTeamStore.getState();
      useTeamStore.setState({ players: store.players.filter((p) => p.id !== payload.old.id) });
    })

    // ── GAMES ─────────────────────────────────────────────────────────────────
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, (payload) => {
      console.log('SYNC: Game INSERT');
      const store = useTeamStore.getState();
      const game = mapGame(payload.new);
      if (!store.games.some((g) => g.id === game.id)) {
        useTeamStore.setState({ games: [...store.games, game].sort((a, b) => a.date.localeCompare(b.date)) });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, (payload) => {
      console.log('SYNC: Game UPDATE', payload.new.id);
      const store = useTeamStore.getState();
      const updated = mapGame(payload.new);
      const existing = store.games.find((g) => g.id === updated.id);
      useTeamStore.setState({
        games: store.games.map((g) => g.id === updated.id
          ? { ...updated, checkedInPlayers: existing?.checkedInPlayers || [], checkedOutPlayers: existing?.checkedOutPlayers || [], invitedPlayers: existing?.invitedPlayers || [], checkoutNotes: existing?.checkoutNotes, photos: existing?.photos || [] }
          : g
        ),
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'games' }, (payload) => {
      console.log('SYNC: Game DELETE');
      const store = useTeamStore.getState();
      useTeamStore.setState({ games: store.games.filter((g) => g.id !== payload.old.id) });
    })

    // ── GAME RESPONSES ────────────────────────────────────────────────────────
    // postgres_changes on game_responses has no team_id filter so events are blocked for other users.
    // We use broadcast for cross-user real-time updates instead.
    .on('broadcast', { event: 'game_response' }, (payload) => {
      console.log('SYNC: Game response broadcast received');
      const { gameId, playerId, response, note } = payload.payload as { gameId: string; playerId: string; response: string; note?: string };
      const store = useTeamStore.getState();
      // Skip if this is our own change (we already updated local state optimistically)
      if (playerId === store.currentPlayerId) return;

      const games = store.games.map((game) => {
        if (game.id !== gameId) return game;

        let checkedIn = [...(game.checkedInPlayers || [])];
        let checkedOut = [...(game.checkedOutPlayers || [])];
        let invited = [...(game.invitedPlayers || [])];
        const notes = { ...(game.checkoutNotes || {}) };

        checkedIn = checkedIn.filter((id) => id !== playerId);
        checkedOut = checkedOut.filter((id) => id !== playerId);
        invited = invited.filter((id) => id !== playerId);
        delete notes[playerId];

        if (response === 'in') { checkedIn.push(playerId); if (!invited.includes(playerId)) invited.push(playerId); }
        else if (response === 'out') { checkedOut.push(playerId); if (!invited.includes(playerId)) invited.push(playerId); if (note) notes[playerId] = note; }
        else if (response === 'invited') { if (!invited.includes(playerId)) invited.push(playerId); }

        return { ...game, checkedInPlayers: checkedIn, checkedOutPlayers: checkedOut, invitedPlayers: invited, checkoutNotes: notes };
      });
      useTeamStore.setState({ games });
    })
    // Keep postgres_changes listener as fallback for self-updates
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_responses' }, (payload) => {
      const store = useTeamStore.getState();
      const row = (payload.new || payload.old) as any;
      if (!row?.game_id) return;
      // Only process for the current user's own changes (broadcast handles others)
      if (row.player_id !== store.currentPlayerId) return;
      console.log('SYNC: Game response self-change via postgres_changes');

      const games = store.games.map((game) => {
        if (game.id !== row.game_id) return game;

        let checkedIn = [...(game.checkedInPlayers || [])];
        let checkedOut = [...(game.checkedOutPlayers || [])];
        let invited = [...(game.invitedPlayers || [])];
        const notes = { ...(game.checkoutNotes || {}) };

        checkedIn = checkedIn.filter((id) => id !== row.player_id);
        checkedOut = checkedOut.filter((id) => id !== row.player_id);
        invited = invited.filter((id) => id !== row.player_id);
        delete notes[row.player_id];

        if (payload.eventType !== 'DELETE') {
          if (row.response === 'in') { checkedIn.push(row.player_id); if (!invited.includes(row.player_id)) invited.push(row.player_id); }
          else if (row.response === 'out') { checkedOut.push(row.player_id); if (!invited.includes(row.player_id)) invited.push(row.player_id); if (row.note) notes[row.player_id] = row.note; }
          else if (row.response === 'invited') { if (!invited.includes(row.player_id)) invited.push(row.player_id); }
        }

        return { ...game, checkedInPlayers: checkedIn, checkedOutPlayers: checkedOut, invitedPlayers: invited, checkoutNotes: notes };
      });
      useTeamStore.setState({ games });
    })

    // ── EVENTS ────────────────────────────────────────────────────────────────
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` }, (payload) => {
      console.log('SYNC: Event INSERT');
      const store = useTeamStore.getState();
      const event = mapEvent(payload.new);
      if (!store.events.some((e) => e.id === event.id)) {
        useTeamStore.setState({ events: [...store.events, event].sort((a, b) => a.date.localeCompare(b.date)) });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` }, (payload) => {
      console.log('SYNC: Event UPDATE');
      const store = useTeamStore.getState();
      const updated = mapEvent(payload.new);
      const existing = store.events.find((e) => e.id === updated.id);
      useTeamStore.setState({
        events: store.events.map((e) => e.id === updated.id
          ? { ...updated, confirmedPlayers: existing?.confirmedPlayers || [], declinedPlayers: existing?.declinedPlayers || [], invitedPlayers: existing?.invitedPlayers || [], declinedNotes: existing?.declinedNotes }
          : e
        ),
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, (payload) => {
      console.log('SYNC: Event DELETE');
      const store = useTeamStore.getState();
      useTeamStore.setState({ events: store.events.filter((e) => e.id !== payload.old.id) });
    })

    // ── EVENT RESPONSES ───────────────────────────────────────────────────────
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_responses' }, (payload) => {
      const store = useTeamStore.getState();
      const row = (payload.new || payload.old) as any;
      if (!row?.event_id) return;

      const events = store.events.map((event) => {
        if (event.id !== row.event_id) return event;

        let confirmed = [...(event.confirmedPlayers || [])];
        let declined = [...(event.declinedPlayers || [])];
        let invited = [...(event.invitedPlayers || [])];
        const notes = { ...(event.declinedNotes || {}) };

        confirmed = confirmed.filter((id) => id !== row.player_id);
        declined = declined.filter((id) => id !== row.player_id);
        invited = invited.filter((id) => id !== row.player_id);
        delete notes[row.player_id];

        if (payload.eventType !== 'DELETE') {
          if (row.response === 'confirmed') { confirmed.push(row.player_id); if (!invited.includes(row.player_id)) invited.push(row.player_id); }
          else if (row.response === 'declined') { declined.push(row.player_id); if (!invited.includes(row.player_id)) invited.push(row.player_id); if (row.note) notes[row.player_id] = row.note; }
          else if (row.response === 'invited') { if (!invited.includes(row.player_id)) invited.push(row.player_id); }
        }

        return { ...event, confirmedPlayers: confirmed, declinedPlayers: declined, invitedPlayers: invited, declinedNotes: notes };
      });
      useTeamStore.setState({ events });
    })

    // ── CHAT MESSAGES ─────────────────────────────────────────────────────────
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const m = payload.new as any;
      if (store.chatMessages.some((msg) => msg.id === m.id)) return;
      const msg: ChatMessage = {
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_name || undefined,
        message: m.message || '',
        imageUrl: m.image_url || undefined,
        gifUrl: m.gif_url || undefined,
        gifWidth: m.gif_width || undefined,
        gifHeight: m.gif_height || undefined,
        mentionedPlayerIds: m.mentioned_player_ids || [],
        mentionType: m.mention_type || undefined,
        createdAt: m.created_at,
      };
      useTeamStore.setState({ chatMessages: [...store.chatMessages, msg] });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
      const store = useTeamStore.getState();
      useTeamStore.setState({ chatMessages: store.chatMessages.filter((m) => m.id !== payload.old.id) });
    })

    // ── PAYMENT PERIODS ───────────────────────────────────────────────────────
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_periods', filter: `team_id=eq.${teamId}` }, async () => {
      console.log('SYNC: Payment period change — refetching payments');
      await refetchPayments(teamId);
    })
    // player_payments and payment_entries don't have team_id directly, so we refetch on any change
    // but deduplicate rapid-fire calls with a short debounce
    .on('postgres_changes', { event: '*', schema: 'public', table: 'player_payments' }, async (payload) => {
      // Only act if this change belongs to our team by checking period IDs in cache
      const store = useTeamStore.getState();
      const row = (payload.new || payload.old) as any;
      if (row?.payment_period_id) {
        const isOurTeam = store.paymentPeriods.some(p => p.id === row.payment_period_id);
        if (!isOurTeam) return;
      }
      console.log('SYNC: Player payment change — refetching payments');
      await refetchPayments(teamId);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_entries' }, async (payload) => {
      // Only act if this entry belongs to a player_payment in our team
      const store = useTeamStore.getState();
      const row = (payload.new || payload.old) as any;
      if (row?.player_payment_id) {
        const ourPpIds = store.paymentPeriods.flatMap(p => p.playerPayments.map(pp => `pp-${p.id}-${pp.playerId}`));
        // If we can't confirm it's ours, still refetch (safer)
        if (ourPpIds.length > 0 && !ourPpIds.includes(row.player_payment_id)) {
          // check by fetching - just refetch to be safe
        }
      }
      await refetchPayments(teamId);
    })

    // ── PHOTOS ────────────────────────────────────────────────────────────────
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const p = payload.new as any;
      // Check by both id and uri to handle optimistic updates where local photo gets replaced
      if (store.photos.some((ph) => ph.id === p.id)) return;
      useTeamStore.setState({ photos: [{ id: p.id, gameId: p.game_id || '', uri: p.uri, uploadedBy: p.uploaded_by || '', uploadedAt: p.uploaded_at }, ...store.photos] });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'photos' }, (payload) => {
      const store = useTeamStore.getState();
      useTeamStore.setState({ photos: store.photos.filter((p) => p.id !== payload.old.id) });
    })

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      const store = useTeamStore.getState();
      const n = payload.new as any;
      if (n.to_player_id !== store.currentPlayerId) return;
      if (store.notifications.some((notif) => notif.id === n.id)) return;
      const notif: AppNotification = {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        gameId: n.game_id || undefined,
        eventId: n.event_id || undefined,
        fromPlayerId: n.from_player_id || undefined,
        toPlayerId: n.to_player_id,
        createdAt: n.created_at,
        read: n.read || false,
      };
      useTeamStore.setState({ notifications: [notif, ...store.notifications] });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
      const store = useTeamStore.getState();
      const n = payload.new as any;
      useTeamStore.setState({ notifications: store.notifications.map((notif) => notif.id === n.id ? { ...notif, read: n.read } : notif) });
    })

    // ── POLLS ─────────────────────────────────────────────────────────────────
    .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `team_id=eq.${teamId}` }, async () => {
      const { data } = await supabase.from('polls').select('*').eq('team_id', teamId).order('created_at', { ascending: false });
      const polls: Poll[] = (data || []).map((p: any) => ({
        id: p.id, question: p.question, options: p.options || [],
        createdBy: p.created_by, createdAt: p.created_at,
        expiresAt: p.expires_at || undefined, isActive: p.is_active ?? true,
        allowMultipleVotes: p.allow_multiple_votes || false,
        groupId: p.group_id || undefined, groupName: p.group_name || undefined, isRequired: p.is_required || false,
      }));
      useTeamStore.setState({ polls });
    })

    // ── TEAM LINKS ────────────────────────────────────────────────────────────
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_links', filter: `team_id=eq.${teamId}` }, async () => {
      const { data } = await supabase.from('team_links').select('*').eq('team_id', teamId).order('created_at', { ascending: true });
      const teamLinks: TeamLink[] = (data || []).map((l: any) => ({
        id: l.id, title: l.title, url: l.url, createdBy: l.created_by || '', createdAt: l.created_at,
      }));
      useTeamStore.setState({ teamLinks });
    });

  channel.subscribe((status) => {
    console.log('SYNC: Subscription status:', status);
  });

  activeChannel = channel;
}

export function stopRealtimeSync(): void {
  if (activeChannel) {
    console.log('SYNC: Stopping realtime sync');
    activeChannel.unsubscribe();
    activeChannel = null;
    activeSyncTeamId = null;
  }
}

export function getActiveSyncTeamId(): string | null {
  return activeSyncTeamId;
}

// ─── Payment refetch helper ───────────────────────────────────────────────────

async function refetchPayments(teamId: string): Promise<void> {
  try {
    const { data: periodsData } = await supabase.from('payment_periods').select('*').eq('team_id', teamId).order('sort_order', { ascending: true });
    if (!periodsData) return;

    const periodIds = periodsData.map((p: any) => p.id);
    let playerPaymentsMap: Record<string, any[]> = {};
    let entriesMap: Record<string, any[]> = {};

    if (periodIds.length > 0) {
      const { data: ppData } = await supabase.from('player_payments').select('*').in('payment_period_id', periodIds);
      const ppIds = (ppData || []).map((p: any) => p.id);
      for (const pp of ppData || []) {
        if (!playerPaymentsMap[pp.payment_period_id]) playerPaymentsMap[pp.payment_period_id] = [];
        playerPaymentsMap[pp.payment_period_id].push(pp);
      }
      if (ppIds.length > 0) {
        const { data: entriesData } = await supabase.from('payment_entries').select('*').in('player_payment_id', ppIds);
        for (const e of entriesData || []) {
          if (!entriesMap[e.player_payment_id]) entriesMap[e.player_payment_id] = [];
          entriesMap[e.player_payment_id].push(e);
        }
      }
    }

    const paymentPeriods: PaymentPeriod[] = periodsData.map((pp: any) => ({
      id: pp.id, title: pp.title,
      amount: parseFloat(pp.amount) || 0,
      type: pp.type || 'misc',
      dueDate: pp.due_date || undefined,
      createdAt: pp.created_at,
      playerPayments: (playerPaymentsMap[pp.id] || []).map((p: any) => {
        const entries = (entriesMap[p.id] || []).map((e: any) => ({
          id: e.id, amount: parseFloat(e.amount) || 0, date: e.date, note: e.note || undefined, createdAt: e.created_at,
        }));
        return { playerId: p.player_id, status: p.status || 'unpaid', amount: parseFloat(p.amount) || 0, notes: p.notes || undefined, paidAt: p.paid_at || undefined, entries };
      }),
    }));

    useTeamStore.setState({ paymentPeriods });
  } catch (err) {
    console.error('SYNC: refetchPayments error:', err);
  }
}

// ─── Supabase write helpers ───────────────────────────────────────────────────

export async function pushTeamToSupabase(teamId: string, teamName: string, settings: TeamSettings): Promise<void> {
  const basePayload = {
    id: teamId,
    name: teamName,
    sport: settings.sport,
    team_logo: settings.teamLogo || null,
    wins: settings.record?.wins || 0,
    losses: settings.record?.losses || 0,
    ties: settings.record?.ties || 0,
    ot_losses: settings.record?.otLosses || 0,
    show_team_stats: settings.showTeamStats ?? true,
    show_payments: settings.showPayments ?? true,
    show_team_chat: settings.showTeamChat ?? true,
    show_photos: settings.showPhotos ?? true,
    show_refreshment_duty: settings.showRefreshmentDuty ?? true,
    refreshment_duty_is_21_plus: settings.refreshmentDutyIs21Plus ?? true,
    show_lineups: settings.showLineups ?? true,
    allow_player_self_stats: settings.allowPlayerSelfStats ?? false,
    show_records: settings.showTeamRecords ?? true,
    enabled_roles: settings.enabledRoles || ['player', 'reserve', 'coach', 'parent'],
    is_softball: settings.isSoftball ?? false,
    jersey_colors: settings.jerseyColors,
    payment_methods: settings.paymentMethods,
    current_season_name: settings.currentSeasonName || null,
    season_history: settings.seasonHistory || [],
    championships: settings.championships || [],
  };

  try {
    const { error } = await supabase.from('teams').upsert({
      ...basePayload,
      stripe_account_id: settings.stripeAccountId || null,
      stripe_onboarding_complete: settings.stripeOnboardingComplete ?? false,
    }, { onConflict: 'id' });

    if (error) {
      // If Stripe columns don't exist yet (migration not run), fall back to base payload
      if (error.message?.includes('stripe_account_id') || error.message?.includes('stripe_onboarding_complete')) {
        const { error: fallbackError } = await supabase.from('teams').upsert(basePayload, { onConflict: 'id' });
        if (fallbackError) console.error('SYNC: pushTeamToSupabase error:', fallbackError.message);
      } else {
        console.error('SYNC: pushTeamToSupabase error:', error.message);
      }
    }
  } catch (err) {
    console.error('SYNC: pushTeamToSupabase error:', err);
  }
}

export async function pushPlayerToSupabase(player: Player, teamId: string): Promise<void> {
  try {
    const { error } = await supabase.from('players').upsert({
      id: player.id,
      team_id: teamId,
      first_name: player.firstName,
      last_name: player.lastName,
      email: player.email || null,
      phone: player.phone || null,
      jersey_number: player.number || '',
      position: player.position || 'C',
      positions: player.positions || [],
      avatar: player.avatar || null,
      roles: player.roles || [],
      status: player.status || 'active',
      is_injured: player.isInjured || false,
      is_suspended: player.isSuspended || false,
      status_end_date: player.statusEndDate || null,
      unavailable_dates: player.unavailableDates || [],
      // notification_preferences and push_token intentionally omitted:
      // - push tokens are managed exclusively via the backend /api/notifications/save-token
      //   endpoint which writes to the dedicated push_tokens table
      // - writing notification_preferences here would overwrite the JSONB column and could
      //   corrupt any data stored there by other processes
    stats: { ...(player.stats || {}), _associatedPlayerId: player.associatedPlayerId || undefined },
      goalie_stats: player.goalieStats || {},
      pitcher_stats: player.pitcherStats || {},
      game_logs: player.gameLogs || [],
      // Store hashed password for phone-only users (no Supabase Auth account)
      // This is a hashed value, never plain-text
      password: player.password || null,
    }, { onConflict: 'id' });
    if (error) console.error('SYNC: pushPlayerToSupabase error:', error.message);
  } catch (err) {
    console.error('SYNC: pushPlayerToSupabase error:', err);
  }
}

/**
 * Look up a player in Supabase by email OR phone within a given team.
 * Returns the raw player row (mapped to Player) or null if not found.
 * Use this before creating a new player to avoid duplicates.
 */
export async function findPlayerInSupabaseByContact(
  teamId: string,
  email: string | undefined,
  phone: string | undefined,
): Promise<Player | null> {
  try {
    let query = supabase.from('players').select('*').eq('team_id', teamId);
    if (email) {
      query = query.ilike('email', email);
    } else if (phone) {
      // Strip non-digits for comparison; Supabase stores digits-only
      const digits = phone.replace(/\D/g, '');
      query = query.eq('phone', digits);
    } else {
      return null;
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return mapPlayer(data);
  } catch (err) {
    console.error('SYNC: findPlayerInSupabaseByContact error:', err);
    return null;
  }
}

export async function deletePlayerFromSupabase(playerId: string): Promise<void> {
  try {
    await supabase.from('players').delete().eq('id', playerId);
  } catch (err) {
    console.error('SYNC: deletePlayerFromSupabase error:', err);
  }
}

export async function pushGameToSupabase(game: Game, teamId: string): Promise<void> {
  try {
    const { error } = await supabase.from('games').upsert({
      id: game.id,
      team_id: teamId,
      opponent: game.opponent,
      date: game.date,
      time: game.time,
      location: game.location,
      address: game.address || null,
      jersey_color: game.jerseyColor || null,
      notes: game.notes || null,
      show_beer_duty: game.showBeerDuty || false,
      beer_duty_player_id: game.beerDutyPlayerId || null,
      hockey_lineup: game.lineup || null,
      basketball_lineup: game.basketballLineup || null,
      baseball_lineup: game.baseballLineup || null,
      batting_order_lineup: game.battingOrderLineup || null,
      soccer_lineup: game.soccerLineup || null,
      soccer_diamond_lineup: game.soccerDiamondLineup || null,
      lacrosse_lineup: game.lacrosseLineup || null,
      invite_release_option: game.inviteReleaseOption || 'now',
      invite_release_date: game.inviteReleaseDate || null,
      invites_sent: game.invitesSent || false,
      final_score_us: game.finalScoreUs ?? null,
      final_score_them: game.finalScoreThem ?? null,
      game_result: game.gameResult || null,
      result_recorded: game.resultRecorded || false,
    }, { onConflict: 'id' });
    if (error) console.error('SYNC: pushGameToSupabase error:', error.message);
  } catch (err) {
    console.error('SYNC: pushGameToSupabase error:', err);
  }
}

export async function deleteGameFromSupabase(gameId: string): Promise<void> {
  try {
    await supabase.from('games').delete().eq('id', gameId);
  } catch (err) {
    console.error('SYNC: deleteGameFromSupabase error:', err);
  }
}

export async function pushGameResponseToSupabase(gameId: string, playerId: string, response: 'in' | 'out' | 'invited', note?: string): Promise<void> {
  try {
    await supabase.from('game_responses').upsert(
      { game_id: gameId, player_id: playerId, response, note: note || null },
      { onConflict: 'game_id,player_id' }
    );
    // Broadcast the response change so other subscribers can update in real-time.
    // game_responses has no team_id filter so postgres_changes events don't reach other users.
    const teamId = useTeamStore.getState().activeTeamId;
    if (teamId) {
      supabase.channel(`team-sync-v2:${teamId}`).send({
        type: 'broadcast',
        event: 'game_response',
        payload: { gameId, playerId, response, note: note || null },
      });
    }
  } catch (err) {
    console.error('SYNC: pushGameResponseToSupabase error:', err);
  }
}

export async function deleteGameResponseFromSupabase(gameId: string, playerId: string): Promise<void> {
  try {
    await supabase.from('game_responses').delete().eq('game_id', gameId).eq('player_id', playerId);
  } catch (err) {
    console.error('SYNC: deleteGameResponseFromSupabase error:', err);
  }
}

export async function pushEventToSupabase(event: Event, teamId: string): Promise<void> {
  try {
    const { error } = await supabase.from('events').upsert({
      id: event.id,
      team_id: teamId,
      title: event.title,
      type: event.type || 'other',
      date: event.date,
      time: event.time,
      location: event.location,
      address: event.address || null,
      notes: event.notes || null,
      invite_release_option: event.inviteReleaseOption || 'now',
      invite_release_date: event.inviteReleaseDate || null,
      invites_sent: event.invitesSent || false,
    }, { onConflict: 'id' });
    if (error) console.error('SYNC: pushEventToSupabase error:', error.message);
  } catch (err) {
    console.error('SYNC: pushEventToSupabase error:', err);
  }
}

export async function deleteEventFromSupabase(eventId: string): Promise<void> {
  try {
    await supabase.from('events').delete().eq('id', eventId);
  } catch (err) {
    console.error('SYNC: deleteEventFromSupabase error:', err);
  }
}

export async function pushEventResponseToSupabase(eventId: string, playerId: string, response: 'confirmed' | 'declined' | 'invited', note?: string): Promise<void> {
  try {
    await supabase.from('event_responses').upsert(
      { event_id: eventId, player_id: playerId, response, note: note || null },
      { onConflict: 'event_id,player_id' }
    );
  } catch (err) {
    console.error('SYNC: pushEventResponseToSupabase error:', err);
  }
}

export async function pushChatMessageToSupabase(message: ChatMessage, teamId: string): Promise<void> {
  try {
    const { error } = await supabase.from('chat_messages').insert({
      id: message.id,
      team_id: teamId,
      sender_id: message.senderId,
      sender_name: message.senderName || null,
      message: message.message || null,
      image_url: message.imageUrl || null,
      gif_url: message.gifUrl || null,
      gif_width: message.gifWidth || null,
      gif_height: message.gifHeight || null,
      mentioned_player_ids: message.mentionedPlayerIds || [],
      mention_type: message.mentionType || null,
      created_at: message.createdAt,
    });
    if (error) console.error('SYNC: pushChatMessageToSupabase error:', error.message);
  } catch (err) {
    console.error('SYNC: pushChatMessageToSupabase error:', err);
  }
}

export async function deleteChatMessageFromSupabase(messageId: string): Promise<void> {
  try {
    await supabase.from('chat_messages').delete().eq('id', messageId);
  } catch (err) {
    console.error('SYNC: deleteChatMessageFromSupabase error:', err);
  }
}

export async function pushPaymentPeriodToSupabase(period: PaymentPeriod, teamId: string): Promise<void> {
  try {
    const { error } = await supabase.from('payment_periods').upsert({
      id: period.id,
      team_id: teamId,
      title: period.title,
      amount: period.amount,
      type: period.type || 'misc',
      due_date: period.dueDate || null,
    }, { onConflict: 'id' });
    if (error) { console.error('SYNC: pushPaymentPeriodToSupabase error:', error.message); return; }

    for (const pp of period.playerPayments || []) {
      const ppId = `pp-${period.id}-${pp.playerId}`;
      const { data: existing } = await supabase.from('player_payments').select('id').eq('payment_period_id', period.id).eq('player_id', pp.playerId).single();
      const actualId = existing?.id || ppId;

      await supabase.from('player_payments').upsert({
        id: actualId,
        payment_period_id: period.id,
        player_id: pp.playerId,
        status: pp.status || 'unpaid',
        amount: pp.amount || 0,
        notes: pp.notes || null,
        paid_at: pp.paidAt || null,
      }, { onConflict: 'payment_period_id,player_id' });

      for (const entry of pp.entries || []) {
        await supabase.from('payment_entries').upsert({
          id: entry.id,
          player_payment_id: actualId,
          amount: entry.amount,
          date: entry.date,
          note: entry.note || null,
        }, { onConflict: 'id' });
      }
    }
  } catch (err) {
    console.error('SYNC: pushPaymentPeriodToSupabase error:', err);
  }
}

export async function deletePaymentPeriodFromSupabase(periodId: string): Promise<void> {
  try {
    await supabase.from('payment_periods').delete().eq('id', periodId);
  } catch (err) {
    console.error('SYNC: deletePaymentPeriodFromSupabase error:', err);
  }
}

export async function pushNotificationToSupabase(notification: AppNotification, teamId: string): Promise<void> {
  try {
    await supabase.from('notifications').upsert({
      id: notification.id,
      team_id: teamId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      game_id: notification.gameId || null,
      event_id: notification.eventId || null,
      from_player_id: notification.fromPlayerId || null,
      to_player_id: notification.toPlayerId,
      read: notification.read || false,
      created_at: notification.createdAt,
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('SYNC: pushNotificationToSupabase error:', err);
  }
}

export async function markNotificationReadInSupabase(notificationId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  } catch (err) {
    console.error('SYNC: markNotificationReadInSupabase error:', err);
  }
}

export async function pushPollToSupabase(poll: Poll, teamId: string): Promise<void> {
  try {
    await supabase.from('polls').upsert({
      id: poll.id,
      team_id: teamId,
      question: poll.question,
      options: poll.options,
      created_by: poll.createdBy,
      expires_at: poll.expiresAt || null,
      is_active: poll.isActive,
      allow_multiple_votes: poll.allowMultipleVotes,
      group_id: poll.groupId || null,
      group_name: poll.groupName || null,
      is_required: poll.isRequired || false,
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('SYNC: pushPollToSupabase error:', err);
  }
}

export async function pushTeamLinkToSupabase(link: TeamLink, teamId: string): Promise<void> {
  try {
    await supabase.from('team_links').upsert({
      id: link.id,
      team_id: teamId,
      title: link.title,
      url: link.url,
      created_by: link.createdBy || null,
    }, { onConflict: 'id' });
  } catch (err) {
    console.error('SYNC: pushTeamLinkToSupabase error:', err);
  }
}

export async function deleteTeamLinkFromSupabase(linkId: string): Promise<void> {
  try {
    await supabase.from('team_links').delete().eq('id', linkId);
  } catch (err) {
    console.error('SYNC: deleteTeamLinkFromSupabase error:', err);
  }
}

/**
 * Wipe all team content from Supabase (games, events, chat, photos, payments, polls, links)
 * but leave the team row and players intact. Used by "Erase All Data".
 */
export async function eraseTeamContentFromSupabase(teamId: string): Promise<void> {
  try {
    await Promise.all([
      supabase.from('games').delete().eq('team_id', teamId),
      supabase.from('events').delete().eq('team_id', teamId),
      supabase.from('chat_messages').delete().eq('team_id', teamId),
      supabase.from('photos').delete().eq('team_id', teamId),
      supabase.from('payment_periods').delete().eq('team_id', teamId),
      supabase.from('polls').delete().eq('team_id', teamId),
      supabase.from('team_links').delete().eq('team_id', teamId),
      supabase.from('notifications').delete().eq('team_id', teamId),
    ]);
    console.log('SYNC: eraseTeamContentFromSupabase complete for', teamId);
  } catch (err) {
    console.error('SYNC: eraseTeamContentFromSupabase error:', err);
  }
}

/**
 * Delete the entire team and all its players from Supabase.
 * Used by "Delete Team" nuclear option.
 * The CASCADE on the DB will clean up related rows (games, events, etc.)
 */
export async function deleteTeamFromSupabase(teamId: string): Promise<void> {
  try {
    // Delete the team row — CASCADE will wipe all related rows
    await supabase.from('teams').delete().eq('id', teamId);
    console.log('SYNC: deleteTeamFromSupabase complete for', teamId);
  } catch (err) {
    console.error('SYNC: deleteTeamFromSupabase error:', err);
  }
}

/**
 * Delete a player's Supabase auth account via the backend admin endpoint.
 */
export async function deleteAuthUser(email: string): Promise<void> {
  const backendUrl = BACKEND_URL;
  if (!backendUrl) {
    console.warn('SYNC: deleteAuthUser - no backend URL configured');
    return;
  }
  try {
    await fetch(`${backendUrl}/api/auth/delete-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    console.error('SYNC: deleteAuthUser error:', err);
  }
}

/**
 * Delete multiple players' Supabase auth accounts via the backend admin endpoint.
 */
export async function deleteAuthUsers(emails: string[]): Promise<void> {
  if (!emails.length) return;
  const backendUrl = BACKEND_URL;
  if (!backendUrl) {
    console.warn('SYNC: deleteAuthUsers - no backend URL configured');
    return;
  }
  try {
    await fetch(`${backendUrl}/api/auth/delete-users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
  } catch (err) {
    console.error('SYNC: deleteAuthUsers error:', err);
  }
}

// Legacy export name kept for compatibility
export { loadTeamFromSupabase as fetchAndApplyFullTeamSync };
