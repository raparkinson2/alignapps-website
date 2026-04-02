'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Shield, Users, Star, AlertTriangle, Ban,
  Trophy, Flame, Zap, Target, Calendar, Award, ChevronLeft,
} from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { getPlayerName, getPrimaryPosition } from '@/lib/types';
import type { Player, Sport, ArchivedSeason } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import AddEditPlayerModal from '@/components/admin/AddEditPlayerModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStat(stats: Record<string, number> | undefined | null, key: string): number {
  if (!stats) return 0;
  return stats[key] ?? 0;
}

function getPoints(player: Player, sport: Sport): number {
  const s = player.stats as Record<string, number> | undefined;
  switch (sport) {
    case 'hockey':
    case 'soccer':
    case 'lacrosse':
      return getStat(s, 'goals') + getStat(s, 'assists');
    case 'basketball':
      return getStat(s, 'points');
    case 'baseball':
    case 'softball':
      return getStat(s, 'hits');
    default:
      return 0;
  }
}

// ─── Trophy computation (mirrors mobile) ─────────────────────────────────────

interface TrophyItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
}

function computeTrophies(
  player: Player,
  allPlayers: Player[],
  seasonHistory: ArchivedSeason[],
  sport: Sport,
  games: { invitedPlayers: string[]; checkedInPlayers: string[]; gameResult?: string; id: string }[]
): TrophyItem[] {
  const trophies: TrophyItem[] = [];
  const eligible = allPlayers.filter(
    (p) =>
      p.position !== 'Coach' &&
      p.position !== 'Parent' &&
      !p.roles?.includes('coach') &&
      !p.roles?.includes('parent')
  );

  const statLeadership: { key: string; label: string }[] = [];
  if (sport === 'hockey') {
    statLeadership.push({ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' });
  } else if (sport === 'soccer') {
    statLeadership.push({ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' });
  } else if (sport === 'lacrosse') {
    statLeadership.push({ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' }, { key: 'groundBalls', label: 'Ground Balls' });
  } else if (sport === 'basketball') {
    statLeadership.push({ key: 'points', label: 'Points' }, { key: 'rebounds', label: 'Rebounds' }, { key: 'assists', label: 'Assists' });
  } else if (sport === 'baseball' || sport === 'softball') {
    statLeadership.push({ key: 'hits', label: 'Hits' }, { key: 'homeRuns', label: 'Home Runs' }, { key: 'rbi', label: 'RBI' });
  }

  for (const { key, label } of statLeadership) {
    const myVal = getStat(player.stats as Record<string, number> | undefined, key);
    if (myVal <= 0) continue;
    const max = Math.max(...eligible.map((p) => getStat(p.stats as Record<string, number> | undefined, key)));
    if (myVal === max) {
      trophies.push({
        id: `lead-${key}`,
        icon: <Target size={16} />,
        title: `Team ${label} Leader`,
        subtitle: `${myVal} ${label.toLowerCase()} this season`,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
      });
    }
  }

  if (sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse') {
    const myPts = getPoints(player, sport);
    if (myPts > 0) {
      const maxPts = Math.max(...eligible.map((p) => getPoints(p, sport)));
      if (myPts === maxPts) {
        trophies.push({
          id: 'lead-pts',
          icon: <Zap size={16} />,
          title: 'Team Points Leader',
          subtitle: `${myPts} pts this season`,
          color: '#f59e0b',
          bg: 'rgba(245,158,11,0.12)',
        });
      }
    }
  }

  // Attendance trophies
  const completedGames = games.filter((g) => g.gameResult);
  const invited = completedGames.filter((g) => g.invitedPlayers.includes(player.id));
  const invitedIds = new Set(invited.map((g) => g.id));
  const attended = (player.gameLogs ?? []).filter(
    (log) => !log.gameId || invitedIds.has(log.gameId)
  ).length;

  if (completedGames.length >= 5 && attended === completedGames.length) {
    trophies.push({
      id: 'iron-man',
      icon: <Flame size={16} />,
      title: 'Iron Man',
      subtitle: `Perfect attendance — ${completedGames.length} games`,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
    });
  } else if (completedGames.length >= 10 && attended / completedGames.length >= 0.9) {
    trophies.push({
      id: 'reliable',
      icon: <Shield size={16} />,
      title: 'Most Reliable',
      subtitle: `${attended}/${completedGames.length} games attended`,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.1)',
    });
  }

  // Hat tricks (hockey/soccer/lacrosse)
  if (sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse') {
    const hatTricks = (player.gameLogs ?? []).filter((l) => {
      const s = l.stats as Record<string, number> | undefined;
      return (s?.goals ?? 0) >= 3;
    }).length;
    if (hatTricks >= 1) {
      trophies.push({
        id: 'mad-hatter',
        icon: <span className="text-sm">🎩</span>,
        title: 'Mad Hatter',
        subtitle: `${hatTricks} hat trick${hatTricks !== 1 ? 's' : ''} this season`,
        color: '#818cf8',
        bg: 'rgba(129,140,248,0.1)',
      });
    }
  }

  // Win streak
  const sortedCompleted = [...completedGames].sort(
    (a, b) => new Date((a as unknown as { date: string }).date || 0).getTime() - new Date((b as unknown as { date: string }).date || 0).getTime()
  );
  let streak = 0, maxStreak = 0;
  for (const g of sortedCompleted) {
    if (g.gameResult === 'win' && g.checkedInPlayers.includes(player.id)) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  if (maxStreak >= 5) {
    trophies.push({
      id: 'hot-streak',
      icon: <Flame size={16} />,
      title: `${maxStreak}-Game Win Streak`,
      subtitle: 'Contributed to team winning streak',
      color: '#f97316',
      bg: 'rgba(249,115,22,0.1)',
    });
  }

  // Archived season leadership
  for (const season of seasonHistory) {
    const ps = season.playerStats.find((p) => p.playerId === player.id);
    if (!ps) continue;
    for (const { key, label } of statLeadership) {
      const myVal = getStat(ps.stats as Record<string, number> | undefined, key);
      if (myVal <= 0) continue;
      const max = Math.max(...season.playerStats.map((p) => getStat(p.stats as Record<string, number> | undefined, key)));
      if (myVal === max) {
        trophies.push({
          id: `arch-${season.id}-${key}`,
          icon: <Award size={16} />,
          title: `${season.seasonName} ${label} Leader`,
          subtitle: `Led team with ${myVal} ${label.toLowerCase()}`,
          color: '#a78bfa',
          bg: 'rgba(167,139,250,0.1)',
        });
      }
    }
  }

  return trophies;
}

// ─── Sport stats display ───────────────────────────────────────────────────────

function getStatsDisplay(player: Player, sport: Sport): { label: string; value: string | number }[] {
  const s = player.stats as Record<string, number> | undefined;
  const gs = player.goalieStats as Record<string, number> | undefined;
  const ps = player.pitcherStats as Record<string, number> | undefined;

  switch (sport) {
    case 'hockey': {
      const items = [
        { label: 'GP', value: getStat(s, 'gamesPlayed') },
        { label: 'G', value: getStat(s, 'goals') },
        { label: 'A', value: getStat(s, 'assists') },
        { label: 'PTS', value: getStat(s, 'goals') + getStat(s, 'assists') },
        { label: '+/-', value: getStat(s, 'plusMinus') },
        { label: 'PIM', value: getStat(s, 'pim') },
      ];
      if (gs && getStat(gs, 'games') > 0) {
        const shots = getStat(gs, 'shotsAgainst');
        const saves = getStat(gs, 'saves');
        const svPct = shots > 0 ? (saves / shots).toFixed(3) : '.000';
        return [
          { label: 'GP', value: getStat(gs, 'games') },
          { label: 'W', value: getStat(gs, 'wins') },
          { label: 'L', value: getStat(gs, 'losses') },
          { label: 'GA', value: getStat(gs, 'goalsAgainst') },
          { label: 'SV%', value: svPct },
          ...items.filter((i) => i.label !== 'GP' && getStat(s, 'goals') + getStat(s, 'assists') > 0 ? true : false),
        ];
      }
      return items;
    }
    case 'basketball':
      return [
        { label: 'GP', value: getStat(s, 'gamesPlayed') },
        { label: 'PTS', value: getStat(s, 'points') },
        { label: 'REB', value: getStat(s, 'rebounds') },
        { label: 'AST', value: getStat(s, 'assists') },
        { label: 'STL', value: getStat(s, 'steals') },
        { label: 'BLK', value: getStat(s, 'blocks') },
      ];
    case 'soccer': {
      const gks = gs && getStat(gs, 'games') > 0;
      if (gks) {
        const shots = getStat(gs!, 'shotsAgainst');
        const saves = getStat(gs!, 'saves');
        const svPct = shots > 0 ? (saves / shots).toFixed(3) : '.000';
        return [
          { label: 'GP', value: getStat(gs!, 'games') },
          { label: 'W', value: getStat(gs!, 'wins') },
          { label: 'GA', value: getStat(gs!, 'goalsAgainst') },
          { label: 'SV%', value: svPct },
        ];
      }
      return [
        { label: 'GP', value: getStat(s, 'gamesPlayed') },
        { label: 'G', value: getStat(s, 'goals') },
        { label: 'A', value: getStat(s, 'assists') },
        { label: 'YC', value: getStat(s, 'yellowCards') },
      ];
    }
    case 'lacrosse':
      return [
        { label: 'GP', value: getStat(s, 'gamesPlayed') },
        { label: 'G', value: getStat(s, 'goals') },
        { label: 'A', value: getStat(s, 'assists') },
        { label: 'GB', value: getStat(s, 'groundBalls') },
        { label: 'SOG', value: getStat(s, 'shotsOnGoal') },
      ];
    case 'baseball':
    case 'softball': {
      const ab = getStat(s, 'atBats');
      const hits = getStat(s, 'hits');
      const avg = ab > 0 ? (hits / ab).toFixed(3) : '.000';
      const pitcherItems = ps && getStat(ps, 'starts') > 0 ? [
        { label: 'GS', value: getStat(ps, 'starts') },
        { label: 'W', value: getStat(ps, 'wins') },
        { label: 'K', value: getStat(ps, 'strikeouts') },
      ] : [];
      return [
        { label: 'AVG', value: avg },
        { label: 'AB', value: ab },
        { label: 'H', value: hits },
        { label: 'RBI', value: getStat(s, 'rbi') },
        { label: 'HR', value: getStat(s, 'homeRuns') },
        ...pitcherItems,
      ];
    }
    default:
      return [];
  }
}

// ─── Milestone thresholds ──────────────────────────────────────────────────────

const MILESTONES = [10, 25, 50, 100, 150, 200, 250, 500];

function getNextMilestone(current: number): { target: number; prev: number } | null {
  for (const t of MILESTONES) {
    if (current < t) {
      const prevIdx = MILESTONES.indexOf(t) - 1;
      return { target: t, prev: prevIdx >= 0 ? MILESTONES[prevIdx] : 0 };
    }
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const { isAdmin } = usePermissions();

  const [editOpen, setEditOpen] = useState(false);

  const player = players.find((p) => p.id === id);
  const sport = teamSettings.sport;
  const seasonHistory = teamSettings.seasonHistory ?? [];

  const isOwnProfile = id === currentPlayerId;
  const canEdit = isAdmin || isOwnProfile;

  const { attended, invitedCount, attendancePct } = useMemo(() => {
    if (!player) return { attended: 0, invitedCount: 0, attendancePct: 0 };
    const completed = games.filter((g) => g.gameResult);
    const inv = completed.filter((g) => g.invitedPlayers.includes(player.id));
    const invIds = new Set(inv.map((g) => g.id));
    const att = (player.gameLogs ?? []).filter((log) => !log.gameId || invIds.has(log.gameId)).length;
    const pct = inv.length > 0 ? Math.round((att / inv.length) * 100) : 0;
    return { attended: att, invitedCount: inv.length, attendancePct: pct };
  }, [player, games]);

  const trophies = useMemo(() => {
    if (!player) return [];
    return computeTrophies(player, players, seasonHistory, sport, games as Parameters<typeof computeTrophies>[4]);
  }, [player, players, seasonHistory, sport, games]);

  const statsDisplay = useMemo(() => {
    if (!player) return [];
    return getStatsDisplay(player, sport);
  }, [player, sport]);

  // Milestones (for scoring stats)
  const milestones = useMemo(() => {
    if (!player) return [];
    const s = player.stats as Record<string, number> | undefined;
    const items: { label: string; current: number; target: number; prev: number; color: string }[] = [];
    const milestoneStats: { key: string; label: string; color: string }[] = [];
    if (sport === 'hockey') milestoneStats.push({ key: 'goals', label: 'Goals', color: '#67e8f9' }, { key: 'assists', label: 'Assists', color: '#a78bfa' });
    else if (sport === 'soccer' || sport === 'lacrosse') milestoneStats.push({ key: 'goals', label: 'Goals', color: '#67e8f9' });
    else if (sport === 'basketball') milestoneStats.push({ key: 'points', label: 'Points', color: '#f59e0b' });
    else if (sport === 'baseball' || sport === 'softball') milestoneStats.push({ key: 'hits', label: 'Hits', color: '#22c55e' });

    for (const { key, label, color } of milestoneStats) {
      const current = getStat(s, key);
      const next = getNextMilestone(current);
      if (next && current > 0) {
        items.push({ label, current, target: next.target, prev: next.prev, color });
      }
    }
    return items;
  }, [player, sport]);

  if (!player) {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-5">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-slate-400">Player not found</p>
        </div>
      </div>
    );
  }

  const primaryPos = getPrimaryPosition(player);
  const allPositions = (player.positions && player.positions.length > 0 ? player.positions : [player.position]).filter(Boolean).join(' / ');

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors mb-4 group"
      >
        <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-sm">Back</span>
      </button>

      {/* ── Hero Card ── */}
      <div className="relative bg-gradient-to-br from-[#0d1829] to-[#091220] border border-white/[0.08] rounded-3xl overflow-hidden mb-4">
        {/* Cyan top accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#67e8f9]/50 to-transparent" />

        {/* Large jersey number watermark */}
        {player.number && (
          <div
            className="absolute right-4 top-4 text-[90px] font-black leading-none select-none pointer-events-none"
            style={{ color: 'rgba(103,232,249,0.04)' }}
          >
            {player.number}
          </div>
        )}

        <div className="relative px-5 py-5">
          <div className="flex items-start gap-4">
            {/* Avatar with jersey badge */}
            <div className="relative shrink-0">
              <Avatar player={player} size="xl" />
              {player.number && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#67e8f9] flex items-center justify-center">
                  <span className="text-[#080c14] text-[10px] font-black">{player.number}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-black text-white leading-tight">{getPlayerName(player)}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {allPositions && (
                      <span className="text-[#67e8f9] text-sm font-semibold">{allPositions}</span>
                    )}
                    {allPositions && (
                      <span className="text-slate-600 text-sm">·</span>
                    )}
                    <span className="text-slate-400 text-sm truncate">{teamName}</span>
                  </div>
                </div>

                {/* Edit button */}
                {canEdit && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.1] transition-all shrink-0"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>

              {/* Role badges */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {player.roles.includes('admin') && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-[#67e8f9]/15 text-[#67e8f9] px-2 py-0.5 rounded-full border border-[#67e8f9]/20">
                    <Shield size={9} /> Admin
                  </span>
                )}
                {player.roles.includes('captain') && (
                  <span className="text-[10px] font-bold bg-[#67e8f9]/15 text-[#67e8f9] px-2 py-0.5 rounded-full border border-[#67e8f9]/20">C</span>
                )}
                {player.roles.includes('coach') && (
                  <span className="text-[10px] font-bold bg-[#a78bfa]/15 text-[#a78bfa] px-2 py-0.5 rounded-full border border-[#a78bfa]/20">Coach</span>
                )}
                {player.isInjured && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                    <AlertTriangle size={9} /> Injured
                  </span>
                )}
                {player.isSuspended && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20">
                    <Ban size={9} /> Suspended
                  </span>
                )}
                {player.status === 'reserve' && (
                  <span className="text-[10px] font-bold bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">Reserve</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Attendance Row ── */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/[0.05]">
            {[
              { label: 'Invited', value: invitedCount },
              { label: 'Attended', value: attended },
              {
                label: 'Attendance',
                value: `${attendancePct}%`,
                color: attendancePct >= 80 ? '#22c55e' : attendancePct >= 50 ? '#f59e0b' : '#ef4444',
              },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p
                  className="text-xl font-black"
                  style={{ color: (item as { color?: string }).color ?? 'white' }}
                >
                  {item.value}
                </p>
                <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {statsDisplay.length > 0 && (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">This Season</p>
          <div className="grid grid-cols-3 gap-3">
            {statsDisplay.map((stat) => (
              <div key={stat.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
                <p className="text-lg font-black text-slate-100 font-mono">{stat.value}</p>
                <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wide mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Milestones ── */}
      {milestones.length > 0 && (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Career Milestones</p>
          <div className="space-y-3">
            {milestones.map((m) => {
              const range = m.target - m.prev;
              const pct = range > 0 ? Math.min(100, ((m.current - m.prev) / range) * 100) : 100;
              const away = m.target - m.current;
              return (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-400">{m.label}</span>
                    <span className="text-xs font-bold" style={{ color: m.color }}>
                      {m.current} <span className="text-slate-600 font-normal">/ {m.target}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06]">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: m.color }}
                    />
                  </div>
                  <p className="text-slate-600 text-[10px] mt-1">{away} away from {m.target}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Trophy Cabinet ── */}
      {trophies.length > 0 && (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-amber-400" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Trophy Cabinet</p>
          </div>
          <div className="space-y-2">
            {trophies.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: t.bg, border: `1px solid ${t.color}30` }}
              >
                <div className="shrink-0" style={{ color: t.color }}>{t.icon}</div>
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: t.color }}>{t.title}</p>
                  <p className="text-slate-400 text-xs">{t.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trophies.length === 0 && statsDisplay.every((s) => Number(s.value) === 0 || s.value === '.000') && (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-6 text-center mb-4">
          <Trophy size={28} className="text-slate-700 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No stats or trophies yet.</p>
          <p className="text-slate-600 text-xs mt-1">Play games and log stats to fill this card!</p>
        </div>
      )}

      {/* Edit modal */}
      <AddEditPlayerModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        player={player}
      />
    </div>
  );
}
