'use client';

import React, { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import type { Player, Sport } from '@/lib/types';
import { getPlayerName, SPORT_POSITION_NAMES } from '@/lib/types';
import Modal from '@/components/ui/Modal';

// ─── Stats header definitions (matching mobile StatsUtils) ──────────────────

function getStatHeaders(sport: Sport) {
  switch (sport) {
    case 'hockey':
      return ['GP', 'G', 'A', 'PIM', '+/-'];
    case 'baseball':
    case 'softball':
      return ['GP', 'AB', 'H', 'R', 'RBI', 'HR', 'AVG'];
    case 'basketball':
      return ['GP', 'PTS', 'REB', 'AST', 'STL', 'BLK'];
    case 'soccer':
      return ['GP', 'G', 'A', 'SOG', 'YC', 'RC'];
    case 'lacrosse':
      return ['GP', 'G', 'A', 'SOG', 'GB', 'CT'];
    default:
      return ['GP'];
  }
}

function getStatValues(player: Player, sport: Sport): (string | number)[] {
  const s = player.stats as Record<string, number> | undefined;
  if (!s) return getStatHeaders(sport).map(() => 0);

  switch (sport) {
    case 'hockey':
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, s.pim ?? 0, s.plusMinus ?? 0];
    case 'baseball':
    case 'softball': {
      const ab = s.atBats ?? 0;
      const h = s.hits ?? 0;
      const avg = ab > 0 ? (h / ab).toFixed(3) : '.000';
      return [s.gamesPlayed ?? 0, ab, h, s.runs ?? 0, s.rbi ?? 0, s.homeRuns ?? 0, avg];
    }
    case 'basketball':
      return [s.gamesPlayed ?? 0, s.points ?? 0, s.rebounds ?? 0, s.assists ?? 0, s.steals ?? 0, s.blocks ?? 0];
    case 'soccer':
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, s.shotsOnGoal ?? 0, s.yellowCards ?? 0, s.redCards ?? 0];
    case 'lacrosse':
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, s.shotsOnGoal ?? 0, s.groundBalls ?? 0, s.causedTurnovers ?? 0];
    default:
      return [s.gamesPlayed ?? 0];
  }
}

export default function ExportStatsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const sport = teamSettings.sport;
  const isPremium = teamSettings.isPremium ?? false;

  const activePlayers = useMemo(
    () => players.filter((p) => p.status === 'active' && !p.roles?.includes('parent')),
    [players]
  );

  const handleExport = () => {
    const headers = ['Name', '#', 'Position', ...getStatHeaders(sport)];
    const rows = activePlayers.map((p) => {
      const pos = (p.positions ?? [p.position]).filter(Boolean).map(
        (pos) => SPORT_POSITION_NAMES[sport]?.[pos] ?? pos
      ).join('/');
      return [getPlayerName(p), p.number ?? '', pos, ...getStatValues(p, sport)];
    });

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${teamName.replace(/\s+/g, '_')}_stats.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Stats" size="md">
      <div className="space-y-4">
        {!isPremium ? (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-sm">
            <span>Exporting stats requires a Premium subscription.</span>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-sm">
              Download player stats for <strong className="text-slate-200">{teamName}</strong> as a CSV file.
              Includes {activePlayers.length} active player{activePlayers.length !== 1 ? 's' : ''}.
            </p>

            {/* Preview table */}
            <div className="overflow-x-auto bg-white/[0.03] border border-white/10 rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-slate-500 font-medium px-3 py-2">Player</th>
                    {getStatHeaders(sport).map((h) => (
                      <th key={h} className="text-center text-slate-500 font-medium px-2 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activePlayers.slice(0, 5).map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="text-slate-200 px-3 py-1.5 truncate max-w-[120px]">{getPlayerName(p)}</td>
                      {getStatValues(p, sport).map((v, i) => (
                        <td key={i} className="text-center text-slate-400 px-2 py-1.5">{v}</td>
                      ))}
                    </tr>
                  ))}
                  {activePlayers.length > 5 && (
                    <tr>
                      <td colSpan={getStatHeaders(sport).length + 1} className="text-center text-slate-500 px-3 py-1.5 text-[11px]">
                        ...and {activePlayers.length - 5} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold text-sm hover:bg-[#67e8f9]/90 transition-all"
            >
              <Download size={16} />
              Download CSV
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
