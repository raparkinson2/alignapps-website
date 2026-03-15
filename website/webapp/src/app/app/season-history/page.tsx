'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Calendar, ChevronRight, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { formatRecord, SPORT_EMOJI, cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { Sport } from '@/lib/types';
import type { ArchivedSeason, ArchivedPlayerStats } from '@/lib/types';

// ─── Stat column definitions ───────────────────────────────────────────────────

interface StatColumn {
  key: string;
  label: string;
  getValue: (player: ArchivedPlayerStats) => string;
}

function getSkaterColumns(sport: Sport): StatColumn[] {
  switch (sport) {
    case 'hockey':
      return [
        { key: 'gp', label: 'GP', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.gamesPlayed ?? 0) },
        { key: 'g', label: 'G', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.goals ?? 0) },
        { key: 'a', label: 'A', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.assists ?? 0) },
        {
          key: 'pts', label: 'P', getValue: (p) => {
            const s = p.stats as Record<string, number> | undefined;
            return String((s?.goals ?? 0) + (s?.assists ?? 0));
          },
        },
        { key: 'pim', label: 'PIM', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.pim ?? 0) },
      ];
    case 'soccer':
      return [
        { key: 'gp', label: 'GP', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.gamesPlayed ?? 0) },
        { key: 'g', label: 'G', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.goals ?? 0) },
        { key: 'a', label: 'A', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.assists ?? 0) },
        { key: 'yc', label: 'YC', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.yellowCards ?? 0) },
      ];
    case 'basketball':
      return [
        { key: 'gp', label: 'GP', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.gamesPlayed ?? 0) },
        { key: 'pts', label: 'PTS', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.points ?? 0) },
        { key: 'reb', label: 'REB', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.rebounds ?? 0) },
        { key: 'ast', label: 'AST', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.assists ?? 0) },
      ];
    case 'baseball':
    case 'softball':
      return [
        { key: 'gp', label: 'GP', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.gamesPlayed ?? 0) },
        { key: 'ab', label: 'AB', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.atBats ?? 0) },
        { key: 'h', label: 'H', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.hits ?? 0) },
        { key: 'hr', label: 'HR', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.homeRuns ?? 0) },
        { key: 'rbi', label: 'RBI', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.rbi ?? 0) },
        {
          key: 'avg', label: 'AVG', getValue: (p) => {
            const s = p.stats as Record<string, number> | undefined;
            const ab = s?.atBats ?? 0;
            if (ab === 0) return '.000';
            return (((s?.hits ?? 0) / ab)).toFixed(3).replace(/^0/, '');
          },
        },
      ];
    case 'lacrosse':
      return [
        { key: 'gp', label: 'GP', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.gamesPlayed ?? 0) },
        { key: 'g', label: 'G', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.goals ?? 0) },
        { key: 'a', label: 'A', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.assists ?? 0) },
        { key: 'gb', label: 'GB', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.groundBalls ?? 0) },
      ];
    default:
      return [
        { key: 'gp', label: 'GP', getValue: (p) => String((p.stats as Record<string, number> | undefined)?.gamesPlayed ?? 0) },
      ];
  }
}

function getGoalieColumns(sport: Sport): StatColumn[] {
  switch (sport) {
    case 'hockey':
    case 'soccer':
    case 'lacrosse':
      return [
        { key: 'gp', label: 'GP', getValue: (p) => String((p.goalieStats as Record<string, number> | undefined)?.games ?? 0) },
        { key: 'w', label: 'W', getValue: (p) => String((p.goalieStats as Record<string, number> | undefined)?.wins ?? 0) },
        { key: 'l', label: 'L', getValue: (p) => String((p.goalieStats as Record<string, number> | undefined)?.losses ?? 0) },
        { key: 'mp', label: 'MP', getValue: (p) => String((p.goalieStats as Record<string, number> | undefined)?.minutesPlayed ?? 0) },
        {
          key: 'gaa', label: 'GAA', getValue: (p) => {
            const gs = p.goalieStats as Record<string, number> | undefined;
            if (!gs) return '0.00';
            const mp = gs.minutesPlayed ?? 0;
            const ga = gs.goalsAgainst ?? 0;
            if (mp === 0) return '0.00';
            const multiplier = sport === 'soccer' ? 90 : 60;
            return ((ga * multiplier) / mp).toFixed(2);
          },
        },
        {
          key: 'svpct', label: 'SV%', getValue: (p) => {
            const gs = p.goalieStats as Record<string, number> | undefined;
            if (!gs) return '0.0';
            const saves = gs.saves ?? 0;
            const ga = gs.goalsAgainst ?? 0;
            const total = saves + ga;
            if (total === 0) return '0.0';
            return ((saves / total) * 100).toFixed(1);
          },
        },
      ];
    default:
      return [];
  }
}

// ─── Goalie check ──────────────────────────────────────────────────────────────

function isGoalie(player: ArchivedPlayerStats): boolean {
  if (player.goalieStats) return true;
  const allPositions = player.positions && player.positions.length > 0 ? player.positions : [player.position];
  return allPositions.some((pos) => pos === 'G' || pos === 'GK');
}

function getDisplayPosition(player: ArchivedPlayerStats): string {
  if (player.positions && player.positions.length > 0) return player.positions.join('/');
  return player.position ?? '';
}

// ─── Win percentage ────────────────────────────────────────────────────────────

function computeWinPct(season: ArchivedSeason): string {
  const { wins, losses, ties = 0, otLosses = 0 } = season.teamRecord;
  const gp = wins + losses + ties + (season.sport === 'hockey' ? otLosses : 0);
  if (gp === 0) return '.000';
  return (wins / gp).toFixed(3).replace(/^0/, '');
}

function computeGP(season: ArchivedSeason): number {
  const { wins, losses, ties = 0, otLosses = 0 } = season.teamRecord;
  return wins + losses + ties + (season.sport === 'hockey' ? otLosses : 0);
}

// ─── Aggregated team stat totals ───────────────────────────────────────────────

interface TeamStatAggregate {
  label: string;
  value: number;
}

function getTeamAggregates(season: ArchivedSeason): TeamStatAggregate[] {
  const { sport, playerStats } = season;
  const sum = (key: string): number =>
    playerStats.reduce((acc, p) => acc + ((p.stats as Record<string, number> | undefined)?.[key] ?? 0), 0);

  switch (sport) {
    case 'hockey':
    case 'soccer':
    case 'lacrosse':
      return [
        { label: 'Goals', value: sum('goals') },
        { label: 'Assists', value: sum('assists') },
        { label: 'Points', value: sum('goals') + sum('assists') },
      ];
    case 'baseball':
    case 'softball':
      return [
        { label: 'Hits', value: sum('hits') },
        { label: 'HRs', value: sum('homeRuns') },
        { label: 'RBIs', value: sum('rbi') },
      ];
    case 'basketball':
      return [
        { label: 'Points', value: sum('points') },
        { label: 'Rebounds', value: sum('rebounds') },
        { label: 'Assists', value: sum('assists') },
      ];
    default:
      return [];
  }
}

// ─── Player Stats Table ────────────────────────────────────────────────────────

interface PlayerStatsTableProps {
  season: ArchivedSeason;
  nonGoalies: ArchivedPlayerStats[];
  goalies: ArchivedPlayerStats[];
  skaterCols: StatColumn[];
  goalieCols: StatColumn[];
}

function PlayerStatsTable({ season, nonGoalies, goalies, skaterCols, goalieCols }: PlayerStatsTableProps) {
  const [skaterSortKey, setSkaterSortKey] = useState<string>(skaterCols[1]?.key ?? skaterCols[0]?.key ?? 'gp');
  const [skaterAsc, setSkaterAsc] = useState(false);
  const [goalieSortKey, setGoalieSortKey] = useState<string>(goalieCols[1]?.key ?? goalieCols[0]?.key ?? 'gp');
  const [goalieAsc, setGoalieAsc] = useState(false);

  const sortedNonGoalies = useMemo(() => {
    const col = skaterCols.find((c) => c.key === skaterSortKey);
    if (!col) return nonGoalies;
    return [...nonGoalies].sort((a, b) => {
      const aVal = parseFloat(col.getValue(a)) || 0;
      const bVal = parseFloat(col.getValue(b)) || 0;
      return skaterAsc ? aVal - bVal : bVal - aVal;
    });
  }, [nonGoalies, skaterCols, skaterSortKey, skaterAsc]);

  const sortedGoalies = useMemo(() => {
    const col = goalieCols.find((c) => c.key === goalieSortKey);
    if (!col) return goalies;
    return [...goalies].sort((a, b) => {
      const aVal = parseFloat(col.getValue(a)) || 0;
      const bVal = parseFloat(col.getValue(b)) || 0;
      return goalieAsc ? aVal - bVal : bVal - aVal;
    });
  }, [goalies, goalieCols, goalieSortKey, goalieAsc]);

  const handleSkaterSort = (key: string) => {
    if (skaterSortKey === key) setSkaterAsc((v: boolean) => !v);
    else { setSkaterSortKey(key); setSkaterAsc(false); }
  };

  const handleGoalieSort = (key: string) => {
    if (goalieSortKey === key) setGoalieAsc((v: boolean) => !v);
    else { setGoalieSortKey(key); setGoalieAsc(false); }
  };

  const renderTableSection = (
    title: string,
    players: ArchivedPlayerStats[],
    cols: StatColumn[],
    sortKey: string,
    asc: boolean,
    onSort: (key: string) => void,
  ) => {
    if (players.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Users size={13} className="text-[#67e8f9]" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {title} ({players.length})
          </span>
        </div>
        <div className="bg-[#080c14] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left px-3 py-2.5 text-slate-500 font-semibold whitespace-nowrap w-32">Player</th>
                  <th className="text-left px-2 py-2.5 text-slate-500 font-semibold whitespace-nowrap w-14">Pos</th>
                  {cols.map((col) => (
                    <th
                      key={col.key}
                      className="px-2 py-2.5 text-slate-500 font-semibold cursor-pointer hover:text-slate-300 transition-colors select-none whitespace-nowrap text-right"
                      onClick={() => onSort(col.key)}
                    >
                      <span className="flex items-center justify-end gap-0.5">
                        {col.label}
                        {sortKey === col.key ? (
                          asc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => (
                  <tr
                    key={player.playerId}
                    className={cn(
                      'border-b border-white/[0.04] last:border-0',
                      idx % 2 !== 0 && 'bg-white/[0.015]'
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {player.jerseyNumber && (
                          <span className="text-[#67e8f9] font-bold text-[10px] shrink-0">
                            #{player.jerseyNumber}
                          </span>
                        )}
                        <span className="text-slate-200 truncate text-[11px]">
                          {player.playerName.split(' ')[0]}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-500 text-[10px]">
                      {getDisplayPosition(player)}
                    </td>
                    {cols.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-2 py-2 text-right font-mono text-[11px]',
                          sortKey === col.key ? 'text-slate-100 font-semibold' : 'text-slate-400'
                        )}
                      >
                        {col.getValue(player)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const skaterTitle = season.sport === 'soccer' ? 'Field Players'
    : season.sport === 'lacrosse' ? 'Field Players'
    : season.sport === 'hockey' ? 'Skaters'
    : season.sport === 'baseball' || season.sport === 'softball' ? 'Batters'
    : 'Players';

  const goalieTitle = season.sport === 'soccer' ? 'Goalkeepers' : 'Goalies';

  return (
    <div>
      {renderTableSection(skaterTitle, sortedNonGoalies, skaterCols, skaterSortKey, skaterAsc, handleSkaterSort)}
      {goalieCols.length > 0 && renderTableSection(goalieTitle, sortedGoalies, goalieCols, goalieSortKey, goalieAsc, handleGoalieSort)}
    </div>
  );
}

// ─── Attendance table ─────────────────────────────────────────────────────────

function AttendanceTable({ playerStats }: { playerStats: ArchivedPlayerStats[] }) {
  const withAttendance = playerStats.filter((p) => (p.gamesInvited ?? 0) > 0);
  if (withAttendance.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={13} className="text-[#a78bfa]" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Attendance
        </span>
      </div>
      <div className="bg-[#080c14] border border-white/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Player</th>
              <th className="text-right px-3 py-2.5 text-slate-500 font-semibold">Games</th>
              <th className="text-right px-3 py-2.5 text-slate-500 font-semibold w-14">Pct</th>
            </tr>
          </thead>
          <tbody>
            {withAttendance.map((player, idx) => {
              const invited = player.gamesInvited ?? 0;
              const attended = player.gamesAttended ?? 0;
              const pct = invited > 0 ? Math.round((attended / invited) * 100) : 0;
              return (
                <tr
                  key={player.playerId}
                  className={cn(
                    'border-b border-white/[0.04] last:border-0',
                    idx % 2 !== 0 && 'bg-white/[0.015]'
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {player.jerseyNumber && (
                        <span className="text-[#67e8f9] font-bold text-[10px]">
                          #{player.jerseyNumber}
                        </span>
                      )}
                      <span className="text-slate-200 text-[11px]">{player.playerName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 text-[11px]">
                    {attended}/{invited}
                  </td>
                  <td className={cn(
                    'px-3 py-2 text-right font-semibold text-[11px]',
                    pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-rose-400'
                  )}>
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Season Card ──────────────────────────────────────────────────────────────

interface SeasonCardProps {
  season: ArchivedSeason;
  isExpanded: boolean;
  onToggle: () => void;
}

function SeasonCard({ season, isExpanded, onToggle }: SeasonCardProps) {
  const { wins, losses, ties = 0, otLosses = 0 } = season.teamRecord;
  const gp = computeGP(season);
  const winPct = computeWinPct(season);
  const recordStr = formatRecord(season.teamRecord, season.sport);
  const sportEmoji = SPORT_EMOJI[season.sport] ?? '';
  const aggregates = getTeamAggregates(season);
  const nonGoalies = season.playerStats.filter((p) => !isGoalie(p));
  const goalies = season.playerStats.filter((p) => isGoalie(p));
  const skaterCols = getSkaterColumns(season.sport);
  const goalieCols = getGoalieColumns(season.sport);

  let archivedLabel = '';
  try {
    archivedLabel = format(parseISO(season.archivedAt), 'MMM yyyy');
  } catch {
    archivedLabel = '';
  }

  const tieLabel = season.sport === 'soccer' ? 'Draws' : 'Ties';

  return (
    <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Sport icon */}
        <div className="w-10 h-10 rounded-full bg-[#a78bfa]/10 flex items-center justify-center shrink-0 text-lg">
          {sportEmoji}
        </div>

        {/* Name + record */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{season.seasonName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs">
              <span className="text-green-400 font-semibold">{wins}W</span>
              <span className="text-slate-600 mx-1">·</span>
              <span className="text-rose-400 font-semibold">{losses}L</span>
              {(season.sport === 'hockey' || season.sport === 'soccer' || season.sport === 'lacrosse') && (
                <>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-400 font-semibold">{ties}T</span>
                </>
              )}
              {season.sport === 'hockey' && otLosses > 0 && (
                <>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-purple-400 font-semibold">{otLosses} OTL</span>
                </>
              )}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] text-slate-500 font-mono shrink-0">
              {recordStr}
            </span>
          </div>
        </div>

        {/* Archived date + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {archivedLabel && (
            <span className="text-[11px] text-slate-500 hidden sm:block">
              {archivedLabel}
            </span>
          )}
          <div className="text-slate-500">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-white/[0.07]">

          {/* W / L / T / OTL record strip */}
          <div className="flex items-center divide-x divide-white/[0.07] border-b border-white/[0.07]">
            <div className="flex-1 flex flex-col items-center py-4">
              <span className="text-2xl font-black text-green-400">{wins}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Wins</span>
            </div>
            <div className="flex-1 flex flex-col items-center py-4">
              <span className="text-2xl font-black text-rose-400">{losses}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Losses</span>
            </div>
            {(season.sport === 'hockey' || season.sport === 'soccer' || season.sport === 'lacrosse') && (
              <div className="flex-1 flex flex-col items-center py-4">
                <span className="text-2xl font-black text-amber-400">{ties}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{tieLabel}</span>
              </div>
            )}
            {season.sport === 'hockey' && (
              <div className="flex-1 flex flex-col items-center py-4">
                <span className="text-2xl font-black text-purple-400">{otLosses}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">OTL</span>
              </div>
            )}
          </div>

          {/* Win % + GP badge row */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <div>
              <span className="text-xs text-slate-500">Win Percentage</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-black text-slate-100">{winPct}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-xl bg-[#67e8f9]/10 text-[#67e8f9] font-semibold border border-[#67e8f9]/20">
                  {gp} GP
                </span>
              </div>
            </div>
            {archivedLabel && (
              <div className="text-right">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Archived</span>
                <p className="text-xs text-slate-400 font-medium">{archivedLabel}</p>
              </div>
            )}
          </div>

          {/* Team aggregates */}
          {aggregates.length > 0 && (
            <div className="px-4 py-4 border-b border-white/[0.07]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Team Totals
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#080c14] border border-white/[0.07] rounded-xl p-3 text-center">
                  <span className="text-lg font-black text-slate-100">{gp}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">GP</p>
                </div>
                {aggregates.map((agg) => (
                  <div key={agg.label} className="bg-[#080c14] border border-white/[0.07] rounded-xl p-3 text-center">
                    <span className="text-lg font-black text-slate-100">{agg.value}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">{agg.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roster summary */}
          {season.playerStats.length > 0 && (
            <div className="px-4 py-4 border-b border-white/[0.07]">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#080c14] border border-white/[0.07] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Field Players</p>
                    <p className="text-xl font-black text-slate-100">{nonGoalies.length}</p>
                  </div>
                </div>
                <div className="bg-[#080c14] border border-white/[0.07] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#a78bfa]/15 flex items-center justify-center shrink-0">
                    <Trophy size={16} className="text-[#a78bfa]" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Total Roster</p>
                    <p className="text-xl font-black text-slate-100">{season.playerStats.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team record extras (streaks, goals) */}
          {((season.teamRecord.longestWinStreak ?? 0) > 0 ||
            (season.teamRecord.longestLosingStreak ?? 0) > 0 ||
            (season.teamRecord.teamGoals ?? 0) > 0) && (
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Team Records
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(season.teamRecord.longestWinStreak ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500">Win Streak</p>
                    <p className="text-sm font-bold text-orange-400">{season.teamRecord.longestWinStreak}</p>
                  </div>
                )}
                {(season.teamRecord.longestLosingStreak ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500">Loss Streak</p>
                    <p className="text-sm font-bold text-rose-400">{season.teamRecord.longestLosingStreak}</p>
                  </div>
                )}
                {(season.teamRecord.teamGoals ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500">Team Goals</p>
                    <p className="text-sm font-bold text-green-400">{season.teamRecord.teamGoals}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Player stats table */}
          {season.playerStats.length > 0 && (
            <div className="px-4 py-4 border-b border-white/[0.07]">
              <PlayerStatsTable
                season={season}
                nonGoalies={nonGoalies}
                goalies={goalies}
                skaterCols={skaterCols}
                goalieCols={goalieCols}
              />
              <AttendanceTable playerStats={season.playerStats} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeasonHistoryPage() {
  const router = useRouter();
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const seasonHistory = teamSettings.seasonHistory ?? [];

  const sortedSeasons = useMemo(
    () =>
      [...seasonHistory].sort(
        (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
      ),
    [seasonHistory]
  );

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
          aria-label="Go back"
        >
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 font-medium truncate">{teamName}</p>
          <h1 className="text-xl font-bold text-slate-100">Season History</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#a78bfa]/10 flex items-center justify-center shrink-0">
          <Calendar size={20} className="text-[#a78bfa]" />
        </div>
      </div>

      {/* Empty state */}
      {sortedSeasons.length === 0 ? (
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center">
            <Calendar size={32} className="text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-slate-300 font-semibold mb-1">No archived seasons yet</p>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              Use the &ldquo;End Season&rdquo; option in the Admin panel to archive your first season and preserve its stats and records.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {/* Summary chip */}
          <p className="text-xs text-slate-500 mb-4 px-0.5">
            {sortedSeasons.length} archived season{sortedSeasons.length !== 1 ? 's' : ''} — most recent first
          </p>

          {/* Season cards */}
          <div className="space-y-3">
            {sortedSeasons.map((season: ArchivedSeason) => (
              <SeasonCard
                key={season.id}
                season={season}
                isExpanded={expandedId === season.id}
                onToggle={() => toggleExpanded(season.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
