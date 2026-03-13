/**
 * Supabase Realtime Sync — adapted from mobile/src/lib/realtime-sync.ts
 * Only change: imports from web Supabase client + web Zustand store.
 */

import { getSupabaseClient } from './supabase';
import { useTeamStore } from './store';
import type {
  Game, Event, Player, ChatMessage, PaymentPeriod, Photo,
  AppNotification, Poll, TeamLink, TeamSettings
} from './types';

let activeChannel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null;
let activeSyncTeamId: string | null = null;

// ─── Row → Store mappers ──────────────────────────────────────────────────────

function mapTeamSettings(t: any): TeamSettings {
  return {
    sport: t.sport || 'hockey',
    jerseyColors: t.jersey_colors || [{ name: 'White', color: '#ffffff' }, { name: 'Black', color: '#1a1a1a' }],
    paymentMethods: t.payment_methods || [],
    teamLogo: t.team_logo || undefined,
    record: { wins: t.wins || 0, losses: t.losses || 0, ties: t.ties || 0, otLosses: t.ot_losses || 0 },
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
    stats: p.stats || {},
    goalieStats: p.goalie_stats || {},
    pitcherStats: p.pitcher_stats || {},
    gameLogs: p.game_logs || [],
    password: p.password || undefined,
    associatedPlayerId: p.associated_player_id || undefined,
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

// ─── Full team load ───────────────────────────────────────────────────────────

export async function loadTeamFromSupabase(teamId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { data: teamData, error: teamError } = await supabase
      .from('teams').select('*').eq('id', teamId).maybeSingle();
    if (teamError || !teamData) {
      console.warn('SYNC: Team not found:', teamId, teamError?.message);
      return false;
    }

    const teamSettings = mapTeamSettings(teamData);
    const teamName = teamData.name;

    // ── PHASE 1: Priority data — players, games, events, chat, notifications ──
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

    const rawPlayers = (playersData || []).map(mapPlayer);
    const playerMap = new Map<string, Player>();
    for (const p of rawPlayers) playerMap.set(p.id, p);
    const players = Array.from(playerMap.values());

    // Fetch game + event responses in parallel now that we have the IDs
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

    const chatMessages: ChatMessage[] = (chatData || []).map((m: any) => ({
      id: m.id, senderId: m.sender_id, senderName: m.sender_name || undefined,
      message: m.message || '', imageUrl: m.image_url || undefined, gifUrl: m.gif_url || undefined,
      gifWidth: m.gif_width || undefined, gifHeight: m.gif_height || undefined,
      mentionedPlayerIds: m.mentioned_player_ids || [], mentionType: m.mention_type || undefined,
      createdAt: m.created_at,
    }));

    const notifications: AppNotification[] = (notifData || []).map((n: any) => ({
      id: n.id, type: n.type, title: n.title, message: n.message,
      gameId: n.game_id || undefined, eventId: n.event_id || undefined,
      fromPlayerId: n.from_player_id || undefined, toPlayerId: n.to_player_id,
      createdAt: n.created_at, read: n.read || false,
    }));

    // Flush phase 1 — all priority tabs now renderable
    useTeamStore.setState({ teamName, teamSettings, players, games, events, chatMessages, notifications });

    // Resolve currentPlayerId if stale
    const storeAfterPhase1 = useTeamStore.getState();
    if (storeAfterPhase1.isLoggedIn && (!storeAfterPhase1.currentPlayerId || !players.some((p) => p.id === storeAfterPhase1.currentPlayerId))) {
      const { userEmail } = storeAfterPhase1;
      const matchingPlayer = players.find((p) => userEmail && p.email?.toLowerCase() === userEmail.toLowerCase());
      if (matchingPlayer) useTeamStore.setState({ currentPlayerId: matchingPlayer.id });
    }

    console.log(`SYNC: Phase 1 done — ${players.length} players, ${games.length} games, ${events.length} events`);

    // ── PHASE 2: Background data — photos, payments, polls, links ────────────
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
      id: pp.id, title: pp.title, amount: parseFloat(pp.amount) || 0, type: pp.type || 'misc',
      dueDate: pp.due_date || undefined, createdAt: pp.created_at,
      playerPayments: (playerPaymentsMap[pp.id] || []).map((p: any) => {
        const entries = (entriesMap[p.id] || []).map((e: any) => ({
          id: e.id, amount: parseFloat(e.amount) || 0, date: e.date, note: e.note || undefined, createdAt: e.created_at,
        }));
        return { playerId: p.player_id, status: p.status || 'unpaid', amount: parseFloat(p.amount) || 0, notes: p.notes || undefined, paidAt: p.paid_at || undefined, entries };
      }),
    }));

    const photos: Photo[] = (photosData || []).map((p: any) => ({
      id: p.id, gameId: p.game_id || '', uri: p.uri, uploadedBy: p.uploaded_by || '', uploadedAt: p.uploaded_at,
    }));

    const polls: Poll[] = (pollsData || []).map((p: any) => ({
      id: p.id, question: p.question, options: p.options || [], createdBy: p.created_by,
      createdAt: p.created_at, expiresAt: p.expires_at || undefined, isActive: p.is_active ?? true,
      allowMultipleVotes: p.allow_multiple_votes || false,
      groupId: p.group_id || undefined, groupName: p.group_name || undefined, isRequired: p.is_required || false,
    }));

    const teamLinks: TeamLink[] = (linksData || []).map((l: any) => ({
      id: l.id, title: l.title, url: l.url, createdBy: l.created_by || '', createdAt: l.created_at,
    }));

    // Update store and teams[] with full picture
    const currentState = useTeamStore.getState();
    const teamEntry = {
      id: teamId, teamName, teamSettings, players, games, events, chatMessages,
      chatLastReadAt: currentState.teams.find((t) => t.id === teamId)?.chatLastReadAt ?? currentState.chatLastReadAt ?? {},
      paymentPeriods, photos, notifications, polls, teamLinks,
    };
    const existsInArray = currentState.teams.some((t) => t.id === teamId);
    const updatedTeams = existsInArray
      ? currentState.teams.map((t) => t.id === teamId ? { ...t, ...teamEntry } : t)
      : [...currentState.teams, teamEntry];

    useTeamStore.setState({ paymentPeriods, photos, polls, teamLinks, teams: updatedTeams });

    console.log(`SYNC: Phase 2 done — periods ${paymentPeriods.length}, photos ${photos.length}, polls ${polls.length}`);
    return true;
  } catch (err) {
    console.error('SYNC: loadTeamFromSupabase error:', err);
    return false;
  }
}

// ─── Realtime subscriptions ───────────────────────────────────────────────────

export function startRealtimeSync(teamId: string): void {
  if (activeSyncTeamId === teamId && activeChannel) return;
  stopRealtimeSync();
  activeSyncTeamId = teamId;

  const supabase = getSupabaseClient();
  loadTeamFromSupabase(teamId);

  const channel = supabase.channel(`team-sync-v2:${teamId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${teamId}` }, (payload) => {
      useTeamStore.setState({ teamName: payload.new.name, teamSettings: mapTeamSettings(payload.new) });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const player = mapPlayer(payload.new);
      if (!store.players.some((p) => p.id === player.id)) {
        useTeamStore.setState({ players: [...store.players, player] });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const updated = mapPlayer(payload.new);
      useTeamStore.setState({ players: store.players.map((p) => p.id === updated.id ? updated : p) });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, (payload) => {
      const store = useTeamStore.getState();
      useTeamStore.setState({ players: store.players.filter((p) => p.id !== payload.old.id) });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const game = mapGame(payload.new);
      if (!store.games.some((g) => g.id === game.id)) {
        useTeamStore.setState({ games: [...store.games, game].sort((a, b) => a.date.localeCompare(b.date)) });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const updated = mapGame(payload.new);
      const existing = store.games.find((g) => g.id === updated.id);
      useTeamStore.setState({
        games: store.games.map((g) => g.id === updated.id
          ? { ...updated, checkedInPlayers: existing?.checkedInPlayers || [], checkedOutPlayers: existing?.checkedOutPlayers || [], invitedPlayers: existing?.invitedPlayers || [], checkoutNotes: existing?.checkoutNotes, photos: existing?.photos || [] }
          : g),
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'games' }, (payload) => {
      const store = useTeamStore.getState();
      useTeamStore.setState({ games: store.games.filter((g) => g.id !== payload.old.id) });
    })
    .on('broadcast', { event: 'game_response' }, (payload) => {
      const { gameId, playerId, response, note } = payload.payload as { gameId: string; playerId: string; response: string; note?: string };
      const store = useTeamStore.getState();
      if (playerId === store.currentPlayerId) return;
      const games = store.games.map((game) => {
        if (game.id !== gameId) return game;
        let checkedIn = [...(game.checkedInPlayers || [])].filter((id) => id !== playerId);
        let checkedOut = [...(game.checkedOutPlayers || [])].filter((id) => id !== playerId);
        let invited = [...(game.invitedPlayers || [])].filter((id) => id !== playerId);
        const notes = { ...(game.checkoutNotes || {}) };
        delete notes[playerId];
        if (response === 'in') { checkedIn.push(playerId); if (!invited.includes(playerId)) invited.push(playerId); }
        else if (response === 'out') { checkedOut.push(playerId); if (!invited.includes(playerId)) invited.push(playerId); if (note) notes[playerId] = note; }
        else if (response === 'invited') { if (!invited.includes(playerId)) invited.push(playerId); }
        return { ...game, checkedInPlayers: checkedIn, checkedOutPlayers: checkedOut, invitedPlayers: invited, checkoutNotes: notes };
      });
      useTeamStore.setState({ games });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_responses' }, (payload) => {
      const store = useTeamStore.getState();
      const row = (payload.new || payload.old) as any;
      if (!row?.game_id || row.player_id !== store.currentPlayerId) return;
      const games = store.games.map((game) => {
        if (game.id !== row.game_id) return game;
        let checkedIn = [...(game.checkedInPlayers || [])].filter((id) => id !== row.player_id);
        let checkedOut = [...(game.checkedOutPlayers || [])].filter((id) => id !== row.player_id);
        let invited = [...(game.invitedPlayers || [])].filter((id) => id !== row.player_id);
        const notes = { ...(game.checkoutNotes || {}) };
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
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const event = mapEvent(payload.new);
      if (!store.events.some((e) => e.id === event.id)) {
        useTeamStore.setState({ events: [...store.events, event].sort((a, b) => a.date.localeCompare(b.date)) });
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const updated = mapEvent(payload.new);
      const existing = store.events.find((e) => e.id === updated.id);
      useTeamStore.setState({
        events: store.events.map((e) => e.id === updated.id
          ? { ...updated, confirmedPlayers: existing?.confirmedPlayers || [], declinedPlayers: existing?.declinedPlayers || [], invitedPlayers: existing?.invitedPlayers || [], declinedNotes: existing?.declinedNotes }
          : e),
      });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, (payload) => {
      const store = useTeamStore.getState();
      useTeamStore.setState({ events: store.events.filter((e) => e.id !== payload.old.id) });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_responses' }, (payload) => {
      const store = useTeamStore.getState();
      const row = (payload.new || payload.old) as any;
      if (!row?.event_id) return;
      const events = store.events.map((event) => {
        if (event.id !== row.event_id) return event;
        let confirmed = [...(event.confirmedPlayers || [])].filter((id) => id !== row.player_id);
        let declined = [...(event.declinedPlayers || [])].filter((id) => id !== row.player_id);
        let invited = [...(event.invitedPlayers || [])].filter((id) => id !== row.player_id);
        const notes = { ...(event.declinedNotes || {}) };
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
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const m = payload.new as any;
      if (store.chatMessages.some((msg) => msg.id === m.id)) return;
      const msg: ChatMessage = {
        id: m.id, senderId: m.sender_id, senderName: m.sender_name || undefined,
        message: m.message || '', imageUrl: m.image_url || undefined, gifUrl: m.gif_url || undefined,
        gifWidth: m.gif_width || undefined, gifHeight: m.gif_height || undefined,
        mentionedPlayerIds: m.mentioned_player_ids || [], mentionType: m.mention_type || undefined,
        createdAt: m.created_at,
      };
      useTeamStore.setState({ chatMessages: [...store.chatMessages, msg] });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
      const store = useTeamStore.getState();
      useTeamStore.setState({ chatMessages: store.chatMessages.filter((m) => m.id !== payload.old.id) });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_periods', filter: `team_id=eq.${teamId}` }, async () => {
      await refetchPayments(teamId);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'player_payments' }, async () => {
      await refetchPayments(teamId);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_entries' }, async () => {
      await refetchPayments(teamId);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useTeamStore.getState();
      const p = payload.new as any;
      if (store.photos.some((ph) => ph.id === p.id)) return;
      useTeamStore.setState({ photos: [{ id: p.id, gameId: p.game_id || '', uri: p.uri, uploadedBy: p.uploaded_by || '', uploadedAt: p.uploaded_at }, ...store.photos] });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'photos' }, (payload) => {
      const store = useTeamStore.getState();
      useTeamStore.setState({ photos: store.photos.filter((p) => p.id !== payload.old.id) });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      const store = useTeamStore.getState();
      const n = payload.new as any;
      if (n.to_player_id !== store.currentPlayerId) return;
      if (store.notifications.some((notif) => notif.id === n.id)) return;
      const notif: AppNotification = {
        id: n.id, type: n.type, title: n.title, message: n.message,
        gameId: n.game_id || undefined, eventId: n.event_id || undefined,
        fromPlayerId: n.from_player_id || undefined, toPlayerId: n.to_player_id,
        createdAt: n.created_at, read: n.read || false,
      };
      useTeamStore.setState({ notifications: [notif, ...store.notifications] });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `team_id=eq.${teamId}` }, async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from('polls').select('*').eq('team_id', teamId).order('created_at', { ascending: false });
      const polls: Poll[] = (data || []).map((p: any) => ({
        id: p.id, question: p.question, options: p.options || [], createdBy: p.created_by,
        createdAt: p.created_at, expiresAt: p.expires_at || undefined, isActive: p.is_active ?? true,
        allowMultipleVotes: p.allow_multiple_votes || false,
        groupId: p.group_id || undefined, groupName: p.group_name || undefined, isRequired: p.is_required || false,
      }));
      useTeamStore.setState({ polls });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_links', filter: `team_id=eq.${teamId}` }, async () => {
      const supabase = getSupabaseClient();
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
    activeChannel.unsubscribe();
    activeChannel = null;
    activeSyncTeamId = null;
  }
}

// ─── Payment refetch ──────────────────────────────────────────────────────────

async function refetchPayments(teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
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
      id: pp.id, title: pp.title, amount: parseFloat(pp.amount) || 0, type: pp.type || 'misc',
      dueDate: pp.due_date || undefined, createdAt: pp.created_at,
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

// ─── Write helpers ────────────────────────────────────────────────────────────

export async function pushGameToSupabase(game: Game, teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('games').upsert({
      id: game.id, team_id: teamId, opponent: game.opponent, date: game.date, time: game.time,
      location: game.location, address: game.address || null, jersey_color: game.jerseyColor || null,
      notes: game.notes || null, show_beer_duty: game.showBeerDuty || false,
      beer_duty_player_id: game.beerDutyPlayerId || null,
      hockey_lineup: game.lineup || null, basketball_lineup: game.basketballLineup || null,
      baseball_lineup: game.baseballLineup || null, batting_order_lineup: game.battingOrderLineup || null,
      soccer_lineup: game.soccerLineup || null, soccer_diamond_lineup: game.soccerDiamondLineup || null,
      lacrosse_lineup: game.lacrosseLineup || null,
      invite_release_option: game.inviteReleaseOption || 'now',
      invite_release_date: game.inviteReleaseDate || null, invites_sent: game.invitesSent || false,
      final_score_us: game.finalScoreUs ?? null, final_score_them: game.finalScoreThem ?? null,
      game_result: game.gameResult || null, result_recorded: game.resultRecorded || false,
    }, { onConflict: 'id' });
    if (error) console.error('SYNC: pushGameToSupabase error:', error.message);
  } catch (err) { console.error('SYNC: pushGameToSupabase error:', err); }
}

export async function deleteGameFromSupabase(gameId: string): Promise<void> {
  try {
    await getSupabaseClient().from('games').delete().eq('id', gameId);
  } catch (err) { console.error('SYNC: deleteGameFromSupabase error:', err); }
}

export async function pushGameResponseToSupabase(gameId: string, playerId: string, response: 'in' | 'out' | 'invited', note?: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('game_responses').upsert(
      { game_id: gameId, player_id: playerId, response, note: note || null },
      { onConflict: 'game_id,player_id' }
    );
    const teamId = useTeamStore.getState().activeTeamId;
    if (teamId) {
      supabase.channel(`team-sync-v2:${teamId}`).send({
        type: 'broadcast', event: 'game_response',
        payload: { gameId, playerId, response, note: note || null },
      });
    }
  } catch (err) { console.error('SYNC: pushGameResponseToSupabase error:', err); }
}

export async function deleteGameResponseFromSupabase(gameId: string, playerId: string): Promise<void> {
  try {
    await getSupabaseClient().from('game_responses').delete().eq('game_id', gameId).eq('player_id', playerId);
  } catch (err) { console.error('SYNC: deleteGameResponseFromSupabase error:', err); }
}

export async function pushEventToSupabase(event: Event, teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('events').upsert({
      id: event.id, team_id: teamId, title: event.title, type: event.type || 'other',
      date: event.date, time: event.time, location: event.location, address: event.address || null,
      notes: event.notes || null, invite_release_option: event.inviteReleaseOption || 'now',
      invite_release_date: event.inviteReleaseDate || null, invites_sent: event.invitesSent || false,
    }, { onConflict: 'id' });
    if (error) console.error('SYNC: pushEventToSupabase error:', error.message);
  } catch (err) { console.error('SYNC: pushEventToSupabase error:', err); }
}

export async function deleteEventFromSupabase(eventId: string): Promise<void> {
  try {
    await getSupabaseClient().from('events').delete().eq('id', eventId);
  } catch (err) { console.error('SYNC: deleteEventFromSupabase error:', err); }
}

export async function pushEventResponseToSupabase(eventId: string, playerId: string, response: 'confirmed' | 'declined' | 'invited', note?: string): Promise<void> {
  try {
    await getSupabaseClient().from('event_responses').upsert(
      { event_id: eventId, player_id: playerId, response, note: note || null },
      { onConflict: 'event_id,player_id' }
    );
  } catch (err) { console.error('SYNC: pushEventResponseToSupabase error:', err); }
}

export async function pushChatMessageToSupabase(message: ChatMessage, teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('chat_messages').insert({
      id: message.id, team_id: teamId, sender_id: message.senderId,
      sender_name: message.senderName || null, message: message.message || null,
      image_url: message.imageUrl || null, gif_url: message.gifUrl || null,
      gif_width: message.gifWidth || null, gif_height: message.gifHeight || null,
      mentioned_player_ids: message.mentionedPlayerIds || [], mention_type: message.mentionType || null,
      created_at: message.createdAt,
    });
    if (error) console.error('SYNC: pushChatMessageToSupabase error:', error.message);
  } catch (err) { console.error('SYNC: pushChatMessageToSupabase error:', err); }
}

export async function deleteChatMessageFromSupabase(messageId: string): Promise<void> {
  try {
    await getSupabaseClient().from('chat_messages').delete().eq('id', messageId);
  } catch (err) { console.error('SYNC: deleteChatMessageFromSupabase error:', err); }
}

export async function pushPlayerToSupabase(player: Player, teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('players').upsert({
      id: player.id, team_id: teamId, first_name: player.firstName, last_name: player.lastName,
      email: player.email || null, phone: player.phone || null, jersey_number: player.number || '',
      position: player.position || 'C', positions: player.positions || [], avatar: player.avatar || null,
      roles: player.roles || [], status: player.status || 'active',
      is_injured: player.isInjured || false, is_suspended: player.isSuspended || false,
      status_end_date: player.statusEndDate || null, unavailable_dates: player.unavailableDates || [],
      stats: player.stats || {}, goalie_stats: player.goalieStats || {}, pitcher_stats: player.pitcherStats || {},
      game_logs: player.gameLogs || [],
    }, { onConflict: 'id' });
    if (error) console.error('SYNC: pushPlayerToSupabase error:', error.message);
  } catch (err) { console.error('SYNC: pushPlayerToSupabase error:', err); }
}

export async function deletePlayerFromSupabase(playerId: string): Promise<void> {
  try {
    await getSupabaseClient().from('players').delete().eq('id', playerId);
  } catch (err) { console.error('SYNC: deletePlayerFromSupabase error:', err); }
}

export async function pushPaymentPeriodToSupabase(period: PaymentPeriod, teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('payment_periods').upsert({
      id: period.id, team_id: teamId, title: period.title, amount: period.amount,
      type: period.type || 'misc', due_date: period.dueDate || null,
    }, { onConflict: 'id' });
    if (error) { console.error('SYNC: pushPaymentPeriodToSupabase error:', error.message); return; }
    for (const pp of period.playerPayments || []) {
      const ppId = `pp-${period.id}-${pp.playerId}`;
      const { data: existing } = await supabase.from('player_payments').select('id').eq('payment_period_id', period.id).eq('player_id', pp.playerId).maybeSingle();
      const actualId = existing?.id || ppId;
      await supabase.from('player_payments').upsert({
        id: actualId, payment_period_id: period.id, player_id: pp.playerId,
        status: pp.status || 'unpaid', amount: pp.amount || 0, notes: pp.notes || null, paid_at: pp.paidAt || null,
      }, { onConflict: 'payment_period_id,player_id' });
      for (const entry of pp.entries || []) {
        await supabase.from('payment_entries').upsert({
          id: entry.id, player_payment_id: actualId, amount: entry.amount, date: entry.date, note: entry.note || null,
        }, { onConflict: 'id' });
      }
    }
  } catch (err) { console.error('SYNC: pushPaymentPeriodToSupabase error:', err); }
}

export async function deletePaymentPeriodFromSupabase(periodId: string): Promise<void> {
  try {
    await getSupabaseClient().from('payment_periods').delete().eq('id', periodId);
  } catch (err) { console.error('SYNC: deletePaymentPeriodFromSupabase error:', err); }
}

export async function pushTeamSettingsToSupabase(teamId: string, teamName: string, settings: import('./types').TeamSettings): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('teams').upsert({
      id: teamId, name: teamName, sport: settings.sport, team_logo: settings.teamLogo || null,
      wins: settings.record?.wins || 0, losses: settings.record?.losses || 0,
      ties: settings.record?.ties || 0, ot_losses: settings.record?.otLosses || 0,
      show_team_stats: settings.showTeamStats ?? true, show_payments: settings.showPayments ?? true,
      show_team_chat: settings.showTeamChat ?? true, show_photos: settings.showPhotos ?? true,
      show_refreshment_duty: settings.showRefreshmentDuty ?? true,
      refreshment_duty_is_21_plus: settings.refreshmentDutyIs21Plus ?? true,
      show_lineups: settings.showLineups ?? true, allow_player_self_stats: settings.allowPlayerSelfStats ?? false,
      show_records: settings.showTeamRecords ?? true,
      enabled_roles: settings.enabledRoles || ['player', 'reserve', 'coach', 'parent'],
      is_softball: settings.isSoftball ?? false, jersey_colors: settings.jerseyColors,
      payment_methods: settings.paymentMethods, current_season_name: settings.currentSeasonName || null,
      season_history: settings.seasonHistory || [], championships: settings.championships || [],
    }, { onConflict: 'id' });
  } catch (err) { console.error('SYNC: pushTeamSettingsToSupabase error:', err); }
}

export async function deletePhotoFromSupabase(photoId: string): Promise<void> {
  try {
    await getSupabaseClient().from('photos').delete().eq('id', photoId);
  } catch (err) { console.error('SYNC: deletePhotoFromSupabase error:', err); }
}

export async function uploadAndSavePhoto(file: File, teamId: string, uploadedBy: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${teamId}/${photoId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('team-photos')
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('SYNC: Photo upload error:', uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from('team-photos').getPublicUrl(path);
    const uri = urlData.publicUrl;

    const { error: dbError } = await supabase.from('photos').insert({
      id: photoId, team_id: teamId, uri, uploaded_by: uploadedBy,
      uploaded_at: new Date().toISOString(), game_id: null,
    });

    if (dbError) {
      console.error('SYNC: Photo DB insert error:', dbError.message);
      return null;
    }

    return uri;
  } catch (err) {
    console.error('SYNC: uploadAndSavePhoto error:', err);
    return null;
  }
}

// ─── Polls ─────────────────────────────────────────────────────────────────────

export async function pushPollToSupabase(poll: import('@/lib/types').Poll, teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('polls').upsert({
      id: poll.id,
      team_id: teamId,
      question: poll.question,
      options: poll.options,
      created_by: poll.createdBy,
      created_at: poll.createdAt,
      expires_at: poll.expiresAt ?? null,
      is_active: poll.isActive,
      allow_multiple_votes: poll.allowMultipleVotes,
      group_id: poll.groupId ?? null,
      group_name: poll.groupName ?? null,
      is_required: poll.isRequired ?? false,
    });
    if (error) console.error('SYNC: Poll upsert error:', error.message);
  } catch (err) {
    console.error('SYNC: pushPollToSupabase error:', err);
  }
}

export async function deletePollFromSupabase(pollId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) console.error('SYNC: Poll delete error:', error.message);
  } catch (err) {
    console.error('SYNC: deletePollFromSupabase error:', err);
  }
}

// ─── Team Links ─────────────────────────────────────────────────────────────────

export async function pushTeamLinkToSupabase(link: import('@/lib/types').TeamLink, teamId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('team_links').upsert({
      id: link.id,
      team_id: teamId,
      title: link.title,
      url: link.url,
      created_by: link.createdBy,
      created_at: link.createdAt,
    });
    if (error) console.error('SYNC: TeamLink upsert error:', error.message);
  } catch (err) {
    console.error('SYNC: pushTeamLinkToSupabase error:', err);
  }
}

export async function deleteTeamLinkFromSupabase(linkId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('team_links').delete().eq('id', linkId);
    if (error) console.error('SYNC: TeamLink delete error:', error.message);
  } catch (err) {
    console.error('SYNC: deleteTeamLinkFromSupabase error:', err);
  }
}
