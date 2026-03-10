'use client';

import React, { useState } from 'react';
import { MapPin, Pencil, CheckCircle2, XCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, getDateLabel, formatTime } from '@/lib/utils';
import type { Game, Player, TeamSettings } from '@/lib/types';

interface GameCardProps {
  game: Game;
  players: Player[];
  currentPlayerId: string | null;
  isAdmin: boolean;
  teamSettings: TeamSettings;
  onEdit?: (game: Game) => void;
  onDelete?: (gameId: string) => void;
  onRsvp?: (gameId: string, response: 'in' | 'out') => void;
  onLineup?: (game: Game) => void;
}

export default function GameCard({
  game,
  players: _players,
  currentPlayerId,
  isAdmin,
  teamSettings,
  onEdit,
  onRsvp,
  onLineup,
}: GameCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const dateLabel = getDateLabel(game.date);
  const timeFormatted = formatTime(game.time);
  const inCount = game.checkedInPlayers?.length ?? 0;
  const outCount = game.checkedOutPlayers?.length ?? 0;
  const currentResponse = currentPlayerId
    ? game.checkedInPlayers?.includes(currentPlayerId)
      ? 'in'
      : game.checkedOutPlayers?.includes(currentPlayerId)
      ? 'out'
      : null
    : null;

  const hasScore =
    game.finalScoreUs != null && game.finalScoreThem != null;

  const scoreLabel = hasScore
    ? game.gameResult === 'win'
      ? `W ${game.finalScoreUs}-${game.finalScoreThem}`
      : game.gameResult === 'loss'
      ? `L ${game.finalScoreUs}-${game.finalScoreThem}`
      : game.gameResult === 'tie'
      ? `T ${game.finalScoreUs}-${game.finalScoreThem}`
      : game.gameResult === 'otLoss'
      ? `OTL ${game.finalScoreUs}-${game.finalScoreThem}`
      : `${game.finalScoreUs}-${game.finalScoreThem}`
    : null;

  const jerseyColor = (() => {
    const jc = game.jerseyColor;
    if (!jc) return null;
    const found = teamSettings.jerseyColors?.find(
      (c) => c.name.toLowerCase() === jc.toLowerCase() || c.color === jc
    );
    return found ?? (jc.startsWith('#') ? { name: jc, color: jc } : null);
  })();

  const isToday = dateLabel === 'Today';
  const isTomorrow = dateLabel === 'Tomorrow';

  // Check if any lineup has been set
  const hasLineup = !!(
    game.lineup ||
    game.basketballLineup ||
    game.baseballLineup ||
    game.battingOrderLineup ||
    game.soccerLineup ||
    game.soccerDiamondLineup ||
    game.lacrosseLineup
  );

  return (
    <div className={cn(
      'bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 hover:bg-[#152236] hover:border-white/20 transition-all',
      isToday && 'border-[#67e8f9]/30 bg-[#67e8f9]/[0.03]'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {jerseyColor && (
            <span
              className="w-3 h-3 rounded-full shrink-0 border border-white/20"
              style={{ backgroundColor: jerseyColor.color }}
              title={`Jersey: ${jerseyColor.name}`}
            />
          )}
          <h3 className="font-semibold text-slate-100 text-base truncate">
            vs {game.opponent}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scoreLabel && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-lg',
              game.gameResult === 'win'
                ? 'bg-[#22c55e]/15 text-[#22c55e]'
                : game.gameResult === 'loss'
                ? 'bg-rose-500/15 text-rose-400'
                : 'bg-slate-500/15 text-slate-400'
            )}>
              {scoreLabel}
            </span>
          )}
          {/* Lineup button */}
          {teamSettings.showLineups && (isAdmin || hasLineup) && (
            <button
              onClick={() => onLineup?.(game)}
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-all',
                hasLineup
                  ? 'bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-[#a78bfa] hover:bg-[#a78bfa]/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/10 border border-white/10'
              )}
              title={hasLineup ? 'View/edit lineup' : 'Set lineup'}
            >
              <Users size={12} />
              {hasLineup ? 'Lineup' : 'Lineup'}
            </button>
          )}
          {isAdmin && onEdit && (
            <button
              onClick={() => onEdit(game)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Edit game"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Date / time / location */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        <span className={cn(
          'text-xs font-medium',
          isToday ? 'text-[#67e8f9]' : isTomorrow ? 'text-[#a78bfa]' : 'text-slate-400'
        )}>
          {dateLabel}
          {timeFormatted && ` · ${timeFormatted}`}
        </span>
        {game.location && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={11} />
            {game.location}
          </span>
        )}
      </div>

      {/* Notes */}
      {game.notes && (
        <div className="mb-3">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Notes
          </button>
          {showNotes && (
            <p className="mt-1.5 text-xs text-slate-400 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 leading-relaxed">
              {game.notes}
            </p>
          )}
        </div>
      )}

      {/* RSVP counts */}
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-[#22c55e]">
          <CheckCircle2 size={13} />
          {inCount} In
        </span>
        <span className="flex items-center gap-1.5 text-xs text-rose-400">
          <XCircle size={13} />
          {outCount} Out
        </span>
        {(game.invitedPlayers?.length ?? 0) > inCount + outCount && (
          <span className="text-xs text-slate-500">
            {(game.invitedPlayers?.length ?? 0) - inCount - outCount} invited
          </span>
        )}
      </div>

      {/* RSVP buttons */}
      {currentPlayerId && (
        <div className="flex gap-2">
          <button
            onClick={() => onRsvp?.(game.id, 'in')}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-medium transition-all border',
              currentResponse === 'in'
                ? 'bg-[#22c55e]/20 border-[#22c55e]/40 text-[#22c55e]'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-[#22c55e]/40 hover:text-[#22c55e]'
            )}
          >
            In
          </button>
          <button
            onClick={() => onRsvp?.(game.id, 'out')}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-medium transition-all border',
              currentResponse === 'out'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-rose-500/40 hover:text-rose-400'
            )}
          >
            Out
          </button>
        </div>
      )}
    </div>
  );
}
