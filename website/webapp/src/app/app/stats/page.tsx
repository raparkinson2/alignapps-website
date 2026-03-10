'use client';

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Pencil, Plus, Minus, X } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { cn } from '@/lib/utils';
import type {
  Player, Sport,
  HockeyStats, HockeyGoalieStats,
  BaseballStats, BaseballPitcherStats,
  BasketballStats,
  SoccerStats, SoccerGoalieStats,
  LacrosseStats, LacrosseGoalieStats,
} from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import { getPlayerName } from '@/lib/types';

// ─── Column definitions per sport/stat type ───────────────────────────────────

type StatCol = { key: string; label: string; getValue: (p: Player) => number; getStatKey: () => { field: string; statType: 'stats' | 'pitcherStats' | 'goalieStats' } };

function hockeySkaterCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.stats as HockeyStats)?.gamesPlayed ?? 0, getStatKey: () => ({ field: 'gamesPlayed', statType: 'stats' }) },
    { key: 'g', label: 'G', getValue: (p) => (p.stats as HockeyStats)?.goals ?? 0, getStatKey: () => ({ field: 'goals', statType: 'stats' }) },
    { key: 'a', label: 'A', getValue: (p) => (p.stats as HockeyStats)?.assists ?? 0, getStatKey: () => ({ field: 'assists', statType: 'stats' }) },
    { key: 'pts', label: 'PTS', getValue: (p) => ((p.stats as HockeyStats)?.goals ?? 0) + ((p.stats as HockeyStats)?.assists ?? 0), getStatKey: () => ({ field: 'goals', statType: 'stats' }) },
    { key: 'pm', label: '+/-', getValue: (p) => (p.stats as HockeyStats)?.plusMinus ?? 0, getStatKey: () => ({ field: 'plusMinus', statType: 'stats' }) },
    { key: 'pim', label: 'PIM', getValue: (p) => (p.stats as HockeyStats)?.pim ?? 0, getStatKey: () => ({ field: 'pim', statType: 'stats' }) },
  ];
}

function hockeyGoalieCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.goalieStats as HockeyGoalieStats)?.games ?? 0, getStatKey: () => ({ field: 'games', statType: 'goalieStats' }) },
    { key: 'w', label: 'W', getValue: (p) => (p.goalieStats as HockeyGoalieStats)?.wins ?? 0, getStatKey: () => ({ field: 'wins', statType: 'goalieStats' }) },
    { key: 'l', label: 'L', getValue: (p) => (p.goalieStats as HockeyGoalieStats)?.losses ?? 0, getStatKey: () => ({ field: 'losses', statType: 'goalieStats' }) },
    { key: 't', label: 'T', getValue: (p) => (p.goalieStats as HockeyGoalieStats)?.ties ?? 0, getStatKey: () => ({ field: 'ties', statType: 'goalieStats' }) },
    { key: 'ga', label: 'GA', getValue: (p) => (p.goalieStats as HockeyGoalieStats)?.goalsAgainst ?? 0, getStatKey: () => ({ field: 'goalsAgainst', statType: 'goalieStats' }) },
    {
      key: 'svpct', label: 'SV%', getValue: (p) => {
        const gs = p.goalieStats as HockeyGoalieStats;
        if (!gs) return 0;
        const shots = gs.shotsAgainst ?? 0;
        if (shots === 0) return 0;
        return Math.round(((gs.saves ?? 0) / shots) * 1000) / 1000;
      },
      getStatKey: () => ({ field: 'saves', statType: 'goalieStats' }),
    },
  ];
}

function baseballBatterCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.stats as BaseballStats)?.gamesPlayed ?? 0, getStatKey: () => ({ field: 'gamesPlayed', statType: 'stats' }) },
    { key: 'ab', label: 'AB', getValue: (p) => (p.stats as BaseballStats)?.atBats ?? 0, getStatKey: () => ({ field: 'atBats', statType: 'stats' }) },
    { key: 'h', label: 'H', getValue: (p) => (p.stats as BaseballStats)?.hits ?? 0, getStatKey: () => ({ field: 'hits', statType: 'stats' }) },
    {
      key: 'avg', label: 'AVG', getValue: (p) => {
        const bs = p.stats as BaseballStats;
        if (!bs) return 0;
        const ab = bs.atBats ?? 0;
        if (ab === 0) return 0;
        return Math.round(((bs.hits ?? 0) / ab) * 1000) / 1000;
      },
      getStatKey: () => ({ field: 'hits', statType: 'stats' }),
    },
    { key: 'rbi', label: 'RBI', getValue: (p) => (p.stats as BaseballStats)?.rbi ?? 0, getStatKey: () => ({ field: 'rbi', statType: 'stats' }) },
    { key: 'hr', label: 'HR', getValue: (p) => (p.stats as BaseballStats)?.homeRuns ?? 0, getStatKey: () => ({ field: 'homeRuns', statType: 'stats' }) },
    { key: 'r', label: 'R', getValue: (p) => (p.stats as BaseballStats)?.runs ?? 0, getStatKey: () => ({ field: 'runs', statType: 'stats' }) },
    { key: 'bb', label: 'BB', getValue: (p) => (p.stats as BaseballStats)?.walks ?? 0, getStatKey: () => ({ field: 'walks', statType: 'stats' }) },
    { key: 'k', label: 'K', getValue: (p) => (p.stats as BaseballStats)?.strikeouts ?? 0, getStatKey: () => ({ field: 'strikeouts', statType: 'stats' }) },
  ];
}

function baseballPitcherCols(): StatCol[] {
  return [
    { key: 'gs', label: 'GS', getValue: (p) => (p.pitcherStats as BaseballPitcherStats)?.starts ?? 0, getStatKey: () => ({ field: 'starts', statType: 'pitcherStats' }) },
    { key: 'w', label: 'W', getValue: (p) => (p.pitcherStats as BaseballPitcherStats)?.wins ?? 0, getStatKey: () => ({ field: 'wins', statType: 'pitcherStats' }) },
    { key: 'l', label: 'L', getValue: (p) => (p.pitcherStats as BaseballPitcherStats)?.losses ?? 0, getStatKey: () => ({ field: 'losses', statType: 'pitcherStats' }) },
    { key: 'ip', label: 'IP', getValue: (p) => (p.pitcherStats as BaseballPitcherStats)?.innings ?? 0, getStatKey: () => ({ field: 'innings', statType: 'pitcherStats' }) },
    {
      key: 'era', label: 'ERA', getValue: (p) => {
        const ps = p.pitcherStats as BaseballPitcherStats;
        if (!ps) return 0;
        const ip = ps.innings ?? 0;
        if (ip === 0) return 0;
        return Math.round(((ps.earnedRuns ?? 0) / ip) * 9 * 100) / 100;
      },
      getStatKey: () => ({ field: 'earnedRuns', statType: 'pitcherStats' }),
    },
    { key: 'k', label: 'K', getValue: (p) => (p.pitcherStats as BaseballPitcherStats)?.strikeouts ?? 0, getStatKey: () => ({ field: 'strikeouts', statType: 'pitcherStats' }) },
    { key: 'bb', label: 'BB', getValue: (p) => (p.pitcherStats as BaseballPitcherStats)?.walks ?? 0, getStatKey: () => ({ field: 'walks', statType: 'pitcherStats' }) },
  ];
}

function basketballCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.stats as BasketballStats)?.gamesPlayed ?? 0, getStatKey: () => ({ field: 'gamesPlayed', statType: 'stats' }) },
    { key: 'pts', label: 'PTS', getValue: (p) => (p.stats as BasketballStats)?.points ?? 0, getStatKey: () => ({ field: 'points', statType: 'stats' }) },
    { key: 'reb', label: 'REB', getValue: (p) => (p.stats as BasketballStats)?.rebounds ?? 0, getStatKey: () => ({ field: 'rebounds', statType: 'stats' }) },
    { key: 'ast', label: 'AST', getValue: (p) => (p.stats as BasketballStats)?.assists ?? 0, getStatKey: () => ({ field: 'assists', statType: 'stats' }) },
    { key: 'stl', label: 'STL', getValue: (p) => (p.stats as BasketballStats)?.steals ?? 0, getStatKey: () => ({ field: 'steals', statType: 'stats' }) },
    { key: 'blk', label: 'BLK', getValue: (p) => (p.stats as BasketballStats)?.blocks ?? 0, getStatKey: () => ({ field: 'blocks', statType: 'stats' }) },
  ];
}

function soccerFieldCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.stats as SoccerStats)?.gamesPlayed ?? 0, getStatKey: () => ({ field: 'gamesPlayed', statType: 'stats' }) },
    { key: 'g', label: 'G', getValue: (p) => (p.stats as SoccerStats)?.goals ?? 0, getStatKey: () => ({ field: 'goals', statType: 'stats' }) },
    { key: 'a', label: 'A', getValue: (p) => (p.stats as SoccerStats)?.assists ?? 0, getStatKey: () => ({ field: 'assists', statType: 'stats' }) },
    { key: 'yc', label: 'YC', getValue: (p) => (p.stats as SoccerStats)?.yellowCards ?? 0, getStatKey: () => ({ field: 'yellowCards', statType: 'stats' }) },
  ];
}

function soccerGoalieCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.goalieStats as SoccerGoalieStats)?.games ?? 0, getStatKey: () => ({ field: 'games', statType: 'goalieStats' }) },
    { key: 'w', label: 'W', getValue: (p) => (p.goalieStats as SoccerGoalieStats)?.wins ?? 0, getStatKey: () => ({ field: 'wins', statType: 'goalieStats' }) },
    { key: 'l', label: 'L', getValue: (p) => (p.goalieStats as SoccerGoalieStats)?.losses ?? 0, getStatKey: () => ({ field: 'losses', statType: 'goalieStats' }) },
    { key: 't', label: 'T', getValue: (p) => (p.goalieStats as SoccerGoalieStats)?.ties ?? 0, getStatKey: () => ({ field: 'ties', statType: 'goalieStats' }) },
    { key: 'ga', label: 'GA', getValue: (p) => (p.goalieStats as SoccerGoalieStats)?.goalsAgainst ?? 0, getStatKey: () => ({ field: 'goalsAgainst', statType: 'goalieStats' }) },
    {
      key: 'svpct', label: 'SV%', getValue: (p) => {
        const gs = p.goalieStats as SoccerGoalieStats;
        if (!gs) return 0;
        const shots = gs.shotsAgainst ?? 0;
        if (shots === 0) return 0;
        return Math.round(((gs.saves ?? 0) / shots) * 1000) / 1000;
      },
      getStatKey: () => ({ field: 'saves', statType: 'goalieStats' }),
    },
  ];
}

function lacrosseFieldCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.stats as LacrosseStats)?.gamesPlayed ?? 0, getStatKey: () => ({ field: 'gamesPlayed', statType: 'stats' }) },
    { key: 'g', label: 'G', getValue: (p) => (p.stats as LacrosseStats)?.goals ?? 0, getStatKey: () => ({ field: 'goals', statType: 'stats' }) },
    { key: 'a', label: 'A', getValue: (p) => (p.stats as LacrosseStats)?.assists ?? 0, getStatKey: () => ({ field: 'assists', statType: 'stats' }) },
    { key: 'gb', label: 'GB', getValue: (p) => (p.stats as LacrosseStats)?.groundBalls ?? 0, getStatKey: () => ({ field: 'groundBalls', statType: 'stats' }) },
    { key: 'ct', label: 'CT', getValue: (p) => (p.stats as LacrosseStats)?.causedTurnovers ?? 0, getStatKey: () => ({ field: 'causedTurnovers', statType: 'stats' }) },
    { key: 'sog', label: 'SOG', getValue: (p) => (p.stats as LacrosseStats)?.shotsOnGoal ?? 0, getStatKey: () => ({ field: 'shotsOnGoal', statType: 'stats' }) },
  ];
}

function lacrosseGoalieCols(): StatCol[] {
  return [
    { key: 'gp', label: 'GP', getValue: (p) => (p.goalieStats as LacrosseGoalieStats)?.games ?? 0, getStatKey: () => ({ field: 'games', statType: 'goalieStats' }) },
    { key: 'w', label: 'W', getValue: (p) => (p.goalieStats as LacrosseGoalieStats)?.wins ?? 0, getStatKey: () => ({ field: 'wins', statType: 'goalieStats' }) },
    { key: 'l', label: 'L', getValue: (p) => (p.goalieStats as LacrosseGoalieStats)?.losses ?? 0, getStatKey: () => ({ field: 'losses', statType: 'goalieStats' }) },
    { key: 'sv', label: 'SV', getValue: (p) => (p.goalieStats as LacrosseGoalieStats)?.saves ?? 0, getStatKey: () => ({ field: 'saves', statType: 'goalieStats' }) },
    { key: 'ga', label: 'GA', getValue: (p) => (p.goalieStats as LacrosseGoalieStats)?.goalsAgainst ?? 0, getStatKey: () => ({ field: 'goalsAgainst', statType: 'goalieStats' }) },
  ];
}

interface TableSection {
  title: string;
  players: Player[];
  cols: StatCol[];
}

function getTableSections(sport: Sport, players: Player[]): TableSection[] {
  const active = players.filter((p) => p.status === 'active');

  const isGoalie = (p: Player) => {
    const positions = p.positions && p.positions.length > 0 ? p.positions : [p.position];
    return positions.some((pos) =>
      sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse'
        ? pos === 'G' || pos === 'GK'
        : false
    );
  };
  const isPitcher = (p: Player) => {
    const positions = p.positions && p.positions.length > 0 ? p.positions : [p.position];
    return positions.includes('P');
  };

  switch (sport) {
    case 'hockey': {
      const skaters = active.filter((p) => !isGoalie(p));
      const goalies = active.filter(isGoalie);
      return [
        { title: 'Skaters', players: skaters, cols: hockeySkaterCols() },
        ...(goalies.length > 0 ? [{ title: 'Goalies', players: goalies, cols: hockeyGoalieCols() }] : []),
      ];
    }
    case 'baseball':
    case 'softball': {
      const pitchers = active.filter(isPitcher);
      const batters = active.filter((p) => !isPitcher(p));
      return [
        { title: 'Batters', players: batters, cols: baseballBatterCols() },
        ...(pitchers.length > 0 ? [{ title: 'Pitchers', players: pitchers, cols: baseballPitcherCols() }] : []),
      ];
    }
    case 'basketball':
      return [{ title: 'Players', players: active, cols: basketballCols() }];
    case 'soccer': {
      const gks = active.filter((p) => {
        const pos = p.positions && p.positions.length > 0 ? p.positions : [p.position];
        return pos.includes('GK');
      });
      const field = active.filter((p) => {
        const pos = p.positions && p.positions.length > 0 ? p.positions : [p.position];
        return !pos.includes('GK');
      });
      return [
        { title: 'Field Players', players: field, cols: soccerFieldCols() },
        ...(gks.length > 0 ? [{ title: 'Goalkeepers', players: gks, cols: soccerGoalieCols() }] : []),
      ];
    }
    case 'lacrosse': {
      const lGoalies = active.filter((p) => {
        const pos = p.positions && p.positions.length > 0 ? p.positions : [p.position];
        return pos.includes('G');
      });
      const lField = active.filter((p) => {
        const pos = p.positions && p.positions.length > 0 ? p.positions : [p.position];
        return !pos.includes('G');
      });
      return [
        { title: 'Field Players', players: lField, cols: lacrosseFieldCols() },
        ...(lGoalies.length > 0 ? [{ title: 'Goalies', players: lGoalies, cols: lacrosseGoalieCols() }] : []),
      ];
    }
    default:
      return [];
  }
}

// ─── Edit Stats Modal ──────────────────────────────────────────────────────────

interface EditStatsModalProps {
  player: Player;
  cols: StatCol[];
  activeTeamId: string | null;
  onClose: () => void;
  onSave: (playerId: string, updates: Partial<Player>) => void;
}

function EditStatsModal({ player, cols, activeTeamId, onClose, onSave }: EditStatsModalProps) {
  // Build initial stat values from player
  const buildInitialValues = () => {
    const vals: Record<string, string> = {};
    for (const col of cols) {
      if (col.key === 'pts' || col.key === 'avg' || col.key === 'era' || col.key === 'svpct') continue; // computed
      vals[col.key] = String(col.getValue(player));
    }
    return vals;
  };

  const [values, setValues] = useState<Record<string, string>>(buildInitialValues);
  const [saving, setSaving] = useState(false);

  const editableCols = cols.filter((c) => c.key !== 'pts' && c.key !== 'avg' && c.key !== 'era' && c.key !== 'svpct');

  const adjust = (key: string, delta: number) => {
    setValues((prev) => {
      const current = parseInt(prev[key] ?? '0', 10) || 0;
      return { ...prev, [key]: String(Math.max(0, current + delta)) };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    // Build updated stats objects
    const statsUpdate: Record<string, number> = {};
    const pitcherStatsUpdate: Record<string, number> = {};
    const goalieStatsUpdate: Record<string, number> = {};

    for (const col of editableCols) {
      const { field, statType } = col.getStatKey();
      const val = parseInt(values[col.key] ?? '0', 10) || 0;
      if (statType === 'stats') statsUpdate[field] = val;
      else if (statType === 'pitcherStats') pitcherStatsUpdate[field] = val;
      else if (statType === 'goalieStats') goalieStatsUpdate[field] = val;
    }

    const updates: Partial<Player> = {};
    if (Object.keys(statsUpdate).length > 0) updates.stats = { ...(player.stats ?? {}), ...statsUpdate } as Player['stats'];
    if (Object.keys(pitcherStatsUpdate).length > 0) updates.pitcherStats = { ...(player.pitcherStats ?? {}), ...pitcherStatsUpdate } as Player['pitcherStats'];
    if (Object.keys(goalieStatsUpdate).length > 0) updates.goalieStats = { ...(player.goalieStats ?? {}), ...goalieStatsUpdate } as Player['goalieStats'];

    onSave(player.id, updates);
    if (activeTeamId) {
      await pushPlayerToSupabase({ ...player, ...updates }, activeTeamId);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0d1526] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <Avatar player={player} size="sm" />
            <div>
              <p className="text-sm font-semibold text-slate-100">{getPlayerName(player)}</p>
              {player.number && <p className="text-xs text-slate-500">#{player.number}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {/* Stat fields */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {editableCols.map((col) => (
            <div key={col.key} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 w-10 shrink-0 text-right">{col.label}</span>
              <div className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => adjust(col.key, -1)}
                  className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-all"
                >
                  <Minus size={13} />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={values[col.key] ?? '0'}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    setValues((prev) => ({ ...prev, [col.key]: v }));
                  }}
                  className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-1.5 text-slate-100 text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 focus:border-[#67e8f9]/40"
                />
                <button
                  onClick={() => adjust(col.key, 1)}
                  className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-all"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.07]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold hover:bg-[#67e8f9]/90 transition-all text-sm disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Stats'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Table ──────────────────────────────────────────────────────────────

interface StatsTableProps {
  section: TableSection;
  canManage: boolean;
  activeTeamId: string | null;
  onEditPlayer: (player: Player, cols: StatCol[]) => void;
}

function StatsTable({ section, canManage, onEditPlayer }: StatsTableProps) {
  const [sortKey, setSortKey] = useState<string>(section.cols[1]?.key ?? section.cols[0]?.key ?? 'gp');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedPlayers = useMemo(() => {
    const col = section.cols.find((c) => c.key === sortKey);
    if (!col) return section.players;
    return [...section.players].sort((a, b) => {
      const aVal = col.getValue(a);
      const bVal = col.getValue(b);
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [section.players, section.cols, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (section.players.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{section.title}</h2>
      <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-slate-500 font-medium w-40">Player</th>
                {section.cols.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-3 text-slate-500 font-medium cursor-pointer hover:text-slate-300 transition-colors select-none whitespace-nowrap"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="flex items-center justify-end gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : null}
                    </span>
                  </th>
                ))}
                {canManage && <th className="px-3 py-3 w-10" />}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, idx) => (
                <tr
                  key={player.id}
                  className={cn(
                    'border-b border-white/[0.05] last:border-0',
                    idx % 2 === 0 ? '' : 'bg-white/[0.02]'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar player={player} size="sm" />
                      <div className="min-w-0">
                        <p className="text-slate-100 font-medium text-xs truncate">{getPlayerName(player)}</p>
                        {player.number && (
                          <p className="text-slate-500 text-[10px]">#{player.number}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {section.cols.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-3 text-right font-mono text-xs',
                        sortKey === col.key ? 'text-slate-100' : 'text-slate-400'
                      )}
                    >
                      {col.getValue(player)}
                    </td>
                  ))}
                  {canManage && (
                    <td className="px-3 py-3">
                      <button
                        onClick={() => onEditPlayer(player, section.cols)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#67e8f9] hover:bg-[#67e8f9]/10 transition-all"
                        title="Edit stats"
                      >
                        <Pencil size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const { canManage } = usePermissions();

  const [editingPlayer, setEditingPlayer] = useState<{ player: Player; cols: StatCol[] } | null>(null);

  const sections = useMemo(() => getTableSections(teamSettings.sport, players), [teamSettings.sport, players]);

  const handleEditPlayer = (player: Player, cols: StatCol[]) => {
    setEditingPlayer({ player, cols });
  };

  const handleSaveStats = (playerId: string, updates: Partial<Player>) => {
    updatePlayer(playerId, updates);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-100 mb-5">Stats</h1>

      {sections.length === 0 || sections.every((s) => s.players.length === 0) ? (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-slate-400 text-sm">No stats recorded yet</p>
        </div>
      ) : (
        sections.map((section) => (
          <StatsTable
            key={section.title}
            section={section}
            canManage={canManage}
            activeTeamId={activeTeamId}
            onEditPlayer={handleEditPlayer}
          />
        ))
      )}

      {editingPlayer && (
        <EditStatsModal
          player={editingPlayer.player}
          cols={editingPlayer.cols}
          activeTeamId={activeTeamId}
          onClose={() => setEditingPlayer(null)}
          onSave={handleSaveStats}
        />
      )}
    </div>
  );
}
