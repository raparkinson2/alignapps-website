'use client';

import React, { useState } from 'react';
import {
  MapPin, Pencil, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Users, UserPlus, Send, X, Circle,
} from 'lucide-react';
import { cn, getDateLabel, formatTime } from '@/lib/utils';
import { getPlayerName } from '@/lib/types';
import { pushGameToSupabase, pushGameResponseToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import type { Game, Player, TeamSettings, AppNotification } from '@/lib/types';

interface GameCardProps {
  game: Game;
  players: Player[];
  currentPlayerId: string | null;
  isAdmin: boolean;
  teamSettings: TeamSettings;
  onEdit?: (game: Game) => void;
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
  const updateGame = useTeamStore((s) => s.updateGame);
  const addNotification = useTeamStore((s) => s.addNotification);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const [showRsvpList, setShowRsvpList] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  const dateLabel = getDateLabel(game.date);
  const timeFormatted = formatTime(game.time);

  const invitedPlayers = players.filter((p) => game.invitedPlayers?.includes(p.id));
  const checkedInCount = game.checkedInPlayers?.length ?? 0;
  const checkedOutCount = game.checkedOutPlayers?.length ?? 0;
  const pendingCount = Math.max(0, invitedPlayers.length - checkedInCount - checkedOutCount);

  // Players sorted: confirmed → pending → declined
  const confirmedPlayers = players.filter((p) => game.checkedInPlayers?.includes(p.id));
  const declinedPlayers = players.filter((p) => game.checkedOutPlayers?.includes(p.id));
  const pendingInvited = invitedPlayers.filter(
    (p) => !game.checkedInPlayers?.includes(p.id) && !game.checkedOutPlayers?.includes(p.id)
  );
  const sortedPlayers = [...confirmedPlayers, ...pendingInvited, ...declinedPlayers];

  // Uninvited players for Invite More
  const uninvitedPlayers = players.filter(
    (p) => (p.status === 'active' || p.status === 'reserve') && !game.invitedPlayers?.includes(p.id)
  );
  const uninvitedActive = uninvitedPlayers.filter((p) => p.status === 'active');
  const uninvitedReserve = uninvitedPlayers.filter((p) => p.status === 'reserve');

  const hasScore = game.finalScoreUs != null && game.finalScoreThem != null;
  const scoreLabel = hasScore
    ? game.gameResult === 'win' ? `W ${game.finalScoreUs}-${game.finalScoreThem}`
    : game.gameResult === 'loss' ? `L ${game.finalScoreUs}-${game.finalScoreThem}`
    : game.gameResult === 'tie' ? `T ${game.finalScoreUs}-${game.finalScoreThem}`
    : game.gameResult === 'otLoss' ? `OTL ${game.finalScoreUs}-${game.finalScoreThem}`
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

  const dutyPlayer = game.showBeerDuty && game.beerDutyPlayerId
    ? players.find((p) => p.id === game.beerDutyPlayerId)
    : null;
  const dutyEmoji = teamSettings.refreshmentDutyIs21Plus ? '🍺' : '🥤';
  const dutyLabel = teamSettings.refreshmentDutyIs21Plus ? 'Beer Duty' : 'Refreshment Duty';

  // Cycle RSVP for any player row: none→in→out→none
  const handleToggleRsvp = (playerId: string) => {
    const canToggle = isAdmin || playerId === currentPlayerId;
    if (!canToggle) return;

    const isIn = game.checkedInPlayers?.includes(playerId);
    const isOut = game.checkedOutPlayers?.includes(playerId);

    if (isOut) {
      // Clear: remove from both lists
      const updatedGame = {
        ...game,
        checkedInPlayers: (game.checkedInPlayers ?? []).filter((id) => id !== playerId),
        checkedOutPlayers: (game.checkedOutPlayers ?? []).filter((id) => id !== playerId),
      };
      updateGame(game.id, updatedGame);
      if (activeTeamId) pushGameToSupabase(updatedGame, activeTeamId).catch(console.error);
      return;
    }

    const response: 'in' | 'out' = isIn ? 'out' : 'in';

    if (playerId === currentPlayerId) {
      onRsvp?.(game.id, response);
    } else {
      const updatedGame = response === 'in'
        ? {
            ...game,
            checkedInPlayers: [...(game.checkedInPlayers ?? []).filter((id) => id !== playerId), playerId],
            checkedOutPlayers: (game.checkedOutPlayers ?? []).filter((id) => id !== playerId),
            invitedPlayers: game.invitedPlayers?.includes(playerId) ? game.invitedPlayers : [...(game.invitedPlayers ?? []), playerId],
          }
        : {
            ...game,
            checkedOutPlayers: [...(game.checkedOutPlayers ?? []).filter((id) => id !== playerId), playerId],
            checkedInPlayers: (game.checkedInPlayers ?? []).filter((id) => id !== playerId),
            invitedPlayers: game.invitedPlayers?.includes(playerId) ? game.invitedPlayers : [...(game.invitedPlayers ?? []), playerId],
          };
      updateGame(game.id, updatedGame);
      if (activeTeamId) {
        pushGameToSupabase(updatedGame, activeTeamId).catch(console.error);
        pushGameResponseToSupabase(game.id, playerId, response).catch(console.error);
      }
    }
  };

  // Invite a single player
  const handleInvitePlayer = (playerId: string) => {
    const currentInvited = game.invitedPlayers ?? [];
    if (currentInvited.includes(playerId)) return;
    const updatedGame = { ...game, invitedPlayers: [...currentInvited, playerId] };
    updateGame(game.id, updatedGame);
    if (activeTeamId) {
      pushGameToSupabase(updatedGame, activeTeamId).catch(console.error);
      pushGameResponseToSupabase(game.id, playerId, 'invited').catch(console.error);
    }
    const notification: AppNotification = {
      id: `${Date.now()}-${playerId}`,
      type: 'game_invite',
      title: 'Game Invite',
      message: `You're invited to play vs ${game.opponent} on ${game.date.slice(0, 10)} at ${game.time ?? ''}.`,
      gameId: game.id,
      fromPlayerId: currentPlayerId ?? undefined,
      toPlayerId: playerId,
      createdAt: new Date().toISOString(),
      read: false,
    };
    addNotification(notification);
  };

  // Invite multiple players
  const handleInviteMultiple = (playerIds: string[]) => {
    const currentInvited = game.invitedPlayers ?? [];
    const newInvites = playerIds.filter((id) => !currentInvited.includes(id));
    if (newInvites.length === 0) return;
    const updatedGame = { ...game, invitedPlayers: [...currentInvited, ...newInvites] };
    updateGame(game.id, updatedGame);
    if (activeTeamId) {
      pushGameToSupabase(updatedGame, activeTeamId).catch(console.error);
      newInvites.forEach((id) => pushGameResponseToSupabase(game.id, id, 'invited').catch(console.error));
    }
    newInvites.forEach((playerId) => {
      addNotification({
        id: `${Date.now()}-${playerId}`,
        type: 'game_invite',
        title: 'Game Invite',
        message: `You're invited to play vs ${game.opponent} on ${game.date.slice(0, 10)} at ${game.time ?? ''}.`,
        gameId: game.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: playerId,
        createdAt: new Date().toISOString(),
        read: false,
      });
    });
    setShowInviteModal(false);
  };

  // Send reminder to pending players
  const handleSendReminder = () => {
    if (reminderSent) return;
    const pendingList = invitedPlayers.filter(
      (p) => !game.checkedOutPlayers?.includes(p.id) && !game.checkedInPlayers?.includes(p.id)
    );
    pendingList.forEach((player) => {
      addNotification({
        id: `${Date.now()}-reminder-${player.id}`,
        type: 'game_reminder',
        title: 'Game Reminder',
        message: `Reminder: Game vs ${game.opponent} on ${game.date.slice(0, 10)} at ${game.time ?? ''}. Please update your RSVP.`,
        gameId: game.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: player.id,
        createdAt: new Date().toISOString(),
        read: false,
      });
    });
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 2000);
  };

  return (
    <>
      <div className={cn(
        'bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 transition-all',
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

        {/* Date / time / location */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
          <span className={cn(
            'text-xs font-medium',
            isToday ? 'text-[#67e8f9]' : isTomorrow ? 'text-[#a78bfa]' : 'text-slate-400'
          )}>
            {dateLabel}{timeFormatted && ` · ${timeFormatted}`}
          </span>
          {jerseyColor && (
            <span className="text-xs text-slate-500">{jerseyColor.name} jersey</span>
          )}
          {game.location && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={11} />{game.location}
            </span>
          )}
        </div>

        {/* Notes */}
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

        {/* ── Check-In section ── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-[#22c55e]" />
            <span className="text-[#22c55e] text-sm font-semibold">Check In</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 text-[#67e8f9] text-xs font-medium hover:bg-cyan-500/25 transition-all"
              >
                <UserPlus size={12} />
                Invite More
              </button>
              <button
                onClick={handleSendReminder}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  reminderSent
                    ? 'bg-green-500/25 text-[#22c55e]'
                    : 'bg-green-500/15 text-[#22c55e] hover:bg-green-500/25'
                )}
              >
                <Send size={12} />
                {reminderSent ? 'Sent!' : 'Send Reminder'}
              </button>
            </div>
          )}
        </div>

        {/* RSVP stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-green-500/15 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-[#22c55e] text-xl font-bold leading-none">{checkedInCount}</span>
            <span className="text-green-400/70 text-[10px] mt-0.5">Confirmed</span>
          </div>
          <div className="bg-slate-700/40 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-slate-300 text-xl font-bold leading-none">{pendingCount}</span>
            <span className="text-slate-400 text-[10px] mt-0.5">Pending</span>
          </div>
          <div className="bg-red-500/15 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-rose-400 text-xl font-bold leading-none">{checkedOutCount}</span>
            <span className="text-red-400/70 text-[10px] mt-0.5">Declined</span>
          </div>
        </div>

        {/* Instruction hint */}
        <div className="bg-slate-700/25 border border-slate-600/25 rounded-xl px-3 py-2 mb-3">
          <p className="text-slate-400 text-[11px] text-center">
            {isAdmin
              ? <span>Tap to cycle: <span className="text-green-400 font-medium">IN</span> → <span className="text-red-400 font-medium">OUT</span> → <span className="text-slate-500 font-medium">No Response</span></span>
              : 'Tap your row to update your RSVP'
            }
          </p>
        </div>

        {/* Player RSVP list */}
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700/40 overflow-hidden mb-3">
          {sortedPlayers.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-4">No players invited yet</p>
          ) : (
            <>
              {(showRsvpList ? sortedPlayers : sortedPlayers.slice(0, 5)).map((player, idx) => {
                const isIn = game.checkedInPlayers?.includes(player.id);
                const isOut = game.checkedOutPlayers?.includes(player.id);
                const isSelf = player.id === currentPlayerId;
                const canToggle = isAdmin || isSelf;
                return (
                  <div
                    key={player.id}
                    role={canToggle ? 'button' : undefined}
                    tabIndex={canToggle ? 0 : undefined}
                    onClick={() => canToggle && handleToggleRsvp(player.id)}
                    onKeyDown={(e) => e.key === 'Enter' && canToggle && handleToggleRsvp(player.id)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 border-b border-slate-700/30 last:border-0',
                      idx === 0 && 'pt-2.5',
                      canToggle ? 'hover:bg-slate-700/30 cursor-pointer' : 'cursor-default'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                      isIn ? 'bg-green-500/20' : isOut ? 'bg-red-500/20' : 'bg-slate-700/50'
                    )}>
                      {isIn
                        ? <CheckCircle2 size={14} className="text-[#22c55e]" />
                        : isOut
                        ? <XCircle size={14} className="text-rose-400" />
                        : <Circle size={14} className="text-slate-500" />
                      }
                    </div>
                    <span className={cn(
                      'text-sm flex-1 truncate',
                      isIn ? 'text-slate-100' : isOut ? 'text-slate-400' : 'text-slate-300'
                    )}>
                      {getPlayerName(player)}
                      {player.number ? <span className="text-slate-500 ml-1 text-xs">#{player.number}</span> : null}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] font-bold text-[#67e8f9] bg-cyan-500/15 px-1.5 py-0.5 rounded-md shrink-0">YOU</span>
                    )}
                  </div>
                );
              })}
              {sortedPlayers.length > 5 && (
                <button
                  onClick={() => setShowRsvpList((v) => !v)}
                  className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700/20 transition-all"
                >
                  {showRsvpList
                    ? <><ChevronUp size={12} /> Show less</>
                    : <><ChevronDown size={12} /> Show all {sortedPlayers.length} players</>
                  }
                </button>
              )}
            </>
          )}
        </div>

        {/* Quick RSVP for current player if not yet invited */}
        {currentPlayerId && !game.invitedPlayers?.includes(currentPlayerId) && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => onRsvp?.(game.id, 'in')}
              className="flex-1 py-2 rounded-xl text-sm font-medium border bg-white/[0.03] border-white/10 text-slate-400 hover:border-[#22c55e]/40 hover:text-[#22c55e] transition-all"
            >
              In
            </button>
            <button
              onClick={() => onRsvp?.(game.id, 'out')}
              className="flex-1 py-2 rounded-xl text-sm font-medium border bg-white/[0.03] border-white/10 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 transition-all"
            >
              Out
            </button>
          </div>
        )}

        {/* Lineup button */}
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

      {/* ── Invite More Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
          <div className="relative w-full sm:max-w-lg bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-700/60 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
              <button onClick={() => setShowInviteModal(false)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                <X size={20} />
              </button>
              <span className="text-white font-semibold">Invite Players</span>
              <div className="w-6" />
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              {uninvitedPlayers.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
                  <Users size={40} className="text-slate-600" />
                  <p className="text-sm">All players have been invited</p>
                </div>
              ) : (
                <>
                  {/* Quick action buttons */}
                  <div className="flex gap-2 mb-4">
                    {uninvitedActive.length > 0 && (
                      <button
                        onClick={() => handleInviteMultiple(uninvitedActive.map((p) => p.id))}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-500/15 border border-green-500/40 text-green-400 hover:bg-green-500/25 transition-all"
                      >
                        Invite All Active ({uninvitedActive.length})
                      </button>
                    )}
                    {uninvitedReserve.length > 0 && (
                      <button
                        onClick={() => handleInviteMultiple(uninvitedReserve.map((p) => p.id))}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 transition-all"
                      >
                        Invite All Reserve ({uninvitedReserve.length})
                      </button>
                    )}
                  </div>

                  {/* Active players */}
                  {uninvitedActive.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Active Players</p>
                      <div className="space-y-1.5 mb-4">
                        {uninvitedActive.map((player) => (
                          <div key={player.id} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5 border border-slate-700/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{getPlayerName(player)}</p>
                              {player.number && <p className="text-slate-400 text-xs">#{player.number}</p>}
                            </div>
                            <button
                              onClick={() => handleInvitePlayer(player.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#67e8f9] text-[#080c14] text-xs font-bold hover:bg-[#67e8f9]/90 transition-all shrink-0"
                            >
                              Invite
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Reserve players */}
                  {uninvitedReserve.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 mt-4">Reserve Players</p>
                      <div className="space-y-1.5">
                        {uninvitedReserve.map((player) => (
                          <div key={player.id} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5 border border-slate-700/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{getPlayerName(player)}</p>
                              {player.number && <p className="text-slate-400 text-xs">#{player.number}</p>}
                            </div>
                            <button
                              onClick={() => handleInvitePlayer(player.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#67e8f9] text-[#080c14] text-xs font-bold hover:bg-[#67e8f9]/90 transition-all shrink-0"
                            >
                              Invite
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
