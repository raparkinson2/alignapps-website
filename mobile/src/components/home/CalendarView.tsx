import { View, Text, Pressable } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  format,
  isToday,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  addMonths,
  subMonths,
  isSameMonth,
} from 'date-fns';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Game, Event } from '@/lib/store';
import { cn } from '@/lib/cn';
import { GameCard } from '@/components/home/GameCard';
import { EventCard } from '@/components/home/EventCard';

interface CalendarViewProps {
  games: Game[];
  events: Event[];
  onSelectGame: (game: Game) => void;
  onSelectEvent: (event: Event) => void;
  onViewLines: (game: Game) => void;
  onAddGameOnDate?: (date: Date) => void;
  canManageTeam?: boolean;
}

export function CalendarView({ games, events, onSelectGame, onSelectEvent, onViewLines, onAddGameOnDate, canManageTeam = false }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the starting day of the week (0 = Sunday)
  const startDayOfWeek = getDay(monthStart);

  // Create padding for days before the month starts
  const paddingDays = Array(startDayOfWeek).fill(null);

  // Get games for a specific date
  const getGamesForDate = (date: Date) => {
    return games.filter((game) => {
      const gameDate = parseISO(game.date);
      return isSameDay(gameDate, date);
    });
  };

  // Get events for a specific date (non-practice events)
  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = parseISO(event.date);
      return isSameDay(eventDate, date) && event.type !== 'practice';
    });
  };

  // Get practices for a specific date
  const getPracticesForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = parseISO(event.date);
      return isSameDay(eventDate, date) && event.type === 'practice';
    });
  };

  // Get games, events, and practices for selected date
  // For past dates, only show games (not events/practices)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isSelectedDatePast = selectedDate ? selectedDate < today : false;

  const selectedDateGames = selectedDate ? getGamesForDate(selectedDate) : [];
  const selectedDateEvents = selectedDate && !isSelectedDatePast ? getEventsForDate(selectedDate) : [];
  const selectedDatePractices = selectedDate && !isSelectedDatePast ? getPracticesForDate(selectedDate) : [];

  // Count items in current month
  const gamesThisMonth = games.filter((game) => {
    const gameDate = parseISO(game.date);
    return isSameMonth(gameDate, currentMonth);
  }).length;

  const eventsThisMonth = events.filter((event) => {
    const eventDate = parseISO(event.date);
    return isSameMonth(eventDate, currentMonth) && event.type !== 'practice';
  }).length;

  const practicesThisMonth = events.filter((event) => {
    const eventDate = parseISO(event.date);
    return isSameMonth(eventDate, currentMonth) && event.type === 'practice';
  }).length;

  const totalThisMonth = gamesThisMonth + eventsThisMonth + practicesThisMonth;

  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const handleDatePress = (date: Date, hasItems: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (hasItems) {
      // Date has games/events - toggle selection to show them
      if (selectedDate && isSameDay(selectedDate, date)) {
        setSelectedDate(null);
      } else {
        setSelectedDate(date);
      }
    } else if (canManageTeam && onAddGameOnDate) {
      // Empty date and user can manage team - open add game modal with this date
      onAddGameOnDate(date);
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View>
      {/* Month Navigation */}
      <View className="flex-row items-center justify-between mb-4 px-2">
        <Pressable
          onPress={goToPreviousMonth}
          className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center"
        >
          <ChevronLeft size={20} color="#67e8f9" />
        </Pressable>
        <View className="items-center">
          <Text className="text-white text-xl font-bold">
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
          {totalThisMonth > 0 && (
            <Text className="text-slate-400 text-sm">
              {gamesThisMonth > 0 && `${gamesThisMonth} game${gamesThisMonth !== 1 ? 's' : ''}`}
              {gamesThisMonth > 0 && (practicesThisMonth > 0 || eventsThisMonth > 0) && ', '}
              {practicesThisMonth > 0 && `${practicesThisMonth} practice${practicesThisMonth !== 1 ? 's' : ''}`}
              {practicesThisMonth > 0 && eventsThisMonth > 0 && ', '}
              {eventsThisMonth > 0 && `${eventsThisMonth} event${eventsThisMonth !== 1 ? 's' : ''}`}
            </Text>
          )}
        </View>
        <Pressable
          onPress={goToNextMonth}
          className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center"
        >
          <ChevronRight size={20} color="#67e8f9" />
        </Pressable>
      </View>

      {/* Week Days Header */}
      <View className="flex-row mb-2">
        {weekDays.map((day) => (
          <View key={day} className="flex-1 items-center py-2">
            <Text className="text-slate-500 text-xs font-semibold">{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="flex-row flex-wrap">
        {/* Padding days */}
        {paddingDays.map((_, index) => (
          <View key={`padding-${index}`} className="w-[14.28%] aspect-square p-1" />
        ))}

        {/* Actual days */}
        {daysInMonth.map((date) => {
          const dayGames = getGamesForDate(date);
          const dayEvents = getEventsForDate(date);
          const dayPractices = getPracticesForDate(date);
          const isTodayDate = isToday(date);
          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

          // For past dates, only show games (grey), not events/practices
          const hasGames = dayGames.length > 0;
          const hasEvents = !isPast && dayEvents.length > 0;
          const hasPractices = !isPast && dayPractices.length > 0;
          const hasItems = hasGames || hasEvents || hasPractices;
          const isSelected = selectedDate && isSameDay(selectedDate, date);

          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => handleDatePress(date, hasItems)}
              disabled={isPast && !hasItems}
              className="w-[14.28%] aspect-square p-0.5"
            >
              <View
                className={cn(
                  'flex-1 rounded-xl items-center justify-center',
                  isSelected && 'bg-cyan-500/50 border-2 border-cyan-400',
                  !isSelected && !hasItems && isTodayDate && 'border border-cyan-500/50',
                  isPast && !hasItems && 'opacity-40'
                )}
              >
                <Text
                  className={cn(
                    'text-base font-semibold',
                    isSelected && 'text-white',
                    !isSelected && hasItems && 'text-white',
                    !isSelected && !hasItems && isTodayDate && 'text-cyan-400',
                    !isSelected && !hasItems && !isTodayDate && 'text-slate-400'
                  )}
                >
                  {format(date, 'd')}
                </Text>
                {/* Indicator bars - green for games (grey if past), orange for practices, blue for events */}
                {hasItems && (
                  <View className="flex-row mt-1 gap-0.5">
                    {hasGames && (
                      <View
                        className={cn(
                          'h-1.5 rounded-full',
                          isSelected ? 'bg-cyan-400' : isPast ? 'bg-slate-500' : 'bg-emerald-500',
                          dayGames.length === 1 ? 'w-4' : dayGames.length === 2 ? 'w-6' : 'w-8'
                        )}
                      />
                    )}
                    {hasPractices && (
                      <View
                        className={cn(
                          'h-1.5 rounded-full',
                          isSelected ? 'bg-cyan-400' : 'bg-orange-500',
                          dayPractices.length === 1 ? 'w-4' : dayPractices.length === 2 ? 'w-6' : 'w-8'
                        )}
                      />
                    )}
                    {hasEvents && (
                      <View
                        className={cn(
                          'h-1.5 rounded-full',
                          isSelected ? 'bg-cyan-400' : 'bg-blue-500',
                          dayEvents.length === 1 ? 'w-4' : dayEvents.length === 2 ? 'w-6' : 'w-8'
                        )}
                      />
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Selected Date Items */}
      {selectedDate && (selectedDateGames.length > 0 || selectedDateEvents.length > 0 || selectedDatePractices.length > 0) && (
        <Animated.View entering={FadeInDown.springify()} className="mt-3">
          {/* Connecting divider */}
          <View className="items-center mb-2">
            <View className="w-0.5 h-3 bg-cyan-500/40 rounded-full" />
          </View>
          <View className="bg-slate-800/50 rounded-2xl p-3 border border-cyan-500/20">
            <Text className="text-cyan-300 font-semibold mb-2 text-sm">
              {format(selectedDate, 'EEEE, MMMM d')}
            </Text>
            {/* Games */}
            {selectedDateGames.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                index={index}
                onPress={() => onSelectGame(game)}
                onViewLines={() => onViewLines(game)}
                skipAnimation
                hideDateBadge
                hideWeather
              />
            ))}
            {/* Practices */}
            {selectedDatePractices.map((practice, index) => (
              <EventCard
                key={practice.id}
                event={practice}
                index={index}
                onPress={() => onSelectEvent(practice)}
                skipAnimation
                hideDateBadge
              />
            ))}
            {/* Events */}
            {selectedDateEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={index}
                onPress={() => onSelectEvent(event)}
                skipAnimation
                hideDateBadge
              />
            ))}
          </View>
        </Animated.View>
      )}

      {/* No items this month message */}
      {totalThisMonth === 0 && (
        <View className="items-center py-8">
          <Calendar size={32} color="#475569" />
          <Text className="text-slate-400 mt-2">Nothing scheduled this month</Text>
        </View>
      )}
    </View>
  );
}
