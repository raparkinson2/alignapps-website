'use client';

import React, { useState } from 'react';
import { MapPin, Pencil, CheckCircle2, XCircle, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn, getDateLabel, formatTime } from '@/lib/utils';
import { getPlayerName } from '@/lib/types';
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

function getLineupLabel(sport: string | undefined): string {
  switch (sport) {
    case 'hockey': return 'Lines';
    case 'basketball': return 'Starting 5';
    case 'baseball':
    case 'softball': return 'Lineup';
    case 'soccer': return 'Formation';
    case 'lacrosse': return 'Lineup';
    default: return 'Lineup';
  }
}

export default function GameCard({
  game,
  players,
  currentPlayerId,
  isAdmin,
  teamSettings,
  onEdit,
  onRsvp,
  onLineup,
}: GameCardProps) {
  const [showInOut, setShowInOut] = useState(false);
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

  const hasScore = game.finalScoreUs != null && game.finalScoreThem != null;
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

  const hasLineup = !!(
    game.lineup || game.basketballLineup || game.baseballLineup ||
    game.battingOrderLineup || game.soccerLineup || game.soccerDiamondLineup || game.lacrosseLineup
  );

  const lineupLabel = getLineupLabel(teamSettings.sport);

  // Beer/refreshment duty
  const dutyPlayer = game.showBeerDuty && game.beerDutyPlayerId
    ? players.find((p) => p.id === game.beerDutyPlayerId)
    : null;
  const dutyEmoji = teamSettings.refreshmentDutyIs21Plus ? '🍺' : '🥤';
  const dutyLabel = teamSettings.refreshmentDutyIs21Plus ? 'Beer Duty' : 'Refreshment Duty';

  // In/Out player lists
  const inPlayers = players.filter((p) => game.checkedInPlayers?.includes(p.id));
  const outPlayers = players.filter((p) => game.checkedOutPlayers?.includes(p.id));

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
          <h3 className="font-semibold text-slate-100 text-base truncate">vs {game.opponent}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scoreLabel && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-lg',
              game.gameResult === 'win' ? 'bg-[#22c55e]/15 text-[#22c55e]'
                : game.gameResult === 'loss' ? 'bg-rose-500/15 text-rose-400'
                : 'bg-slate-500/15 text-slate-400'
            )}>
              {scoreLabel}
            </span>
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

      {/* Jersey color bar */}
      {jerseyColor && (
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: jerseyColor.color + '55' }}>
            <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: jerseyColor.color }} />
          </div>
          <span className="text-xs text-slate-500 shrink-0">{jerseyColor.name}</span>
        </div>
      )}

      {/* Date / time / location */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        <span className={cn(
          'text-xs font-medium',
          isToday ? 'text-[#67e8f9]' : isTomorrow ? 'text-[#a78bfa]' : 'text-slate-400'
        )}>
          {dateLabel}{timeFormatted && ` · ${timeFormatted}`}
        </span>
        {game.location && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin size={11} />{game.location}
          </span>
        )}
      </div>

      {/* Notes — always shown inline, no toggle */}
      {game.notes && (
        <p className="text-xs text-slate-400 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 leading-relaxed mb-3">
          {game.notes}
        </p>
      )}

      {/* Beer/Refreshment duty */}
      {game.showBeerDuty && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl">
          <span>{dutyEmoji}</span>
          <span className="text-xs text-slate-400">
            {dutyLabel}:{' '}
            {dutyPlayer
              ? <span className="text-slate-200 font-medium">{getPlayerName(dutyPlayer)}{dutyPlayer.number ? ` #${dutyPlayer.number}` : ''}</span>
              : <span className="text-slate-500">Not assigned</span>
            }
          </span>
        </div>
      )}

      {/* RSVP counts — clickable to expand In/Out lists */}
      <button
        onClick={() => setShowInOut((v) => !v)}
        className="flex items-center gap-4 mb-3 hover:opacity-80 transition-opacity"
      >
        <span className="flex items-center gap-1.5 text-xs text-[#22c55e]">
          <CheckCircle2 size={13} />{inCount} In
        </span>
        <span className="flex items-center gap-1.5 text-xs text-rose-400">
          <XCircle size={13} />{outCount} Out
        </span>
        {(game.invitedPlayers?.length ?? 0) > inCount + outCount && (
          <span className="text-xs text-slate-500">
            {(game.invitedPlayers?.length ?? 0) - inCount - outCount} pending
          </span>
        )}
        {(inCount > 0 || outCount > 0) && (
          showInOut ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />
        )}
      </button>

      {/* In/Out player lists */}
      {showInOut && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {inCount > 0 && (
            <div className="bg-[#22c55e]/[0.05] border border-[#22c55e]/20 rounded-xl p-2.5">
              <p className="text-[10px] font-semibold text-[#22c55e] uppercase tracking-wider mb-1.5">In ({inCount})</p>
              <div className="space-y-1">
                {inPlayers.map((p) => (
                  <p key={p.id} className="text-xs text-slate-300 truncate">
                    {getPlayerName(p)}{p.number ? ` #${p.number}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}
          {outCount > 0 && (
            <div className="bg-rose-500/[0.05] border border-rose-500/20 rounded-xl p-2.5">
              <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider mb-1.5">Out ({outCount})</p>
              <div className="space-y-1">
                {outPlayers.map((p) => (
                  <p key={p.id} className="text-xs text-slate-300 truncate">
                    {getPlayerName(p)}{p.number ? ` #${p.number}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RSVP buttons */}
      {currentPlayerId && (
        <div className="flex gap-2 mb-3">
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

      {/* Lineup button — below RSVP */}
      {teamSettings.showLineups && (isAdmin || hasLineup) && (
        <button
          onClick={() => onLineup?.(game)}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all border',
            hasLineup
              ? 'bg-[#a78bfa]/10 border-[#a78bfa]/20 text-[#a78bfa] hover:bg-[#a78bfa]/20'
              : 'border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/10'
          )}
        >
          <Users size={13} />
          {hasLineup ? `View ${lineupLabel}` : `Set ${lineupLabel}`}
        </button>
      )}
    </div>
  );
}
