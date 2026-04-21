'use client';

import React, { useMemo } from 'react';
import {
  Crown, Ghost, ChevronRight,
  Shield, Zap, Users, Calendar, BarChart3,
} from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import { getPlayerName } from '@/lib/types';
import { useRouter } from 'next/navigation';

// ─── Deep Dive Card ───────────────────────────────────────────────────────────

function DeepDiveCard({
  icon,
  title,
  description,
  color,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  href?: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => href && router.push(href)}
      className="w-full flex items-center gap-4 rounded-2xl px-4 py-4 border transition-all hover:opacity-90 text-left"
      style={{
        background: `${color}18`,
        borderColor: `${color}30`,
      }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}25` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-100 font-bold text-sm">{title}</p>
        <p className="text-slate-400 text-xs mt-0.5">{description}</p>
      </div>
      <ChevronRight size={16} className="text-slate-500 shrink-0" />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachInsightsPage() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  const isPremium = teamSettings.isPremium ?? false;

  // ── Compute Reliability Factor ────────────────────────────────────────────
  // Tracks players who were checked-in OR pending for a game, then backed out
  // close to game time (within the final 24h window). Practices and events are
  // stored separately, so only games are considered.
  const reliabilityData = useMemo(() => {
    const now = Date.now();
    const pastGames = games.filter((g) => {
      if (g.isCancelled) return false;
      const gameTime = new Date(g.date).getTime();
      return gameTime <= now + 24 * 60 * 60 * 1000 && gameTime <= now;
    });
    const activePlayers = players.filter(
      (p) =>
        p.status === 'active' &&
        !p.roles?.includes('coach') &&
        !p.roles?.includes('parent')
    );

    return activePlayers
      .map((player) => {
        const invited = pastGames.filter((g) => (g.invitedPlayers ?? []).includes(player.id));
        // Bailed: ended up in checkedOutPlayers (covers checked-in → out AND pending → out)
        const bailed = invited.filter((g) => (g.checkedOutPlayers ?? []).includes(player.id));
        return {
          player,
          bailCount: bailed.length,
          totalGames: invited.length,
          bailRate:
            invited.length > 0 ? Math.round((bailed.length / invited.length) * 100) : 0,
        };
      })
      .filter((d) => d.totalGames > 0 && d.bailCount > 0)
      .sort((a, b) => b.bailRate - a.bailRate)
      .slice(0, 5);
  }, [games, players]);

  const topBailer = reliabilityData[0] ?? null;
  const hasReliabilityData = reliabilityData.length > 0;
  const completedGames = games.filter((g) => g.gameResult);
  const hasGameData = completedGames.length > 0;

  // Premium gate
  if (!isPremium) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-5 px-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
          <Crown size={32} className="text-amber-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-100">Premium Only</h2>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Upgrade to Premium to unlock the full analytics suite, including reliability tracking and deep-dive insights.
          </p>
        </div>
        <button
          onClick={() => router.push('/app/more')}
          className="px-6 py-3 rounded-2xl bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition-all"
        >
          Upgrade Now
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Crown size={18} className="text-amber-400" />
        </div>
        <div>
          <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">Premium</p>
          <h1 className="text-xl font-bold text-slate-100 leading-tight">Coach Insights</h1>
        </div>
      </div>

      {/* ── Summary Tile ── */}
      <div className="mb-5">
        {/* Reliability alert */}
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
          <Ghost size={18} className="text-rose-400 mb-2" />
          <p className="text-slate-100 font-bold text-sm truncate">
            {topBailer ? getPlayerName(topBailer.player) : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {topBailer ? `${topBailer.bailRate}% last-minute checkout rate` : 'All reliable!'}
          </p>
        </div>
      </div>

      {/* ── Reliability Factor ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-rose-500/20 flex items-center justify-center">
            <Ghost size={13} className="text-rose-400" />
          </div>
          <h2 className="text-slate-100 font-bold text-base">The Reliability Factor</h2>
        </div>

        <div className="bg-rose-500/[0.07] border border-rose-500/20 rounded-2xl overflow-hidden">
          {!hasReliabilityData ? (
            <div className="py-8 text-center">
              <Ghost size={28} className="text-slate-600 mx-auto mb-3" />
              <p className={cn('text-sm font-semibold', hasGameData ? 'text-emerald-400' : 'text-slate-400')}>
                {hasGameData ? 'No last-minute checkouts' : 'Log games to track'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {hasGameData
                  ? 'Everyone invited followed through on game day.'
                  : 'Reliability tracking builds as players RSVP to games.'}
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 pb-1">
                <p className="text-slate-400 text-xs">Checked-in or pending players who backed out within 24 hours of a game</p>
              </div>
              {reliabilityData.map((item) => (
                <div
                  key={item.player.id}
                  className="flex items-center gap-3 px-4 py-3 border-t border-rose-500/10"
                >
                  <Avatar player={item.player} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-100 font-semibold text-sm">{getPlayerName(item.player)}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Backed out of {item.bailCount} game{item.bailCount !== 1 ? 's' : ''} ({item.totalGames} invite{item.totalGames !== 1 ? 's' : ''} total)
                    </p>
                  </div>
                  <div
                    className={cn(
                      'px-2.5 py-1 rounded-lg shrink-0',
                      item.bailRate >= 40 ? 'bg-rose-500/25' : 'bg-amber-500/20'
                    )}
                  >
                    <p
                      className={cn('text-xs font-bold', item.bailRate >= 40 ? 'text-rose-400' : 'text-amber-400')}
                    >
                      {item.bailRate}%
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Deep Dives ── */}
      <div className="mb-5">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">Deep Dives</p>
        <div className="space-y-2.5">
          <DeepDiveCard
            icon={<Shield size={22} color="#c084fc" />}
            title="Head to Head Analytics"
            description="H2H records, opponent strength & coach notes"
            color="#a855f7"
          />
          <DeepDiveCard
            icon={<Zap size={22} color="#2dd4bf" />}
            title="Game Momentum"
            description="RSVP trends, weather impact & win patterns"
            color="#14b8a6"
          />
          <DeepDiveCard
            icon={<Users size={22} color="#34d399" />}
            title="Player Impact"
            description="Team record with vs without each player"
            color="#10b981"
          />
          <DeepDiveCard
            icon={<Calendar size={22} color="#22d3ee" />}
            title="Season Arc"
            description="Win-rate trend & what changed month to month"
            color="#06b6d4"
          />
          <DeepDiveCard
            icon={<BarChart3 size={22} color="#f59e0b" />}
            title="Payment Analytics"
            description="Collection rates, avg days to pay & player reliability"
            color="#f59e0b"
          />
        </div>
      </div>
    </div>
  );
}
