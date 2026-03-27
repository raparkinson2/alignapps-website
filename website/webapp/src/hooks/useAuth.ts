'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useTeamStore } from '@/lib/store';
import { loadTeamFromSupabase } from '@/lib/realtime-sync';

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const isLoggedIn = useTeamStore((s) => s.isLoggedIn);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const players = useTeamStore((s) => s.players);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

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

          // Try to find the player record by auth_user_id first, then by email
          let playerRows: Array<{ id: string; team_id: string }> | null = null;

          const { data: byUserId } = await supabase
            .from('players')
            .select('id, team_id')
            .eq('auth_user_id', userId)
            .limit(1);

          if (byUserId && byUserId.length > 0) {
            playerRows = byUserId;
          } else if (email) {
            const { data: byEmail } = await supabase
              .from('players')
              .select('id, team_id')
              .eq('email', email)
              .limit(1);
            playerRows = byEmail ?? null;
          }

          if (playerRows && playerRows.length > 0) {
            const player = playerRows[0];
            const ok = await loadTeamFromSupabase(player.team_id);
            if (ok) {
              store.setCurrentPlayerId(player.id);
              store.setActiveTeamId(player.team_id);
              if (email) store.setUserEmail(email);
              store.setIsLoggedIn(true);
            } else {
              // Couldn't load team — sign out and go to login
              await supabase.auth.signOut();
              store.logout();
            }
          } else if (activeTeamId) {
            // Fallback: already had an activeTeamId stored, just reload
            await loadTeamFromSupabase(activeTeamId);
          } else {
            // No player record found for this Apple account
            await supabase.auth.signOut();
            store.logout();
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

  return { loading, isLoggedIn, currentPlayer, currentPlayerId };
}
