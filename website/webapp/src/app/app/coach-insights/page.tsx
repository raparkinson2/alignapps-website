'use client';

import React, { useMemo } from 'react';
import {
  Crown, TrendingUp, Star, Ghost, ChevronRight,
  Shield, Zap, Users, Calendar, BarChart3,
} from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import { getPlayerName } from '@/lib/types';
import type { Player } from '@/lib/types';
import { useRouter } from 'next/navigation';

// ─── Engagement Bar ────────────────────────────────────────────────────────────

function EngagementBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07]">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

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
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const { isAdmin } = usePermissions();

  const isPremium = teamSettings.isPremium ?? false;

  // ── Compute Engagement Scores ──────────────────────────────────────────────
  const engagementData = useMemo(() => {
    const activePlayers = players.filter(
      (p) =>
        p.status === 'active' &&
        !p.roles?.includes('coach') &&
        !p.roles?.includes('parent') &&
        p.position !== 'Coach' &&
        p.position !== 'Parent'
    );

    return activePlayers
      .map((player) => {
        // Attendance: games played (from gameLogs) ÷ games invited (completed games)
        const invited = games.filter((g) => g.invitedPlayers.includes(player.id) && g.gameResult);
        const invitedIds = new Set(invited.map((g) => g.id));
        const gamesPlayed = (player.gameLogs ?? []).filter(
          (log) => !log.gameId || invitedIds.has(log.gameId)
        ).length;
        const attendanceScore = invited.length > 0 ? (gamesPlayed / invited.length) * 40 : 0;

        // Payment score (0–30)
        let paymentScore = 30;
        if (paymentPeriods.length > 0) {
          const playerPeriods = paymentPeriods.filter((period) =>
            period.playerPayments.some((pp) => pp.playerId === player.id)
          );
          if (playerPeriods.length > 0) {
            const paid = playerPeriods.filter((period) => {
              const pp = period.playerPayments.find((p) => p.playerId === player.id);
              return pp?.status === 'paid' || pp?.status === 'partial';
            });
            paymentScore = (paid.length / playerPeriods.length) * 30;
          }
        }

        // RSVP score (0–30)
        const allInvited = games.filter((g) => g.invitedPlayers.includes(player.id));
        const checkedIn = allInvited.filter((g) => g.checkedInPlayers.includes(player.id));
        const rsvpScore =
          allInvited.length > 0 ? Math.min(30, (checkedIn.length / allInvited.length) * 20 + 10) : 0;

        const total = attendanceScore + paymentScore + rsvpScore;

        return {
          player,
          attendanceScore,
          paymentScore,
          rsvpScore,
          total,
          gamesInvited: invited.length,
          gamesAttended: gamesPlayed,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [games, players, paymentPeriods]);

  // ── Compute Flake Factor ──────────────────────────────────────────────────
  const flakeData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const pastGames = games.filter((g) => g.date.split('T')[0] <= todayStr);
    const activePlayers = players.filter(
      (p) =>
        p.status === 'active' &&
        !p.roles?.includes('coach') &&
        !p.roles?.includes('parent')
    );

    return activePlayers
      .map((player) => {
        const gamesDayBails = pastGames.filter((g) =>
          (g.checkedOutPlayers ?? []).includes(player.id)
        );
        const checkedIn = pastGames.filter(
          (g) =>
            (g.checkedInPlayers ?? []).includes(player.id) ||
            (g.checkedOutPlayers ?? []).includes(player.id)
        );
        return {
          player,
          flakeCount: gamesDayBails.length,
          totalGames: checkedIn.length,
          flakeRate:
            checkedIn.length > 0
              ? Math.round((gamesDayBails.length / checkedIn.length) * 100)
              : 0,
        };
      })
      .filter((d) => d.totalGames > 0 && d.flakeCount > 0)
      .sort((a, b) => b.flakeRate - a.flakeRate)
      .slice(0, 5);
  }, [games, players]);

  const topEngaged = engagementData[0] ?? null;
  const topFlaker = flakeData[0] ?? null;
  const hasEngagementData = engagementData.length > 0;
  const hasFlakeData = flakeData.length > 0;
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
            Upgrade to Premium to unlock the full analytics suite, including engagement scores, flake tracking, and deep-dive insights.
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

      {/* ── Summary Tiles ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Engagement leader */}
        <div className="bg-[#a78bfa]/10 border border-[#a78bfa]/25 rounded-2xl p-4">
          <Star size={18} className="text-[#a78bfa] mb-2" />
          <p className="text-slate-100 font-bold text-sm truncate">
            {topEngaged ? getPlayerName(topEngaged.player) : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {topEngaged ? `${Math.round(topEngaged.total)}/100 score` : 'No data yet'}
          </p>
        </div>

        {/* Flake alert */}
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
          <Ghost size={18} className="text-rose-400 mb-2" />
          <p className="text-slate-100 font-bold text-sm truncate">
            {topFlaker ? getPlayerName(topFlaker.player) : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {topFlaker ? `${topFlaker.flakeRate}% game-day bail rate` : 'All reliable!'}
          </p>
        </div>
      </div>

      {/* ── Engagement Leaderboard ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#a78bfa]/20 flex items-center justify-center">
            <TrendingUp size={13} className="text-[#a78bfa]" />
          </div>
          <h2 className="text-slate-100 font-bold text-base">Engagement Leaderboard</h2>
        </div>
        <p className="text-slate-500 text-xs mb-3 leading-relaxed">
          Each player is scored out of 100 based on how often they show up, whether they&apos;ve paid dues, and how consistently they RSVP.
        </p>

        {/* Scoring breakdown */}
        <div className="bg-white/[0.03] rounded-xl px-4 py-3 mb-3 flex gap-4">
          {[
            { label: 'Attendance', pts: '40 pts', color: '#22c55e' },
            { label: 'Payments', pts: '30 pts', color: '#f59e0b' },
            { label: 'RSVP Rate', pts: '30 pts', color: '#38bdf8' },
          ].map((item) => (
            <div key={item.label} className="flex-1 text-center">
              <p className="text-xs font-bold" style={{ color: item.color }}>{item.pts}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl overflow-hidden">
          {!hasEngagementData ? (
            <div className="py-8 text-center">
              <Users size={28} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-semibold">No players yet</p>
              <p className="text-slate-500 text-xs mt-1">Add players and log game results to see engagement scores</p>
            </div>
          ) : (
            engagementData.map((item, index) => (
              <div
                key={item.player.id}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] last:border-0"
              >
                {/* Rank */}
                <div className="w-6 text-center shrink-0">
                  {index === 0 ? <span className="text-sm">🥇</span>
                    : index === 1 ? <span className="text-sm">🥈</span>
                    : index === 2 ? <span className="text-sm">🥉</span>
                    : <span className="text-slate-500 text-xs font-bold">{index + 1}</span>}
                </div>

                <Avatar player={item.player} size="sm" />

                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 font-semibold text-sm truncate">{getPlayerName(item.player)}</p>
                  <div className="mt-1.5">
                    <EngagementBar
                      value={item.total}
                      color={
                        item.total >= 80 ? '#22c55e' :
                        item.total >= 55 ? '#f59e0b' :
                        '#ef4444'
                      }
                    />
                  </div>
                </div>

                <div className="w-12 text-right shrink-0">
                  <p
                    className="font-extrabold text-sm"
                    style={{
                      color: item.total >= 80 ? '#22c55e' : item.total >= 55 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {Math.round(item.total)}
                  </p>
                  <p className="text-slate-600 text-[10px]">/100</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Flake Factor ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-rose-500/20 flex items-center justify-center">
            <Ghost size={13} className="text-rose-400" />
          </div>
          <h2 className="text-slate-100 font-bold text-base">The Flake Factor</h2>
        </div>

        <div className="bg-rose-500/[0.07] border border-rose-500/20 rounded-2xl overflow-hidden">
          {!hasFlakeData ? (
            <div className="py-8 text-center">
              <Ghost size={28} className="text-slate-600 mx-auto mb-3" />
              <p className={cn('text-sm font-semibold', hasGameData ? 'text-emerald-400' : 'text-slate-400')}>
                {hasGameData ? 'No game-day checkouts' : 'Log games to track'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {hasGameData
                  ? 'Everyone who checked in followed through.'
                  : 'Flake tracking builds as players check in to games.'}
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 pb-1">
                <p className="text-slate-400 text-xs">Players who checked IN but then checked OUT on game day</p>
              </div>
              {flakeData.map((item, index) => (
                <div
                  key={item.player.id}
                  className="flex items-center gap-3 px-4 py-3 border-t border-rose-500/10"
                >
                  <Avatar player={item.player} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-100 font-semibold text-sm">{getPlayerName(item.player)}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Checked out {item.flakeCount} time{item.flakeCount !== 1 ? 's' : ''} after checking in ({item.totalGames} check-in{item.totalGames !== 1 ? 's' : ''} total)
                    </p>
                  </div>
                  <div
                    className={cn(
                      'px-2.5 py-1 rounded-lg shrink-0',
                      item.flakeRate >= 40 ? 'bg-rose-500/25' : 'bg-amber-500/20'
                    )}
                  >
                    <p
                      className={cn('text-xs font-bold', item.flakeRate >= 40 ? 'text-rose-400' : 'text-amber-400')}
                    >
                      {item.flakeRate}%
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
            title="Opponent Scouting"
            description="H2H records, avg scores & coach notes by opponent"
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
            title="Monthly Splits"
            description="Team record and scoring broken down by month"
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
