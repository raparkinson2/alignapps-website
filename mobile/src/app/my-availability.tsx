import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isToday, isBefore, startOfToday } from 'date-fns';
import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Check,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore, Game, Event } from '@/lib/store';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';
import { cn } from '@/lib/cn';

export default function MyAvailabilityScreen() {
  const router = useRouter();
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const events = useTeamStore((s) => s.events);
  const addUnavailableDate = useTeamStore((s) => s.addUnavailableDate);
  const removeUnavailableDate = useTeamStore((s) => s.removeUnavailableDate);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const syncCurrentPlayer = () => {
    if (!currentPlayerId || !activeTeamId) return;
    const p = useTeamStore.getState().players.find((pl) => pl.id === currentPlayerId);
    if (p) pushPlayerToSupabase(p, activeTeamId).catch(syncError('sync'));
  };

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const unavailableDates = currentPlayer?.unavailableDates || [];

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarSelectedDates, setCalendarSelectedDates] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Get conflicts for a date (games/events the player would be marked OUT for)
  const getConflictsForDate = (dateStr: string) => {
    const conflicts: { type: 'game' | 'event'; item: Game | Event }[] = [];

    games.forEach((game) => {
      const gameDate = game.date.split('T')[0];
      if (gameDate === dateStr && game.invitedPlayers.includes(currentPlayerId || '')) {
        conflicts.push({ type: 'game', item: game });
      }
    });

    events.forEach((event) => {
      const eventDate = event.date.split('T')[0];
      if (eventDate === dateStr && event.invitedPlayers.includes(currentPlayerId || '')) {
        conflicts.push({ type: 'event', item: event });
      }
    });

    return conflicts;
  };

  const handleRemoveDate = (dateStr: string) => {
    if (!currentPlayerId) return;

    Alert.alert(
      'Remove Date',
      'Are you sure you want to remove this unavailable date? This will NOT automatically change your status for games/events on this date.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeUnavailableDate(currentPlayerId, dateStr);
            syncCurrentPlayer();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const today = startOfToday();

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const paddingDays = Array(startDayOfWeek).fill(null);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isDateUnavailable = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return unavailableDates.includes(dateStr);
  };

  const hasGameOrEvent = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return games.some((g) => g.date.split('T')[0] === dateStr && g.invitedPlayers.includes(currentPlayerId || '')) ||
           events.some((e) => e.date.split('T')[0] === dateStr && e.invitedPlayers.includes(currentPlayerId || ''));
  };

  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleCalendarDatePress = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dateStr = format(date, 'yyyy-MM-dd');

    if (isSelectionMode) {
      // Multi-select mode - toggle selection
      if (calendarSelectedDates.includes(dateStr)) {
        setCalendarSelectedDates(calendarSelectedDates.filter((d) => d !== dateStr));
      } else if (!isDateUnavailable(date)) {
        setCalendarSelectedDates([...calendarSelectedDates, dateStr]);
      }
    } else {
      if (isDateUnavailable(date)) {
        // If already unavailable, offer to remove
        handleRemoveDate(dateStr);
      } else {
        // Start selection mode with this date
        setIsSelectionMode(true);
        setCalendarSelectedDates([dateStr]);
      }
    }
  };

  const handleAddSelectedDates = () => {
    if (!currentPlayerId || calendarSelectedDates.length === 0) return;

    // Check for conflicts
    let hasConflicts = false;
    const allConflicts: string[] = [];

    calendarSelectedDates.forEach((dateStr) => {
      const conflicts = getConflictsForDate(dateStr);
      if (conflicts.length > 0) {
        hasConflicts = true;
        conflicts.forEach((c) => {
          if (c.type === 'game') {
            allConflicts.push(`${dateStr}: Game vs ${(c.item as Game).opponent}`);
          } else {
            allConflicts.push(`${dateStr}: ${(c.item as Event).title}`);
          }
        });
      }
    });

    const addDates = () => {
      calendarSelectedDates.forEach((dateStr) => {
        if (!unavailableDates.includes(dateStr)) {
          addUnavailableDate(currentPlayerId, dateStr);
        }
      });
      syncCurrentPlayer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCalendarSelectedDates([]);
      setIsSelectionMode(false);
    };

    if (hasConflicts) {
      Alert.alert(
        'Schedule Conflicts',
        `Adding these dates will mark you OUT for:\n\n${allConflicts.slice(0, 5).join('\n')}${allConflicts.length > 5 ? `\n...and ${allConflicts.length - 5} more` : ''}\n\nDo you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark Unavailable', style: 'destructive', onPress: addDates },
        ]
      );
    } else {
      addDates();
    }
  };

  const cancelSelection = () => {
    setCalendarSelectedDates([]);
    setIsSelectionMode(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Count unavailable dates this month
  const unavailableThisMonth = unavailableDates.filter((d) => {
    const date = parseISO(d);
    return isSameMonth(date, currentMonth);
  }).length;

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="px-5 pt-2 pb-4"
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center"
            >
              <ChevronLeft size={24} color="#67e8f9" />
            </Pressable>
            <View className="flex-1 mx-4">
              <Text className="text-white text-2xl font-bold text-center">My Availability</Text>
            </View>
            {/* Spacer for alignment */}
            <View className="w-10 h-10" />
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Explanatory Text */}
          <Animated.View entering={FadeInDown.delay(80).springify()} className="mb-4">
            <Text className="text-slate-300 text-sm text-center leading-5">
              You'll automatically be marked <Text className="text-red-400 font-bold">Out</Text> for events on these dates.
            </Text>
            <Text className="text-slate-400 text-xs text-center mt-1">
              You can manually change your RSVP for any event.
            </Text>
          </Animated.View>

          {/* Calendar View */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
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
                {unavailableThisMonth > 0 && (
                  <Text className="text-amber-400 text-sm">
                    {unavailableThisMonth} unavailable day{unavailableThisMonth !== 1 ? 's' : ''}
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
                const dateStr = format(date, 'yyyy-MM-dd');
                const isUnavailable = isDateUnavailable(date);
                const hasSchedule = hasGameOrEvent(date);
                const isTodayDate = isToday(date);
                const isPast = isBefore(date, today);
                const isSelected = calendarSelectedDates.includes(dateStr);

                return (
                  <Pressable
                    key={date.toISOString()}
                    onPress={() => handleCalendarDatePress(date)}
                    disabled={isPast}
                    className="w-[14.28%] aspect-square p-0.5"
                  >
                    <View
                      className={cn(
                        'flex-1 rounded-xl items-center justify-center relative',
                        isUnavailable && 'bg-red-500/30 border border-red-500/50',
                        isSelected && !isUnavailable && 'bg-amber-500/30 border-2 border-amber-400',
                        !isUnavailable && !isSelected && hasSchedule && 'bg-cyan-500/20 border border-cyan-500/30',
                        !isUnavailable && !isSelected && !hasSchedule && 'bg-slate-800/40',
                        isTodayDate && !isUnavailable && !isSelected && 'border-2 border-cyan-400',
                        isPast && 'opacity-40'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm font-medium',
                          isSelected ? 'text-amber-400' : isUnavailable ? 'text-red-400' : isTodayDate ? 'text-cyan-400' : 'text-white'
                        )}
                      >
                        {format(date, 'd')}
                      </Text>
                      {/* Indicator dots */}
                      <View className="flex-row absolute bottom-1">
                        {isUnavailable && (
                          <View className="w-1.5 h-1.5 rounded-full bg-red-400 mx-0.5" />
                        )}
                        {hasSchedule && !isUnavailable && !isSelected && (
                          <View className="w-1.5 h-1.5 rounded-full bg-cyan-400 mx-0.5" />
                        )}
                        {isSelected && (
                          <View className="w-1.5 h-1.5 rounded-full bg-amber-400 mx-0.5" />
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Selection Mode Actions */}
            {isSelectionMode && (
              <Animated.View
                entering={FadeInDown.springify()}
                className="mt-4 bg-amber-500/10 rounded-xl p-4 border border-amber-500/30"
              >
                <Text className="text-amber-400 font-semibold text-center mb-3">
                  {calendarSelectedDates.length} date{calendarSelectedDates.length !== 1 ? 's' : ''} selected
                </Text>
                <Text className="text-slate-400 text-xs text-center mb-4">
                  Tap more dates to add to selection
                </Text>
                <View className="flex-row">
                  <Pressable
                    onPress={cancelSelection}
                    className="flex-1 bg-slate-700 rounded-xl py-3 mr-2 flex-row items-center justify-center"
                  >
                    <X size={18} color="#94a3b8" />
                    <Text className="text-slate-300 font-semibold ml-2">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAddSelectedDates}
                    className="flex-1 bg-amber-500 rounded-xl py-3 ml-2 flex-row items-center justify-center"
                  >
                    <Check size={18} color="white" />
                    <Text className="text-white font-semibold ml-2">Add Dates</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Legend */}
            <View className="mt-6 bg-slate-800/40 rounded-xl p-4">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Legend
              </Text>
              <View className="flex-row flex-wrap">
                <View className="flex-row items-center mr-6 mb-2">
                  <View className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50 mr-2" />
                  <Text className="text-slate-200 text-sm">Unavailable</Text>
                </View>
                <View className="flex-row items-center mr-6 mb-2">
                  <View className="w-4 h-4 rounded bg-cyan-500/20 border border-cyan-500/30 mr-2" />
                  <Text className="text-slate-200 text-sm">Game/Event</Text>
                </View>
                <View className="flex-row items-center mr-6 mb-2">
                  <View className="w-4 h-4 rounded bg-slate-800/40 border-2 border-cyan-400 mr-2" />
                  <Text className="text-slate-200 text-sm">Today</Text>
                </View>
                <View className="flex-row items-center mb-2">
                  <View className="w-4 h-4 rounded bg-amber-500/30 border-2 border-amber-400 mr-2" />
                  <Text className="text-slate-200 text-sm">Selected</Text>
                </View>
              </View>
              <Text className="text-slate-400 text-xs mt-2">
                Tap dates to select multiple, then add them all at once
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
