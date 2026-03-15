'use client';

import React, { useState, useMemo } from 'react';
import { UserCheck, Users, Calendar, CheckCircle2, XCircle, HelpCircle, TrendingUp } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import type { Player, Game } from '@/lib/types';
import { getPlayerName } from '@/lib/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type AttendanceColor = 'green' | 'yellow' | 'orange' | 'red';

function getAttendanceColor(rate: number): AttendanceColor {
  if (rate >= 80) return 'green';
  if (rate >= 60) return 'yellow';
  if (rate >= 40) return 'orange';
  return 'red';
}

const colorClasses: Record<AttendanceColor, { text: string; bar: string; badge: string }> = {
  green:  { text: 'text-emerald-400',  bar: 'bg-emerald-500',  badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  yellow: { text: 'text-yellow-400',   bar: 'bg-yellow-500',   badge: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/25'  },
  orange: { text: 'text-orange-400',   bar: 'bg-orange-500',   badge: 'bg-orange-500/15  text-orange-400  border-orange-500/25'  },
  red:    { text: 'text-rose-400',     bar: 'bg-rose-500',     badge: 'bg-rose-500/15    text-rose-400    border-rose-500/25'    },
};

// ── Per-player stats ───────────────────────────────────────────────────────────

interface PlayerAttendanceStat {
  player: Player;
  invitedGames: Game[];
  inGames: Game[];
  outGames: Game[];
  noResponseGames: Game[];
  attendanceRate: number;
}

function computePlayerStat(player: string, pastGames: Game[]): Omit<PlayerAttendanceStat, 'player'> {
  const invitedGames = pastGames.filter((g) => (g.invitedPlayers ?? []).includes(player));
  const inGames = invitedGames.filter((g) => (g.checkedInPlayers ?? []).includes(player));
  const outGames = invitedGames.filter((g) => (g.checkedOutPlayers ?? []).includes(player));
  const noResponseGames = invitedGames.filter(
    (g) =>
      !(g.checkedInPlayers ?? []).includes(player) &&
      !(g.checkedOutPlayers ?? []).includes(player)
  );
  const attendanceRate = invitedGames.length > 0
    ? (inGames.length / invitedGames.length) * 100
    : 0;

  return { invitedGames, inGames, outGames, noResponseGames, attendanceRate };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}

function StatPill({ icon, label, value, colorClass }: StatPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <div className={cn('flex items-center gap-1', colorClass)}>
        {icon}
        <span className="text-sm font-bold">{value}</span>
      </div>
      <span className="text-[10px] text-slate-500 uppercase tracking-wide leading-none">{label}</span>
    </div>
  );
}

// ── Game-by-game modal ─────────────────────────────────────────────────────────

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  stat: PlayerAttendanceStat | null;
}

function GameHistoryModal({ isOpen, onClose, stat }: GameHistoryModalProps) {
  if (!stat) return null;

  const color = getAttendanceColor(stat.attendanceRate);
  const colors = colorClasses[color];

  const sortedGames = [...stat.invitedGames].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getPlayerName(stat.player)}
      size="md"
    >
      {/* Player summary */}
      <div className="flex items-center gap-4 mb-5 pb-5 border-b border-white/[0.07]">
        <Avatar player={stat.player} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-xs mb-2">Attendance Rate</p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-2xl font-bold', colors.text)}>
              {stat.invitedGames.length > 0 ? `${Math.round(stat.attendanceRate)}%` : 'N/A'}
            </span>
            <span className="text-slate-500 text-sm">
              ({stat.inGames.length}/{stat.invitedGames.length} games)
            </span>
          </div>
          {stat.invitedGames.length > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', colors.bar)}
                style={{ width: `${Math.min(100, stat.attendanceRate)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Game list */}
      {sortedGames.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4">No past games found for this player.</p>
      ) : (
        <div className="space-y-2">
          {sortedGames.map((game) => {
            const isIn = (game.checkedInPlayers ?? []).includes(stat.player.id);
            const isOut = (game.checkedOutPlayers ?? []).includes(stat.player.id);

            return (
              <div
                key={game.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#0a1525] border border-white/[0.06]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    vs. {game.opponent || 'Unknown'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatGameDate(game.date)}</p>
                </div>
                <div className="shrink-0">
                  {isIn ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 size={18} strokeWidth={2} />
                      <span className="text-xs font-medium">In</span>
                    </div>
                  ) : isOut ? (
                    <div className="flex items-center gap-1.5 text-rose-400">
                      <XCircle size={18} strokeWidth={2} />
                      <span className="text-xs font-medium">Out</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <HelpCircle size={18} strokeWidth={2} />
                      <span className="text-xs font-medium">No response</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Player card ────────────────────────────────────────────────────────────────

interface PlayerAttendanceCardProps {
  stat: PlayerAttendanceStat;
  rank: number;
  onClick: (stat: PlayerAttendanceStat) => void;
}

function PlayerAttendanceCard({ stat, rank, onClick }: PlayerAttendanceCardProps) {
  const color = getAttendanceColor(stat.attendanceRate);
  const colors = colorClasses[color];
  const hasGames = stat.invitedGames.length > 0;

  return (
    <button
      onClick={() => onClick(stat)}
      className="w-full text-left bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-4 hover:border-white/[0.14] hover:bg-[#132035] transition-all duration-150 group"
    >
      {/* Top row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative shrink-0">
          <Avatar player={stat.player} size="md" />
          {rank <= 3 && hasGames && (
            <div
              className={cn(
                'absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white',
                rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-slate-400' : 'bg-orange-700'
              )}
            >
              {rank}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
            {getPlayerName(stat.player)}
          </p>
          <p className="text-xs text-slate-500 truncate">
            #{stat.player.number} &middot; {stat.player.position}
          </p>
        </div>
        {/* Rate badge */}
        <div className={cn('shrink-0 px-2.5 py-1 rounded-lg border text-sm font-bold', colors.badge)}>
          {hasGames ? `${Math.round(stat.attendanceRate)}%` : 'N/A'}
        </div>
      </div>

      {/* Progress bar */}
      {hasGames && (
        <div className="mb-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
            style={{ width: `${Math.min(100, stat.attendanceRate)}%` }}
          />
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-around pt-1 border-t border-white/[0.05]">
        <StatPill
          icon={<Calendar size={11} />}
          label="Invited"
          value={stat.invitedGames.length}
          colorClass="text-slate-400"
        />
        <div className="w-px h-6 bg-white/[0.06]" />
        <StatPill
          icon={<CheckCircle2 size={11} />}
          label="In"
          value={stat.inGames.length}
          colorClass="text-emerald-400"
        />
        <div className="w-px h-6 bg-white/[0.06]" />
        <StatPill
          icon={<XCircle size={11} />}
          label="Out"
          value={stat.outGames.length}
          colorClass="text-rose-400"
        />
        <div className="w-px h-6 bg-white/[0.06]" />
        <StatPill
          icon={<HelpCircle size={11} />}
          label="No Resp."
          value={stat.noResponseGames.length}
          colorClass="text-slate-500"
        />
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const { canManage } = usePermissions();

  const [selectedStat, setSelectedStat] = useState<PlayerAttendanceStat | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const today = todayStr();

  // Past games only (date < today)
  const pastGames = useMemo(
    () => games.filter((g) => g.date < today),
    [games, today]
  );

  // Active players only, compute per-player stats
  const playerStats = useMemo<PlayerAttendanceStat[]>(() => {
    const active = players.filter((p) => p.status === 'active');
    return active
      .map((player) => ({
        player,
        ...computePlayerStat(player.id, pastGames),
      }))
      .sort((a, b) => {
        // Players with no invited games go to the bottom
        if (a.invitedGames.length === 0 && b.invitedGames.length === 0) return 0;
        if (a.invitedGames.length === 0) return 1;
        if (b.invitedGames.length === 0) return -1;
        return b.attendanceRate - a.attendanceRate;
      });
  }, [players, pastGames]);

  // Team summary
  const teamSummary = useMemo(() => {
    const gamesWithResponses = pastGames.filter(
      (g) =>
        (g.invitedPlayers?.length ?? 0) > 0 &&
        ((g.checkedInPlayers?.length ?? 0) > 0 || (g.checkedOutPlayers?.length ?? 0) > 0)
    );
    let totalInvited = 0;
    let totalIn = 0;
    for (const game of pastGames) {
      totalInvited += (game.invitedPlayers ?? []).length;
      totalIn += (game.checkedInPlayers ?? []).length;
    }
    const overallRate = totalInvited > 0 ? (totalIn / totalInvited) * 100 : 0;
    return { gamesWithResponses: gamesWithResponses.length, totalIn, totalInvited, overallRate };
  }, [pastGames]);

  const summaryColor = getAttendanceColor(teamSummary.overallRate);
  const summaryColors = colorClasses[summaryColor];

  const handlePlayerClick = (stat: PlayerAttendanceStat) => {
    setSelectedStat(stat);
    setModalOpen(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <UserCheck size={20} className="text-[#67e8f9]" />
          Attendance
        </h1>
        <span className="text-xs text-slate-500 font-medium">
          {pastGames.length} past {pastGames.length === 1 ? 'game' : 'games'}
        </span>
      </div>

      {/* Team Summary Card */}
      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-[#67e8f9]" />
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Team Overview</h2>
        </div>

        {pastGames.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-2">No past games to show yet.</p>
        ) : (
          <div className="flex items-center gap-4">
            {/* Rate */}
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-2">
                <span className={cn('text-4xl font-bold', summaryColors.text)}>
                  {teamSummary.totalInvited > 0 ? `${Math.round(teamSummary.overallRate)}%` : 'N/A'}
                </span>
                {teamSummary.totalInvited > 0 && (
                  <span className="text-slate-500 text-sm">overall in-rate</span>
                )}
              </div>
              {teamSummary.totalInvited > 0 && (
                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', summaryColors.bar)}
                    style={{ width: `${Math.min(100, teamSummary.overallRate)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-white/[0.07]" />

            {/* Mini stats */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-[#67e8f9]" />
                <span className="text-xs text-slate-500">Games tracked</span>
                <span className="text-xs font-semibold text-slate-200 ml-auto pl-3">
                  {teamSummary.gamesWithResponses}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span className="text-xs text-slate-500">Total check-ins</span>
                <span className="text-xs font-semibold text-slate-200 ml-auto pl-3">
                  {teamSummary.totalIn}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={13} className="text-slate-400" />
                <span className="text-xs text-slate-500">Total invited</span>
                <span className="text-xs font-semibold text-slate-200 ml-auto pl-3">
                  {teamSummary.totalInvited}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Player Cards */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Players ({playerStats.length})
        </h2>

        {playerStats.length === 0 ? (
          <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-8 text-center">
            <Users size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No active players</p>
            <p className="text-slate-600 text-xs mt-1">Add players to your roster to track attendance.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {playerStats.map((stat, index) => (
              <PlayerAttendanceCard
                key={stat.player.id}
                stat={stat}
                rank={index + 1}
                onClick={handlePlayerClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {playerStats.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1 pb-2">
          <span className="text-xs text-slate-600">Color scale:</span>
          {(
            [
              { label: '≥80% Excellent', color: 'green' as AttendanceColor },
              { label: '≥60% Good', color: 'yellow' as AttendanceColor },
              { label: '≥40% Fair', color: 'orange' as AttendanceColor },
              { label: '<40% Low', color: 'red' as AttendanceColor },
            ] as const
          ).map(({ label, color }) => (
            <div key={color} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', colorClasses[color].bar)} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Game-by-game modal */}
      <GameHistoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        stat={selectedStat}
      />
    </div>
  );
}
