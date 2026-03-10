'use client';

import React, { useState } from 'react';
import { MapPin, Pencil, CheckCircle2, XCircle, Circle, UserPlus, Send, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, getDateLabel, formatTime, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/utils';
import { pushEventToSupabase, pushEventResponseToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import type { Event, Player, AppNotification } from '@/lib/types';

interface EventCardProps {
  event: Event;
  players?: Player[];
  currentPlayerId: string | null;
  isAdmin: boolean;
  onEdit?: (event: Event) => void;
  onDelete?: (eventId: string) => void;
  onRsvp?: (eventId: string, response: 'confirmed' | 'declined') => void;
}

export default function EventCard({
  event,
  players = [],
  currentPlayerId,
  isAdmin,
  onEdit,
  onRsvp,
}: EventCardProps) {
  const updateEvent = useTeamStore((s) => s.updateEvent);
  const addNotification = useTeamStore((s) => s.addNotification);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const [showRsvpList, setShowRsvpList] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const PLAYER_PREVIEW_COUNT = 5;

  const dateLabel = getDateLabel(event.date);
  const timeFormatted = formatTime(event.time);
  const typeColor = EVENT_TYPE_COLORS[event.type] ?? '#94a3b8';
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? 'Event';

  const isToday = dateLabel === 'Today';
  const isTomorrow = dateLabel === 'Tomorrow';

  const rsvpLabel = event.type === 'practice' ? 'Check In' : 'RSVPs';

  // RSVP data
  const invitedPlayers = players.filter((p) => (event.invitedPlayers ?? []).includes(p.id));
  const confirmedPlayers = players.filter((p) => (event.confirmedPlayers ?? []).includes(p.id));
  const declinedPlayers = players.filter((p) => (event.declinedPlayers ?? []).includes(p.id));
  const confirmedCount = confirmedPlayers.length;
  const declinedCount = declinedPlayers.length;
  const pendingInvited = invitedPlayers.filter(
    (p) => !(event.confirmedPlayers ?? []).includes(p.id) && !(event.declinedPlayers ?? []).includes(p.id),
  );
  const pendingCount = Math.max(0, pendingInvited.length);

  const sortedPlayers = [...confirmedPlayers, ...pendingInvited, ...declinedPlayers];
  const visiblePlayers = showAllPlayers ? sortedPlayers : sortedPlayers.slice(0, PLAYER_PREVIEW_COUNT);

  const uninvitedPlayers = players.filter((p) => !(event.invitedPlayers ?? []).includes(p.id));
  const uninvitedActive = uninvitedPlayers.filter((p) => p.status === 'active');
  const uninvitedReserve = uninvitedPlayers.filter((p) => p.status === 'reserve');

  const currentResponse = currentPlayerId
    ? (event.confirmedPlayers ?? []).includes(currentPlayerId)
      ? 'confirmed'
      : (event.declinedPlayers ?? []).includes(currentPlayerId)
      ? 'declined'
      : null
    : null;

  const isCurrentPlayerInvited = currentPlayerId
    ? (event.invitedPlayers ?? []).includes(currentPlayerId)
    : false;

  // Cycle RSVP: none → confirmed → declined → none
  const handleToggleRsvp = (playerId: string) => {
    const confirmed = event.confirmedPlayers ?? [];
    const declined = event.declinedPlayers ?? [];

    let newConfirmed = [...confirmed];
    let newDeclined = [...declined];

    if (confirmed.includes(playerId)) {
      // confirmed → declined
      newConfirmed = newConfirmed.filter((id) => id !== playerId);
      newDeclined = [...newDeclined, playerId];
      if (playerId === currentPlayerId) onRsvp?.(event.id, 'declined');
      else {
        updateEvent(event.id, { confirmedPlayers: newConfirmed, declinedPlayers: newDeclined });
        const updated = { ...event, confirmedPlayers: newConfirmed, declinedPlayers: newDeclined };
        if (activeTeamId) pushEventToSupabase(updated, activeTeamId);
        pushEventResponseToSupabase(event.id, playerId, 'declined');
      }
    } else if (declined.includes(playerId)) {
      // declined → none
      newDeclined = newDeclined.filter((id) => id !== playerId);
      updateEvent(event.id, { declinedPlayers: newDeclined });
      const updated = { ...event, declinedPlayers: newDeclined };
      if (activeTeamId) pushEventToSupabase(updated, activeTeamId);
    } else {
      // none → confirmed
      newConfirmed = [...newConfirmed, playerId];
      if (playerId === currentPlayerId) onRsvp?.(event.id, 'confirmed');
      else {
        updateEvent(event.id, { confirmedPlayers: newConfirmed });
        const updated = { ...event, confirmedPlayers: newConfirmed };
        if (activeTeamId) pushEventToSupabase(updated, activeTeamId);
        pushEventResponseToSupabase(event.id, playerId, 'confirmed');
      }
    }
  };

  const handleInvitePlayer = (playerId: string) => {
    const invited = [...(event.invitedPlayers ?? [])];
    if (invited.includes(playerId)) return;
    const newInvited = [...invited, playerId];
    updateEvent(event.id, { invitedPlayers: newInvited });
    const updated = { ...event, invitedPlayers: newInvited };
    if (activeTeamId) pushEventToSupabase(updated, activeTeamId);
    pushEventResponseToSupabase(event.id, playerId, 'invited');
    const notif: AppNotification = {
      id: `event_invite_${event.id}_${playerId}_${Date.now()}`,
      type: 'event_invite',
      title: `Invited to ${typeLabel}`,
      message: `You've been invited to ${event.title}`,
      eventId: event.id,
      playerId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    addNotification(notif);
  };

  const handleInviteMultiple = (playerIds: string[]) => {
    const invited = [...(event.invitedPlayers ?? [])];
    const newIds = playerIds.filter((id) => !invited.includes(id));
    if (!newIds.length) { setShowInviteModal(false); return; }
    const newInvited = [...invited, ...newIds];
    updateEvent(event.id, { invitedPlayers: newInvited });
    const updated = { ...event, invitedPlayers: newInvited };
    if (activeTeamId) pushEventToSupabase(updated, activeTeamId);
    newIds.forEach((playerId) => {
      pushEventResponseToSupabase(event.id, playerId, 'invited');
      const notif: AppNotification = {
        id: `event_invite_${event.id}_${playerId}_${Date.now()}`,
        type: 'event_invite',
        title: `Invited to ${typeLabel}`,
        message: `You've been invited to ${event.title}`,
        eventId: event.id,
        playerId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      addNotification(notif);
    });
    setShowInviteModal(false);
  };

  const handleSendReminder = () => {
    const pendingPlayerIds = pendingInvited.map((p) => p.id);
    if (!pendingPlayerIds.length) return;
    pendingPlayerIds.forEach((playerId) => {
      const notif: AppNotification = {
        id: `event_reminder_${event.id}_${playerId}_${Date.now()}`,
        type: 'event_reminder',
        title: `Reminder: ${typeLabel}`,
        message: `Don't forget to RSVP for ${event.title}`,
        eventId: event.id,
        playerId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      addNotification(notif);
    });
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 2000);
  };

  const getRsvpIcon = (playerId: string) => {
    if ((event.confirmedPlayers ?? []).includes(playerId))
      return <CheckCircle2 size={16} className="text-[#22c55e] shrink-0" />;
    if ((event.declinedPlayers ?? []).includes(playerId))
      return <XCircle size={16} className="text-rose-400 shrink-0" />;
    return <Circle size={16} className="text-slate-500 shrink-0" />;
  };

  return (
    <>
      <div
        className={cn(
          'bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 hover:bg-[#152236] hover:border-white/20 transition-all',
          isToday && 'border-[#a78bfa]/30 bg-[#a78bfa]/[0.03]',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
              style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
            >
              {typeLabel}
            </span>
            <h3 className="font-semibold text-slate-100 text-base truncate">{event.title}</h3>
          </div>
          {isAdmin && onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0"
              aria-label="Edit event"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {/* Date / time / location */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
          <span
            className={cn(
              'text-xs font-medium',
              isToday ? 'text-[#a78bfa]' : isTomorrow ? 'text-[#67e8f9]' : 'text-slate-400',
            )}
          >
            {dateLabel}
            {timeFormatted && ` · ${timeFormatted}`}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={11} />
              {event.location}
            </span>
          )}
        </div>

        {/* Notes */}
        {event.notes && (
          <p className="mb-3 text-xs text-slate-400 italic">{event.notes}</p>
        )}

        {/* Check-In / RSVP section */}
        <div className="mt-1">
          {/* Section header row */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowRsvpList(!showRsvpList)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-200 hover:text-white transition-colors"
            >
              {rsvpLabel}
              {showRsvpList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-xs font-medium hover:bg-[#67e8f9]/20 transition-all"
                >
                  <UserPlus size={11} />
                  Invite More
                </button>
                {pendingCount > 0 && (
                  <button
                    onClick={handleSendReminder}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                      reminderSent
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                        : 'bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/20',
                    )}
                  >
                    <Send size={11} />
                    {reminderSent ? 'Sent!' : 'Remind'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-[#22c55e]">{confirmedCount}</p>
              <p className="text-xs text-slate-400">In</p>
            </div>
            <div className="bg-slate-800/60 border border-white/10 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-slate-300">{pendingCount}</p>
              <p className="text-xs text-slate-400">Pending</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-rose-400">{declinedCount}</p>
              <p className="text-xs text-slate-400">Out</p>
            </div>
          </div>

          {/* Player RSVP list */}
          {showRsvpList && sortedPlayers.length > 0 && (
            <div className="mb-3">
              {isAdmin && (
                <p className="text-xs text-slate-500 mb-2 text-center">
                  Tap to cycle: In → Out → No Response
                </p>
              )}
              {!isAdmin && currentPlayerId && (
                <p className="text-xs text-slate-500 mb-2 text-center">
                  Tap your row to update your RSVP
                </p>
              )}
              <div className="bg-slate-800/40 rounded-2xl divide-y divide-white/5">
                {visiblePlayers.map((player) => {
                  const isMe = player.id === currentPlayerId;
                  const canToggle = isAdmin || isMe;
                  return (
                    <button
                      key={player.id}
                      onClick={() => canToggle && handleToggleRsvp(player.id)}
                      disabled={!canToggle}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl',
                        canToggle ? 'hover:bg-white/5 active:bg-white/10' : 'cursor-default',
                      )}
                    >
                      {getRsvpIcon(player.id)}
                      <span className={cn('flex-1 text-sm', isMe ? 'text-white font-medium' : 'text-slate-300')}>
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold bg-[#67e8f9]/20 text-[#67e8f9] px-1.5 py-0.5 rounded-md">
                          YOU
                        </span>
                      )}
                      {(event.confirmedPlayers ?? []).includes(player.id) && (
                        <span className="text-xs text-[#22c55e]">In</span>
                      )}
                      {(event.declinedPlayers ?? []).includes(player.id) && (
                        <span className="text-xs text-rose-400">Out</span>
                      )}
                      {!(event.confirmedPlayers ?? []).includes(player.id) &&
                        !(event.declinedPlayers ?? []).includes(player.id) && (
                          <span className="text-xs text-slate-500">–</span>
                        )}
                    </button>
                  );
                })}
              </div>
              {sortedPlayers.length > PLAYER_PREVIEW_COUNT && (
                <button
                  onClick={() => setShowAllPlayers(!showAllPlayers)}
                  className="mt-1.5 w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1.5"
                >
                  {showAllPlayers
                    ? 'Show less'
                    : `Show all ${sortedPlayers.length} players`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick RSVP buttons (only if not yet invited) */}
        {currentPlayerId && !isCurrentPlayerInvited && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onRsvp?.(event.id, 'confirmed')}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-medium transition-all border',
                currentResponse === 'confirmed'
                  ? 'bg-[#22c55e]/20 border-[#22c55e]/40 text-[#22c55e]'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-[#22c55e]/40 hover:text-[#22c55e]',
              )}
            >
              In
            </button>
            <button
              onClick={() => onRsvp?.(event.id, 'declined')}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-medium transition-all border',
                currentResponse === 'declined'
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-rose-500/40 hover:text-rose-400',
              )}
            >
              Out
            </button>
          </div>
        )}
      </div>

      {/* Invite More modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowInviteModal(false)}
        >
          <div className="w-full sm:max-w-md bg-[#0f1a2e] rounded-t-3xl sm:rounded-2xl border border-white/10 max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <h3 className="text-base font-bold text-white">Invite Players</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Quick action buttons */}
              <div className="flex gap-2">
                {uninvitedActive.length > 0 && (
                  <button
                    onClick={() => handleInviteMultiple(uninvitedActive.map((p) => p.id))}
                    className="flex-1 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
                  >
                    Invite All Active ({uninvitedActive.length})
                  </button>
                )}
                {uninvitedReserve.length > 0 && (
                  <button
                    onClick={() => handleInviteMultiple(uninvitedReserve.map((p) => p.id))}
                    className="flex-1 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-all"
                  >
                    Invite All Reserve ({uninvitedReserve.length})
                  </button>
                )}
              </div>

              {/* Active players */}
              {uninvitedActive.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                    Active Players
                  </p>
                  <div className="bg-slate-800/40 rounded-2xl divide-y divide-white/5">
                    {uninvitedActive.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between px-3 py-2.5 first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        <span className="text-sm text-slate-200">{player.name}</span>
                        <button
                          onClick={() => handleInvitePlayer(player.id)}
                          className="px-3 py-1 rounded-lg bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-xs font-medium hover:bg-[#67e8f9]/20 transition-all"
                        >
                          Invite
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reserve players */}
              {uninvitedReserve.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                    Reserve Players
                  </p>
                  <div className="bg-slate-800/40 rounded-2xl divide-y divide-white/5">
                    {uninvitedReserve.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between px-3 py-2.5 first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        <span className="text-sm text-slate-200">{player.name}</span>
                        <button
                          onClick={() => handleInvitePlayer(player.id)}
                          className="px-3 py-1 rounded-lg bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-xs font-medium hover:bg-[#67e8f9]/20 transition-all"
                        >
                          Invite
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uninvitedActive.length === 0 && uninvitedReserve.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  All players have been invited
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
