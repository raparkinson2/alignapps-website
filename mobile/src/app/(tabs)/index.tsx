import { View, Text, ScrollView, Pressable, Alert, FlatList } from 'react-native';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Edit3,
  CalendarPlus,
  List,
  CalendarDays,
  BarChart3,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore, Game, TeamRecord, Sport, UpcomingGamesViewMode, Poll } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { deleteGameFromSupabase, deleteEventFromSupabase } from '@/lib/realtime-sync';
import { sendPushToPlayers } from '@/lib/notifications';

import { GameCard } from '@/components/home/GameCard';
import { SwipeableGameRow } from '@/components/home/SwipeableGameRow';
import { EventCard } from '@/components/home/EventCard';
import { SwipeableEventRow } from '@/components/home/SwipeableEventRow';
import { CalendarView } from '@/components/home/CalendarView';
import { CreateGameEventModal } from '@/components/home/CreateGameEventModal';
import { EditRecordModal } from '@/components/home/EditRecordModal';
import { LineupViewerModals } from '@/components/home/LineupViewerModals';

import type { Event } from '@/lib/store';
import { syncError } from '@/lib/sync-error-handler';

// Format team record based on sport
const formatTeamRecord = (record: TeamRecord | undefined, sport: Sport): string => {
  if (!record) return '';

  switch (sport) {
    case 'hockey':
      // Hockey: W-L-T-OTL
      return `${record.wins}-${record.losses}-${record.ties ?? 0}-${record.otLosses ?? 0}`;
    case 'basketball':
      // Basketball: W-L
      return `${record.wins}-${record.losses}`;
    case 'soccer':
      // Soccer: W-L-T
      return `${record.wins}-${record.losses}-${record.ties ?? 0}`;
    case 'baseball':
      // Baseball: W-L
      return `${record.wins}-${record.losses}`;
    default:
      return `${record.wins}-${record.losses}`;
  }
};

// Get record label based on sport
const getRecordLabel = (sport: Sport): string => {
  switch (sport) {
    case 'hockey':
      return 'W-L-T-OTL';
    case 'basketball':
    case 'baseball':
      return 'W-L';
    case 'soccer':
      return 'W-L-T';
    default:
      return 'W-L';
  }
};

// Typed union for FlatList items
type ListItem =
  | { kind: 'loading'; id: string }
  | { kind: 'empty' }
  | { kind: 'game'; game: Game; gameIndex: number }
  | { kind: 'event'; event: Event; eventIndex: number };

function ScheduleScreen() {
  const router = useRouter();
  const teamName = useTeamStore((s) => s.teamName);
  const games = useTeamStore((s) => s.games);
  const events = useTeamStore((s) => s.events);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore(useShallow((s) => s.teamSettings));
  const isSyncing = useTeamStore((s) => s.isSyncing);
  const removeGame = useTeamStore((s) => s.removeGame);
  const removeEvent = useTeamStore((s) => s.removeEvent);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const canManageTeam = useTeamStore((s) => s.canManageTeam);
  const releaseScheduledGameInvites = useTeamStore((s) => s.releaseScheduledGameInvites);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const polls = useTeamStore((s) => s.polls);

  // Responsive layout for iPad — must come before viewMode state
  const { columns, containerPadding } = useResponsive();
  const isTablet = Device.deviceType === Device.DeviceType.TABLET;

  // Get persisted view mode from team settings, default to 'list' (tablet always uses 'calendar')
  const persistedViewMode = teamSettings?.upcomingGamesViewMode ?? 'list';

  // Check for scheduled invites that need to be released on mount
  useEffect(() => {
    const releasedGames = releaseScheduledGameInvites();
    if (releasedGames.length > 0) {
      console.log('Released scheduled invites for', releasedGames.length, 'games');
      // Send push notifications to other players for each released game
      releasedGames.forEach((game) => {
        const formattedDate = format(new Date(game.date), 'EEE, MMM d');
        const otherPlayerIds = (game.invitedPlayers ?? []).filter((id) => id !== currentPlayerId);
        if (otherPlayerIds.length > 0) {
          sendPushToPlayers(
            otherPlayerIds,
            'New Game Added!',
            `You've been invited to play vs ${game.opponent} on ${formattedDate} at ${game.time}. Make sure to check in or out in the app.`,
            { gameId: game.id, type: 'game_invite' }
          ).catch(syncError('sync'));
        }
      });
    }
  }, [releaseScheduledGameInvites, currentPlayerId]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRecordModalVisible, setIsRecordModalVisible] = useState(false);
  const [lineupViewerGame, setLineupViewerGame] = useState<Game | null>(null);
  const [viewMode, setViewMode] = useState<UpcomingGamesViewMode>(persistedViewMode);
  // Date pre-selected when tapping an empty calendar cell
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>(undefined);

  // Skeleton pulse animation
  const skeletonOpacity = useSharedValue(0.4);
  useEffect(() => {
    skeletonOpacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
    return () => {
      cancelAnimation(skeletonOpacity);
    };
  }, []);
  const skeletonStyle = useAnimatedStyle(() => ({ opacity: skeletonOpacity.value }));

  // On tablet, always use calendar view. On phone, sync with persisted preference.
  const effectiveViewMode: UpcomingGamesViewMode = isTablet ? 'calendar' : viewMode;

  // Sync local viewMode state when persisted value changes (e.g., on hydration)
  useEffect(() => {
    setViewMode(persistedViewMode);
  }, [persistedViewMode]);

  const sport: Sport = teamSettings?.sport ?? 'hockey';

  // Active polls the current player hasn't voted on yet
  const unansweredPolls = polls.filter((poll) => {
    if (!poll.isActive) return false;
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return false;
    if (!currentPlayerId) return false;
    // Check if player has voted on any option in this poll
    const hasVoted = poll.options.some((opt) => opt.votes.includes(currentPlayerId));
    return !hasVoted;
  });

  // Group by groupId for deduplication (grouped polls count as 1)
  const uniqueUnansweredPolls = unansweredPolls.reduce<Poll[]>((acc, poll) => {
    if (poll.groupId) {
      if (!acc.some((p) => p.groupId === poll.groupId)) acc.push(poll);
    } else {
      acc.push(poll);
    }
    return acc;
  }, []);

  // Sort games by date
  const sortedGames = [...games].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Filter to only show upcoming games (today or future)
  // Games are removed once their date has passed
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingGames = sortedGames.filter((g) => {
    const gameDate = new Date(g.date);
    gameDate.setHours(0, 0, 0, 0);
    return gameDate >= today;
  });

  // Sort and filter upcoming events
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const upcomingEvents = sortedEvents.filter((e) => {
    const eventDate = new Date(e.date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today;
  });

  // Build FlatList data from games + events (or loading/empty states)
  const listData = useMemo<ListItem[]>(() => {
    if (upcomingGames.length === 0 && upcomingEvents.length === 0) {
      if (isSyncing) {
        return [
          { kind: 'loading', id: 'skeleton-0' },
          { kind: 'loading', id: 'skeleton-1' },
          { kind: 'loading', id: 'skeleton-2' },
        ];
      }
      return [{ kind: 'empty' }];
    }
    const items: ListItem[] = [];
    upcomingGames.forEach((game, gameIndex) => {
      items.push({ kind: 'game', game, gameIndex });
    });
    upcomingEvents.forEach((event, eventIndex) => {
      items.push({ kind: 'event', event, eventIndex });
    });
    return items;
  }, [upcomingGames, upcomingEvents, isSyncing]);

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.kind === 'loading') return item.id;
    if (item.kind === 'empty') return 'empty';
    if (item.kind === 'game') return `game-${item.game.id}`;
    return `event-${item.event.id}`;
  }, []);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'loading') {
      return (
        <Animated.View style={[skeletonStyle, { height: 100, borderRadius: 16, backgroundColor: '#1e293b', marginBottom: 12 }]} />
      );
    }

    if (item.kind === 'empty') {
      return (
        <View className="bg-slate-800/50 rounded-2xl p-8 items-center">
          <Calendar size={48} color="#475569" />
          <Text className="text-slate-400 text-center mt-4">
            Nothing scheduled
          </Text>
          {canManageTeam() && (
            <Pressable
              onPress={() => {
                setModalInitialDate(undefined);
                setIsModalVisible(true);
              }}
              className="mt-4 bg-cyan-500 rounded-xl px-6 py-3"
            >
              <Text className="text-white font-semibold">Add Game or Event</Text>
            </Pressable>
          )}
        </View>
      );
    }

    if (item.kind === 'game') {
      const { game, gameIndex } = item;
      return (
        <View
          style={isTablet && columns >= 2 ? {
            width: columns >= 3 ? '33.33%' : '50%',
            paddingHorizontal: 6,
            marginBottom: 12,
          } : undefined}
        >
          <SwipeableGameRow
            game={game}
            index={gameIndex}
            onPress={() => router.push(`/game/${game.id}`)}
            onViewLines={() => setLineupViewerGame(game)}
            canDelete={canManageTeam()}
            onDelete={() => {
              Alert.alert(
                'Delete Game',
                `Are you sure you want to delete the game vs ${game.opponent}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      removeGame(game.id);
                      deleteGameFromSupabase(game.id);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    },
                  },
                ]
              );
            }}
          />
        </View>
      );
    }

    // kind === 'event'
    const { event, eventIndex } = item;
    return (
      <View
        style={isTablet && columns >= 2 ? {
          width: columns >= 3 ? '33.33%' : '50%',
          paddingHorizontal: 6,
          marginBottom: 12,
        } : undefined}
      >
        <SwipeableEventRow
          event={event}
          index={eventIndex}
          onPress={() => router.push(`/event/${event.id}`)}
          canDelete={canManageTeam()}
          onDelete={() => {
            Alert.alert(
              'Delete Event',
              `Are you sure you want to delete "${event.title}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    removeEvent(event.id);
                    deleteEventFromSupabase(event.id).catch(() => {});
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  },
                },
              ]
            );
          }}
        />
      </View>
    );
  }, [isTablet, columns, canManageTeam, removeGame, removeEvent, router, skeletonStyle, setLineupViewerGame]);

  // Poll banner + view toggle — used as ListHeaderComponent and in calendar scroll header
  const listHeader = (
    <>
      {/* Active Poll Banner */}
      {uniqueUnansweredPolls.length > 0 && (
        <Animated.View entering={FadeInDown.delay(30).springify()} className="mb-4">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/polls');
            }}
            className="rounded-2xl overflow-hidden active:opacity-80"
            style={{ borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}
          >
            <LinearGradient
              colors={['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}
            >
              <View className="w-9 h-9 rounded-full bg-amber-500/20 items-center justify-center mr-3">
                <BarChart3 size={18} color="#f59e0b" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-300 font-bold text-sm">
                  {uniqueUnansweredPolls.length === 1 ? 'Vote Now' : `${uniqueUnansweredPolls.length} Polls Need Your Vote`}
                </Text>
                <Text className="text-amber-300/60 text-xs mt-0.5">
                  {uniqueUnansweredPolls.length === 1
                    ? uniqueUnansweredPolls[0]?.groupName || uniqueUnansweredPolls[0]?.question || 'Tap to vote'
                    : 'Tap to see all active polls'}
                </Text>
              </View>
              <View className="bg-amber-500 rounded-full w-6 h-6 items-center justify-center ml-2">
                <Text className="text-white text-xs font-bold">{uniqueUnansweredPolls.length}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Calendar size={18} color="#67e8f9" />
          <Text className="text-cyan-400 text-lg font-semibold ml-2">
            Upcoming
          </Text>
        </View>

        {/* View Toggle — hidden on tablet (always Month view) */}
        {!isTablet && (
          <View className="flex-row bg-slate-800/80 rounded-xl p-1">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setViewMode('list');
                setTeamSettings({ upcomingGamesViewMode: 'list' });
              }}
              className={cn(
                'flex-row items-center px-3 py-1.5 rounded-lg',
                effectiveViewMode === 'list' && 'bg-cyan-500/30'
              )}
            >
              <List size={16} color={effectiveViewMode === 'list' ? '#67e8f9' : '#64748b'} strokeWidth={effectiveViewMode === 'list' ? 2.5 : 2} />
              <Text className={cn('text-xs font-medium ml-1.5', effectiveViewMode === 'list' ? 'text-cyan-300' : 'text-slate-500')}>List</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setViewMode('calendar');
                setTeamSettings({ upcomingGamesViewMode: 'calendar' });
              }}
              className={cn(
                'flex-row items-center px-3 py-1.5 rounded-lg',
                effectiveViewMode === 'calendar' && 'bg-cyan-500/30'
              )}
            >
              <CalendarDays size={16} color={effectiveViewMode === 'calendar' ? '#67e8f9' : '#64748b'} strokeWidth={effectiveViewMode === 'calendar' ? 2.5 : 2} />
              <Text className={cn('text-xs font-medium ml-1.5', effectiveViewMode === 'calendar' ? 'text-cyan-300' : 'text-slate-500')}>Month</Text>
            </Pressable>
          </View>
        )}
      </View>
    </>
  );

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeInRight.delay(50).springify()}
          className="px-5 pt-2 pb-4"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{teamName}</Text>
            {canManageTeam() && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setModalInitialDate(undefined);
                  setIsModalVisible(true);
                }}
              >
                <CalendarPlus size={24} color="#22c55e" />
              </Pressable>
            )}
          </View>
          {/* Team Record */}
          <Pressable
            onPress={() => {
              if (canManageTeam()) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsRecordModalVisible(true);
              }
            }}
            className="mt-0.5"
          >
            {teamSettings.record ? (
              <View className="flex-row items-center">
                <Text className="text-cyan-400 text-base font-semibold">
                  {formatTeamRecord(teamSettings.record, sport)}
                </Text>
                <Text className="text-slate-600 text-xs ml-2">
                  {getRecordLabel(sport)}
                </Text>
                {canManageTeam() && (
                  <Edit3 size={12} color="#475569" style={{ marginLeft: 6 }} />
                )}
              </View>
            ) : canManageTeam() ? (
              <View className="flex-row items-center">
                <Plus size={12} color="#475569" />
                <Text className="text-slate-600 text-xs ml-1">Add Record</Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>

        {/* Schedule Section */}
        {effectiveViewMode === 'list' ? (
          <FlatList
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
            ListHeaderComponent={() => listHeader}
            columnWrapperStyle={isTablet && columns >= 2 ? { marginHorizontal: -6 } : undefined}
            numColumns={isTablet && columns >= 2 ? (columns >= 3 ? 3 : 2) : 1}
            key={isTablet && columns >= 2 ? `grid-${columns >= 3 ? 3 : 2}` : 'list'}
          />
        ) : (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
          >
            {listHeader}
            <CalendarView
              games={sortedGames}
              events={upcomingEvents}
              onSelectGame={(game) => router.push(`/game/${game.id}`)}
              onSelectEvent={(event) => router.push(`/event/${event.id}`)}
              onViewLines={(game) => setLineupViewerGame(game)}
              canManageTeam={canManageTeam()}
              onAddGameOnDate={(date) => {
                setModalInitialDate(date);
                setIsModalVisible(true);
              }}
            />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Create Game/Event Modal */}
      <CreateGameEventModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        initialDate={modalInitialDate}
      />

      {/* Edit Record Modal */}
      <EditRecordModal
        visible={isRecordModalVisible}
        onClose={() => setIsRecordModalVisible(false)}
      />

      {/* Lineup Viewer Modals (hockey, basketball, baseball, softball, soccer, lacrosse) */}
      <LineupViewerModals
        game={lineupViewerGame}
        onClose={() => setLineupViewerGame(null)}
      />
    </View>
  );
}

export default withErrorBoundary(ScheduleScreen);