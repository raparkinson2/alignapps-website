'use client';

import React from 'react';
import { MapPin, Pencil, CheckCircle2, XCircle } from 'lucide-react';
import { cn, getDateLabel, formatTime, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/utils';
import type { Event } from '@/lib/types';

interface EventCardProps {
  event: Event;
  currentPlayerId: string | null;
  isAdmin: boolean;
  onEdit?: (event: Event) => void;
  onDelete?: (eventId: string) => void;
  onRsvp?: (eventId: string, response: 'confirmed' | 'declined') => void;
}

export default function EventCard({
  event,
  currentPlayerId,
  isAdmin,
  onEdit,
  onRsvp,
}: EventCardProps) {
  const dateLabel = getDateLabel(event.date);
  const timeFormatted = formatTime(event.time);
  const confirmedCount = event.confirmedPlayers?.length ?? 0;
  const declinedCount = event.declinedPlayers?.length ?? 0;
  const typeColor = EVENT_TYPE_COLORS[event.type] ?? '#94a3b8';
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? 'Event';

  const currentResponse = currentPlayerId
    ? event.confirmedPlayers?.includes(currentPlayerId)
      ? 'confirmed'
      : event.declinedPlayers?.includes(currentPlayerId)
      ? 'declined'
      : null
    : null;

  const isToday = dateLabel === 'Today';
  const isTomorrow = dateLabel === 'Tomorrow';

  return (
    <div className={cn(
      'bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 hover:bg-[#152236] hover:border-white/20 transition-all',
      isToday && 'border-[#a78bfa]/30 bg-[#a78bfa]/[0.03]'
    )}>
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
        <span className={cn(
          'text-xs font-medium',
          isToday ? 'text-[#a78bfa]' : isTomorrow ? 'text-[#67e8f9]' : 'text-slate-400'
        )}>
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

      {/* RSVP counts */}
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-[#22c55e]">
          <CheckCircle2 size={13} />
          {confirmedCount} In
        </span>
        <span className="flex items-center gap-1.5 text-xs text-rose-400">
          <XCircle size={13} />
          {declinedCount} Out
        </span>
      </div>

      {/* RSVP buttons */}
      {currentPlayerId && (
        <div className="flex gap-2">
          <button
            onClick={() => onRsvp?.(event.id, 'confirmed')}
            className={cn(
              'flex-1 py-2 rounded-xl text-sm font-medium transition-all border',
              currentResponse === 'confirmed'
                ? 'bg-[#22c55e]/20 border-[#22c55e]/40 text-[#22c55e]'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-[#22c55e]/40 hover:text-[#22c55e]'
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
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-rose-500/40 hover:text-rose-400'
            )}
          >
            Out
          </button>
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <p className="mt-2 text-xs text-slate-500 italic truncate">{event.notes}</p>
      )}
    </div>
  );
}
