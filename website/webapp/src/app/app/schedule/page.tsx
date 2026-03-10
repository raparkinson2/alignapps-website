'use client';

import React, { useState, useMemo } from 'react';
import { Plus, ChevronDown, CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { pushGameResponseToSupabase, pushEventResponseToSupabase } from '@/lib/realtime-sync';
import GameCard from '@/components/schedule/GameCard';
import EventCard from '@/components/schedule/EventCard';
import AddGameModal from '@/components/schedule/AddGameModal';
import AddEventModal from '@/components/schedule/AddEventModal';
import AddPracticeModal from '@/components/schedule/AddPracticeModal';
import LineupModal from '@/components/schedule/LineupModal';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import type { Game, Event, TeamSettings, Player } from '@/lib/types';

type ScheduleItem =
  | { kind: 'game'; item: Game; sortKey: string }
  | { kind: 'event'; item: Event; sortKey: string };

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── Calendar view ──────────────────────────────────────────────────────────────
function CalendarView({
  games,
  events,
  currentPlayerId,
  isAdmin,
  onEditGame,
  onEditEvent,
  onGameRsvp,
  onEventRsvp,
  onLineup,
  teamSettings,
  players,
}: {
  games: Game[];
  events: Event[];
  currentPlayerId: string | null;
  isAdmin: boolean;
  onEditGame: (g: Game) => void;
  onEditEvent: (e: Event) => void;
  onGameRsvp: (id: string, r: 'in' | 'out') => void;
  onEventRsvp: (id: string, r: 'confirmed' | 'declined') => void;
  onLineup: (g: Game) => void;
  teamSettings: TeamSettings;
  players: Player[];
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const dateStr = (d: Date) => format(d, 'yyyy-MM-dd');
  const normalizeDate = (s: string) => s.slice(0, 10); // handles both "yyyy-MM-dd" and ISO strings

  const getGamesForDate = (date: Date) =>
    games.filter((g) => normalizeDate(g.date) === dateStr(date));
  const getPracticesForDate = (date: Date) =>
    events.filter((e) => normalizeDate(e.date) === dateStr(date) && e.type === 'practice');
  const getEventsForDate = (date: Date) =>
    events.filter((e) => normalizeDate(e.date) === dateStr(date) && e.type !== 'practice');

  // Month summary counts
  const monthPrefix = format(viewMonth, 'yyyy-MM');
  const gamesThisMonth = games.filter((g) => normalizeDate(g.date).startsWith(monthPrefix)).length;
  const practicesThisMonth = events.filter((e) => normalizeDate(e.date).startsWith(monthPrefix) && e.type === 'practice').length;
  const eventsThisMonth = events.filter((e) => normalizeDate(e.date).startsWith(monthPrefix) && e.type !== 'practice').length;
  const totalThisMonth = gamesThisMonth + practicesThisMonth + eventsThisMonth;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Selected date items (show all items regardless of past/future)
  const selectedDateGames = selectedDate ? getGamesForDate(selectedDate) : [];
  const selectedDatePractices = selectedDate ? getPracticesForDate(selectedDate) : [];
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const handleDateClick = (date: Date, hasItems: boolean) => {
    if (!hasItems) return;
    setSelectedDate(selectedDate && isSameDay(date, selectedDate) ? null : date);
  };

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={() => { setViewMonth(subMonths(viewMonth, 1)); setSelectedDate(null); }} className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-[#67e8f9] hover:bg-slate-700/80 transition-all">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">{format(viewMonth, 'MMMM yyyy')}</h2>
          {totalThisMonth > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              {gamesThisMonth > 0 && `${gamesThisMonth} game${gamesThisMonth !== 1 ? 's' : ''}`}
              {gamesThisMonth > 0 && (practicesThisMonth > 0 || eventsThisMonth > 0) && ', '}
              {practicesThisMonth > 0 && `${practicesThisMonth} practice${practicesThisMonth !== 1 ? 's' : ''}`}
              {practicesThisMonth > 0 && eventsThisMonth > 0 && ', '}
              {eventsThisMonth > 0 && `${eventsThisMonth} event${eventsThisMonth !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
        <button onClick={() => { setViewMonth(addMonths(viewMonth, 1)); setSelectedDate(null); }} className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-[#67e8f9] hover:bg-slate-700/80 transition-all">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {weeks.flat().map((d, idx) => {
          const dayGames = getGamesForDate(d);
          const dayPractices = getPracticesForDate(d);
          const dayEvents = getEventsForDate(d);
          const isToday = isSameDay(d, new Date());
          const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
          const inMonth = isSameMonth(d, viewMonth);
          const isPast = d < today;
          const hasGames = dayGames.length > 0;
          const hasPractices = dayPractices.length > 0;
          const hasEvents = dayEvents.length > 0;
          const hasItems = hasGames || hasPractices || hasEvents;

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(d, hasItems)}
              disabled={!hasItems && !(isToday)}
              className={cn(
                'relative flex flex-col items-center justify-center aspect-square p-0.5 transition-all',
                !inMonth && 'opacity-30',
                isPast && !hasItems && 'opacity-40 cursor-default',
                !hasItems && !isToday && 'cursor-default',
              )}
            >
              <div className={cn(
                'w-full h-full rounded-xl flex flex-col items-center justify-center gap-0.5',
                isSelected && 'bg-cyan-500/50 border-2 border-cyan-400',
                !isSelected && isToday && !hasItems && 'border border-cyan-500/50',
              )}>
                <span className={cn(
                  'text-sm font-semibold leading-none',
                  isSelected && 'text-white',
                  !isSelected && hasItems && 'text-white',
                  !isSelected && !hasItems && isToday && 'text-[#67e8f9]',
                  !isSelected && !hasItems && !isToday && 'text-slate-400',
                )}>
                  {format(d, 'd')}
                </span>

                {/* Indicator bars */}
                {hasItems && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {hasGames && (
                      <span className={cn(
                        'h-1.5 rounded-full',
                        isSelected ? 'bg-cyan-400' : isPast ? 'bg-slate-500' : 'bg-emerald-500',
                        dayGames.length === 1 ? 'w-4' : dayGames.length === 2 ? 'w-6' : 'w-8',
                      )} />
                    )}
                    {hasPractices && (
                      <span className={cn(
                        'h-1.5 rounded-full',
                        isSelected ? 'bg-cyan-400' : 'bg-orange-500',
                        dayPractices.length === 1 ? 'w-4' : dayPractices.length === 2 ? 'w-6' : 'w-8',
                      )} />
                    )}
                    {hasEvents && (
                      <span className={cn(
                        'h-1.5 rounded-full',
                        isSelected ? 'bg-cyan-400' : 'bg-blue-500',
                        dayEvents.length === 1 ? 'w-4' : dayEvents.length === 2 ? 'w-6' : 'w-8',
                      )} />
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected date panel */}
      {selectedDate && (selectedDateGames.length > 0 || selectedDateEvents.length > 0 || selectedDatePractices.length > 0) && (
        <div className="mt-3">
          <div className="flex justify-center mb-2">
            <div className="w-px h-3 bg-cyan-500/40 rounded-full" />
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-3 border border-cyan-500/20">
            <p className="text-cyan-300 font-semibold mb-3 text-sm">{format(selectedDate, 'EEEE, MMMM d')}</p>
            <div className="space-y-3">
              {selectedDateGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  players={players}
                  currentPlayerId={currentPlayerId}
                  isAdmin={isAdmin}
                  teamSettings={teamSettings}
                  onEdit={onEditGame}
                  onRsvp={onGameRsvp}
                  onLineup={onLineup}
                />
              ))}
              {selectedDatePractices.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  currentPlayerId={currentPlayerId}
                  isAdmin={isAdmin}
                  onEdit={onEditEvent}
                  onRsvp={onEventRsvp}
                />
              ))}
              {selectedDateEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  currentPlayerId={currentPlayerId}
                  isAdmin={isAdmin}
                  onEdit={onEditEvent}
                  onRsvp={onEventRsvp}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nothing scheduled this month */}
      {totalThisMonth === 0 && (
        <div className="flex flex-col items-center py-8 text-slate-400">
          <CalendarDays size={32} className="text-slate-600 mb-2" />
          <p className="text-sm">Nothing scheduled this month</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const games = useTeamStore((s) => s.games);
  const events = useTeamStore((s) => s.events);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const checkInToGame = useTeamStore((s) => s.checkInToGame);
  const checkOutFromGame = useTeamStore((s) => s.checkOutFromGame);
  const confirmEventAttendance = useTeamStore((s) => s.confirmEventAttendance);
  const declineEventAttendance = useTeamStore((s) => s.declineEventAttendance);
  const { isAdmin } = usePermissions();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [showAddGame, setShowAddGame] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddPractice, setShowAddPractice] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingPractice, setEditingPractice] = useState<Event | null>(null);
  const [lineupGame, setLineupGame] = useState<Game | null>(null);
  const [showPast, setShowPast] = useState(false);

  const today = todayStr();

  const allItems: ScheduleItem[] = useMemo(() => {
    const gameItems: ScheduleItem[] = games.map((g) => ({
      kind: 'game',
      item: g,
      sortKey: `${g.date}T${g.time || '00:00'}`,
    }));
    const eventItems: ScheduleItem[] = events.map((e) => ({
      kind: 'event',
      item: e,
      sortKey: `${e.date}T${e.time || '00:00'}`,
    }));
    return [...gameItems, ...eventItems].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [games, events]);

  const upcomingItems = allItems.filter((x) => x.item.date.slice(0, 10) >= today);
  const pastItems = allItems.filter((x) => x.item.date.slice(0, 10) < today).reverse().slice(0, 10);

  const handleGameRsvp = async (gameId: string, response: 'in' | 'out') => {
    if (!currentPlayerId) return;
    if (response === 'in') checkInToGame(gameId, currentPlayerId);
    else checkOutFromGame(gameId, currentPlayerId);
    await pushGameResponseToSupabase(gameId, currentPlayerId, response);
  };

  const handleEventRsvp = async (eventId: string, response: 'confirmed' | 'declined') => {
    if (!currentPlayerId) return;
    if (response === 'confirmed') confirmEventAttendance(eventId, currentPlayerId);
    else declineEventAttendance(eventId, currentPlayerId);
    await pushEventResponseToSupabase(eventId, currentPlayerId, response);
  };

  const handleEditEvent = (event: Event) => {
    if (event.type === 'practice') {
      setEditingPractice(event);
      setShowAddPractice(true);
    } else {
      setEditingEvent(event);
      setShowAddEvent(true);
    }
  };

  const handleEditGame = (game: Game) => {
    setEditingGame(game);
    setShowAddGame(true);
  };

  const handleLineup = (game: Game) => {
    setLineupGame(game);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-100">Schedule</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/[0.05] border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 rounded-lg transition-all', viewMode === 'list' ? 'bg-[#67e8f9]/20 text-[#67e8f9]' : 'text-slate-500 hover:text-slate-300')}
              title="List view"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn('p-1.5 rounded-lg transition-all', viewMode === 'calendar' ? 'bg-[#67e8f9]/20 text-[#67e8f9]' : 'text-slate-500 hover:text-slate-300')}
              title="Calendar view"
            >
              <CalendarDays size={15} />
            </button>
          </div>

          {/* Add buttons (admin only) */}
          {isAdmin && (
            <>
              <button
                onClick={() => { setEditingGame(null); setShowAddGame(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-sm font-medium hover:bg-[#67e8f9]/20 transition-all"
              >
                <Plus size={15} />
                Game
              </button>
              <button
                onClick={() => { setEditingPractice(null); setShowAddPractice(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f97316]/10 border border-[#f97316]/20 text-[#f97316] text-sm font-medium hover:bg-[#f97316]/20 transition-all"
              >
                <Plus size={15} />
                Practice
              </button>
              <button
                onClick={() => { setEditingEvent(null); setShowAddEvent(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-sm font-medium hover:bg-[#3b82f6]/20 transition-all"
              >
                <Plus size={15} />
                Event
              </button>
            </>
          )}
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === 'calendar' ? (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-4">
          <CalendarView
            games={games}
            events={events}
            currentPlayerId={currentPlayerId}
            isAdmin={isAdmin}
            onEditGame={handleEditGame}
            onEditEvent={handleEditEvent}
            onGameRsvp={handleGameRsvp}
            onEventRsvp={handleEventRsvp}
            onLineup={handleLineup}
            teamSettings={teamSettings}
            players={players}
          />
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section className="mb-8">
            {upcomingItems.length === 0 ? (
              <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-sm">No upcoming games or events</p>
                {isAdmin && <p className="text-slate-500 text-xs mt-1">Use the buttons above to add some</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingItems.map((x) => {
                  if (x.kind === 'game') {
                    return (
                      <GameCard
                        key={x.item.id}
                        game={x.item}
                        players={players}
                        currentPlayerId={currentPlayerId}
                        isAdmin={isAdmin}
                        teamSettings={teamSettings}
                        onEdit={handleEditGame}
                        onRsvp={handleGameRsvp}
                        onLineup={handleLineup}
                      />
                    );
                  }
                  return (
                    <EventCard
                      key={x.item.id}
                      event={x.item}
                      currentPlayerId={currentPlayerId}
                      isAdmin={isAdmin}
                      onEdit={handleEditEvent}
                      onRsvp={handleEventRsvp}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Past */}
          {pastItems.length > 0 && (
            <section>
              <button
                onClick={() => setShowPast(!showPast)}
                className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors mb-3"
              >
                <ChevronDown size={16} className={cn('transition-transform', showPast && 'rotate-180')} />
                Past ({pastItems.length})
              </button>
              {showPast && (
                <div className="space-y-3 opacity-70">
                  {pastItems.map((x) => {
                    if (x.kind === 'game') {
                      return (
                        <GameCard
                          key={x.item.id}
                          game={x.item}
                          players={players}
                          currentPlayerId={currentPlayerId}
                          isAdmin={isAdmin}
                          teamSettings={teamSettings}
                          onEdit={handleEditGame}
                          onLineup={handleLineup}
                        />
                      );
                    }
                    return (
                      <EventCard
                        key={x.item.id}
                        event={x.item}
                        currentPlayerId={currentPlayerId}
                        isAdmin={isAdmin}
                        onEdit={handleEditEvent}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Modals */}
      <AddGameModal
        isOpen={showAddGame}
        onClose={() => { setShowAddGame(false); setEditingGame(null); }}
        existingGame={editingGame}
      />
      <AddPracticeModal
        isOpen={showAddPractice}
        onClose={() => { setShowAddPractice(false); setEditingPractice(null); }}
        existingEvent={editingPractice}
      />
      <AddEventModal
        isOpen={showAddEvent}
        onClose={() => { setShowAddEvent(false); setEditingEvent(null); }}
        existingEvent={editingEvent}
      />
      {lineupGame && (
        <LineupModal
          isOpen={!!lineupGame}
          onClose={() => setLineupGame(null)}
          game={lineupGame}
          players={players}
          sport={teamSettings.sport}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
