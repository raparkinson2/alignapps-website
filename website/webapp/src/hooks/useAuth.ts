'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useTeamStore } from '@/lib/store';
import { loadTeamFromSupabase } from '@/lib/realtime-sync';

export interface TeamOption {
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
}

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [pendingTeamOptions, setPendingTeamOptions] = useState<TeamOption[]>([]);
  const isLoggedIn = useTeamStore((s) => s.isLoggedIn);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const players = useTeamStore((s) => s.players);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const selectTeam = async (option: TeamOption) => {
    const store = useTeamStore.getState();
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const ok = await loadTeamFromSupabase(option.teamId);
    if (ok) {
      store.setCurrentPlayerId(option.playerId);
      store.setActiveTeamId(option.teamId);
      if (session?.user?.email) store.setUserEmail(session.user.email.toLowerCase());
      store.setIsLoggedIn(true);
      setPendingTeamOptions([]);
    }
  };

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        if (!isLoggedIn) {
          // We have a Supabase session but the store isn't initialized.
          // This happens after OAuth (e.g. Sign in with Apple) — bootstrap from the session.
          const store = useTeamStore.getState();
          const email = session.user.email?.toLowerCase();
          const userId = session.user.id;

          // Fetch ALL player records for this user (supports multi-team)
          let playerRows: Array<{ id: string; team_id: string; first_name: string; last_name: string }> | null = null;

          const { data: byUserId } = await supabase
            .from('players')
            .select('id, team_id, first_name, last_name')
            .eq('auth_user_id', userId);

          if (byUserId && byUserId.length > 0) {
            playerRows = byUserId;
          } else if (email) {
            const { data: byEmail } = await supabase
              .from('players')
              .select('id, team_id, first_name, last_name')
              .eq('email', email);
            playerRows = byEmail ?? null;
          }

          if (playerRows && playerRows.length === 1) {
            // Single team — log straight in
            const player = playerRows[0];
            const ok = await loadTeamFromSupabase(player.team_id);
            if (ok) {
              store.setCurrentPlayerId(player.id);
              store.setActiveTeamId(player.team_id);
              if (email) store.setUserEmail(email);
              store.setIsLoggedIn(true);
            } else {
              await supabase.auth.signOut();
              store.logout();
            }
          } else if (playerRows && playerRows.length > 1) {
            // Multiple teams — show team selector
            const teamIds = playerRows.map((p) => p.team_id);
            const { data: teamsData } = await supabase
              .from('teams')
              .select('id, name')
              .in('id', teamIds);
            const teamNameMap: Record<string, string> = {};
            for (const t of teamsData ?? []) teamNameMap[t.id] = t.name;

            const options: TeamOption[] = playerRows.map((p) => ({
              teamId: p.team_id,
              teamName: teamNameMap[p.team_id] ?? 'Unknown Team',
              playerId: p.id,
              playerName: `${p.first_name} ${p.last_name}`.trim(),
            }));
            setPendingTeamOptions(options);
          } else if (activeTeamId) {
            // Fallback: already had an activeTeamId stored, just reload
            await loadTeamFromSupabase(activeTeamId);
          } else {
            // No player record found — break the loop by redirecting to no-account
            await supabase.auth.signOut();
            store.logout();
            window.location.href = '/no-account';
            return;
          }
        }
      } else {
        // No session — force logout state
        if (isLoggedIn) {
          useTeamStore.getState().logout();
        }
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        useTeamStore.getState().logout();
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPlayer = players.find((p) => p.id === currentPlayerId) ?? null;

  return { loading, isLoggedIn, currentPlayer, currentPlayerId, pendingTeamOptions, selectTeam };
}
