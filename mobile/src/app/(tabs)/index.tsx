import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform, Switch, Alert } from 'react-native';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, isToday, isTomorrow, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isSameMonth } from 'date-fns';
import { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Plus,
  X,
  Check,
  Beer,
  ChevronDown,
  Edit3,
  CalendarPlus,
  ListOrdered,
  Bell,
  BellOff,
  Send,
  List,
  CalendarDays,
  ChevronLeft,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useTeamStore, Game, Event, TeamRecord, Sport, getPlayerName, InviteReleaseOption, UpcomingGamesViewMode, AppNotification } from '@/lib/store';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { JerseyIcon } from '@/components/JerseyIcon';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { AddressSearch } from '@/components/AddressSearch';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { LineupViewer, hasAssignedPlayers } from '@/components/LineupViewer';
import { BasketballLineupViewer } from '@/components/BasketballLineupViewer';
import { hasAssignedBasketballPlayers } from '@/components/BasketballLineupEditor';
import { BaseballLineupViewer } from '@/components/BaseballLineupViewer';
import { hasAssignedBaseballPlayers } from '@/components/BaseballLineupEditor';
import { SoccerLineupViewer } from '@/components/SoccerLineupViewer';
import { hasAssignedSoccerPlayers } from '@/components/SoccerLineupEditor';
import { sendGameInviteNotification, scheduleGameInviteNotification, sendEventInviteNotification, scheduleEventReminderDayBefore, scheduleEventReminderHourBefore, scheduleGameReminderDayBefore, scheduleGameReminderHoursBefore, sendPushToPlayers } from '@/lib/notifications';
import { pushGameToSupabase, pushEventToSupabase, deleteGameFromSupabase } from '@/lib/realtime-sync';

const getDateLabel = (dateString: string): string => {
  const date = parseISO(dateString);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
};

// Combine a date with a time string (e.g., "7:00 PM") into a single Date object
const combineDateAndTime = (date: Date, timeString: string): Date => {
  const result = new Date(date);

  // Parse time string like "7:00 PM" or "10:30 AM"
  const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    result.setHours(hours, minutes, 0, 0);
  }

  return result;
};

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

// Helper to convert hex codes to readable color names
const hexToColorName = (hex: string): string => {
  const colorMap: Record<string, string> = {
    '#ffffff': 'White',
    '#000000': 'Black',
    '#1a1a1a': 'Black',
    '#ff0000': 'Red',
    '#00ff00': 'Green',
    '#0000ff': 'Blue',
    '#1e40af': 'Blue',
    '#ffff00': 'Yellow',
    '#ff6600': 'Orange',
    '#800080': 'Purple',
    '#ffc0cb': 'Pink',
    '#808080': 'Gray',
    '#a52a2a': 'Brown',
    '#00ffff': 'Cyan',
    '#000080': 'Navy',
    '#008000': 'Green',
    '#c0c0c0': 'Silver',
    '#ffd700': 'Gold',
    '#8b0000': 'Maroon',
    '#2563eb': 'Blue',
    '#dc2626': 'Red',
    '#16a34a': 'Green',
    '#ca8a04': 'Yellow',
    '#9333ea': 'Purple',
    '#ea580c': 'Orange',
  };

  const lowerHex = hex.toLowerCase();
  if (colorMap[lowerHex]) return colorMap[lowerHex];

  // If hex starts with #, try to identify the color family
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Simple color detection
    if (r > 200 && g > 200 && b > 200) return 'White';
    if (r < 50 && g < 50 && b < 50) return 'Black';
    if (r > g && r > b) return r > 150 ? 'Red' : 'Maroon';
    if (g > r && g > b) return 'Green';
    if (b > r && b > g) return 'Blue';
    if (r > 200 && g > 200 && b < 100) return 'Yellow';
    if (r > 200 && g < 150 && b < 100) return 'Orange';
    return 'Gray';
  }

  return hex; // Return as-is if not a recognized format
};

// Helper to convert color names to hex (reverse of hexToColorName)
const colorNameToHex = (name: string): string => {
  const nameMap: Record<string, string> = {
    'white': '#ffffff',
    'black': '#1a1a1a',
    'red': '#dc2626',
    'green': '#16a34a',
    'blue': '#2563eb',
    'yellow': '#ca8a04',
    'orange': '#ea580c',
    'purple': '#9333ea',
    'pink': '#ffc0cb',
    'gray': '#808080',
    'grey': '#808080',
    'brown': '#a52a2a',
    'cyan': '#00ffff',
    'navy': '#000080',
    'silver': '#c0c0c0',
    'gold': '#ffd700',
    'maroon': '#8b0000',
  };
  return nameMap[name.toLowerCase()] || name;
};

interface GameCardProps {
  game: Game;
  index: number;
  onPress: () => void;
  onViewLines: () => void;
  skipAnimation?: boolean;
  hideDateBadge?: boolean;
}

function GameCard({ game, index, onPress, onViewLines, skipAnimation = false, hideDateBadge = false }: GameCardProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const players = useTeamStore((s) => s.players);
  const checkedInCount = game.checkedInPlayers?.length ?? 0;
  const checkedOutCount = game.checkedOutPlayers?.length ?? 0;
  const invitedCount = game.invitedPlayers?.length ?? 0;
  const pendingCount = invitedCount - checkedInCount - checkedOutCount;

  // Get refreshment duty player if assigned and feature is enabled
  const showRefreshmentDuty = teamSettings?.showRefreshmentDuty !== false;
  const is21Plus = teamSettings?.refreshmentDutyIs21Plus !== false;
  const beerDutyPlayer = showRefreshmentDuty && (game.showBeerDuty !== false) && game.beerDutyPlayerId
    ? players.find((p) => p.id === game.beerDutyPlayerId)
    : null;

  // Look up jersey color by name or hex code (handles both cases)
  const safeJerseyColor = game.jerseyColor ?? '#1a1a1a';
  const jerseyColorInfo = (teamSettings?.jerseyColors ?? []).find((c) => c.name === safeJerseyColor || c.color === safeJerseyColor);
  // If found in settings, use the name. Otherwise, try to convert hex to color name
  const jerseyColorName = jerseyColorInfo?.name || hexToColorName(safeJerseyColor);
  const jerseyColorHex = jerseyColorInfo?.color || (safeJerseyColor.startsWith('#') ? safeJerseyColor : colorNameToHex(safeJerseyColor));

  // Check if lines are set (for hockey only)
  const showLinesButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'hockey' && hasAssignedPlayers(game.lineup);
  // Check if lineup is set (for basketball)
  const showBasketballLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'basketball' && hasAssignedBasketballPlayers(game.basketballLineup);
  // Check if lineup is set (for baseball)
  const showBaseballLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'baseball' && hasAssignedBaseballPlayers(game.baseballLineup);
  // Check if lineup is set (for soccer)
  const showSoccerLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'soccer' && hasAssignedSoccerPlayers(game.soccerLineup);

  const cardContent = (
    <Pressable
      onPress={onPress}
      className={cn('active:scale-[0.98]', !skipAnimation && 'mb-3')}
      style={{ transform: [{ scale: 1 }] }}
    >
      <View className="bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700/50">
        {/* Jersey Color Bar */}
        <View style={{ backgroundColor: jerseyColorHex, height: 5 }} />

        <View className="p-3">
          {/* Date Badge & Opponent */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              {!hideDateBadge && (
                <View className="bg-cyan-500/20 px-2 py-px rounded-full mr-2">
                  <Text className="text-cyan-400 text-xs font-medium">
                    {getDateLabel(game.date)}
                  </Text>
                </View>
              )}
              <Text className="text-white text-lg font-bold">vs {game.opponent}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" strokeWidth={2.5} />
          </View>

          {/* Info Grid */}
          <View className="flex-row items-center mb-2">
            <View className="flex-row items-center">
              <Clock size={14} color="#67e8f9" strokeWidth={2} />
              <Text className="text-slate-300 text-sm ml-1.5">{game.time}</Text>
            </View>
            <View className="flex-row items-center ml-4">
              <JerseyIcon size={14} color={jerseyColorHex} />
              <Text className="text-slate-300 text-sm ml-1.5">
                {jerseyColorName}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View className="flex-row items-center mb-2">
            <MapPin size={14} color="#67e8f9" strokeWidth={2} />
            <Text className="text-slate-400 text-sm ml-1.5" numberOfLines={1}>{game.location}</Text>
          </View>

          {/* Game Lines Button */}
          {showLinesButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lines</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Basketball) */}
          {showBasketballLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lineup</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Baseball) */}
          {showBaseballLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lineup</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Soccer) */}
          {showSoccerLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lineup</Text>
            </Pressable>
          )}

          {/* Footer */}
          <View className="flex-row items-center pt-2 border-t border-slate-700/50">
            <View className="flex-row items-center">
              <Users size={14} color="#94a3b8" strokeWidth={2} />
              <View className="flex-row items-center ml-3">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                <Text className="text-slate-400 text-sm">In:</Text>
                <Text className="text-green-400 text-sm font-medium ml-1">{checkedInCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-1" />
                <Text className="text-slate-400 text-sm">Out:</Text>
                <Text className="text-red-400 text-sm font-medium ml-1">{checkedOutCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-slate-500 mr-1" />
                <Text className="text-slate-400 text-sm">Pending:</Text>
                <Text className="text-slate-500 text-sm font-medium ml-1">{pendingCount}</Text>
              </View>
            </View>
            {beerDutyPlayer && (
              <View className="flex-row items-center ml-4">
                {is21Plus ? (
                  <Beer size={14} color="#f59e0b" />
                ) : (
                  <JuiceBoxIcon size={14} color="#a855f7" />
                )}
                <Text className={cn(
                  "text-sm ml-1.5 font-medium",
                  is21Plus ? "text-amber-400" : "text-purple-400"
                )}>
                  {getPlayerName(beerDutyPlayer)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (skipAnimation) {
    return cardContent;
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      {cardContent}
    </Animated.View>
  );
}

interface SwipeableGameCardProps extends GameCardProps {
  onDelete: () => void;
  canDelete: boolean;
}

function SwipeableGameCard({
  onDelete,
  canDelete,
  game,
  index,
  onPress,
  onViewLines,
}: SwipeableGameCardProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const handleDelete = () => {
    translateX.value = withSpring(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  const panGesture = Gesture.Pan()
    .enabled(canDelete)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -100);
      } else {
        translateX.value = withSpring(0);
      }
    })
    .onEnd((event) => {
      if (event.translationX < DELETE_THRESHOLD) {
        translateX.value = withSpring(-80);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 40),
  }));

  if (!canDelete) {
    return <GameCard game={game} index={index} onPress={onPress} onViewLines={onViewLines} />;
  }

  return (
    <View className="relative mb-4 overflow-hidden rounded-2xl">
      {/* Delete button behind */}
      <Animated.View
        style={[deleteButtonStyle, { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 16, borderBottomRightRadius: 16 }]}
      >
        <Pressable
          onPress={handleDelete}
          className="flex-1 w-full items-center justify-center"
        >
          <Trash2 size={24} color="white" />
          <Text className="text-white text-xs font-medium mt-1">Delete</Text>
        </Pressable>
      </Animated.View>

      {/* Swipeable row */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <GameCard game={game} index={index} onPress={onPress} onViewLines={onViewLines} skipAnimation />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// Event Card Component
interface EventCardProps {
  event: Event;
  index: number;
  onPress: () => void;
  skipAnimation?: boolean;
  hideDateBadge?: boolean;
}

function EventCard({ event, index, onPress, skipAnimation = false, hideDateBadge = false }: EventCardProps) {
  const confirmedCount = event.confirmedPlayers?.length ?? 0;
  const declinedCount = event.declinedPlayers?.length ?? 0;
  const invitedCount = event.invitedPlayers?.length ?? 0;
  const pendingCount = invitedCount - confirmedCount - declinedCount;

  // Determine if this is a practice
  const isPractice = event.type === 'practice';

  // Color theming based on type
  const accentColor = isPractice ? '#f97316' : '#3b82f6'; // Orange for practice, blue for event
  const badgeBgClass = isPractice ? 'bg-orange-500/20' : 'bg-blue-500/20';
  const badgeTextClass = isPractice ? 'text-orange-400' : 'text-blue-400';
  const iconColor = isPractice ? '#fb923c' : '#60a5fa';

  const cardContent = (
    <Pressable
      onPress={onPress}
      className={cn('active:scale-[0.98]', !skipAnimation && 'mb-3')}
      style={{ transform: [{ scale: 1 }] }}
    >
      <View className="bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700/50">
        {/* Color Bar based on type */}
        <View style={{ backgroundColor: accentColor, height: 5 }} />

        <View className="p-3">
          {/* Date Badge & Event Title */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center flex-1">
              {!hideDateBadge && (
                <View className={cn(badgeBgClass, 'px-2 py-px rounded-full mr-2')}>
                  <Text className={cn(badgeTextClass, 'text-xs font-medium')}>
                    {getDateLabel(event.date)}
                  </Text>
                </View>
              )}
              <Text className="text-white text-lg font-bold flex-1" numberOfLines={1}>
                {event.title}
              </Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" strokeWidth={2.5} />
          </View>

          {/* Info Grid */}
          <View className="flex-row mb-2">
            <View className="flex-1 flex-row items-center">
              <Clock size={14} color={iconColor} strokeWidth={2} />
              <Text className="text-slate-300 text-sm ml-1.5">{event.time}</Text>
            </View>
            <View className="flex-1 flex-row items-center">
              <Calendar size={14} color={iconColor} strokeWidth={2} />
              <Text className="text-slate-300 text-sm ml-1.5">{isPractice ? 'Practice' : 'Event'}</Text>
            </View>
          </View>

          {/* Location */}
          <View className="flex-row items-center mb-2">
            <MapPin size={14} color={iconColor} strokeWidth={2} />
            <Text className="text-slate-400 text-sm ml-1.5" numberOfLines={1}>{event.location}</Text>
          </View>

          {/* Footer */}
          <View className="flex-row items-center pt-2 border-t border-slate-700/50">
            <View className="flex-row items-center">
              <Users size={14} color="#94a3b8" strokeWidth={2} />
              <View className="flex-row items-center ml-3">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                <Text className="text-slate-400 text-sm">In:</Text>
                <Text className="text-green-400 text-sm font-medium ml-1">{confirmedCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-1" />
                <Text className="text-slate-400 text-sm">Out:</Text>
                <Text className="text-red-400 text-sm font-medium ml-1">{declinedCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-slate-500 mr-1" />
                <Text className="text-slate-400 text-sm">Pending:</Text>
                <Text className="text-slate-500 text-sm font-medium ml-1">{pendingCount}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (skipAnimation) {
    return cardContent;
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      {cardContent}
    </Animated.View>
  );
}

interface SwipeableEventCardProps extends EventCardProps {
  onDelete: () => void;
  canDelete: boolean;
}

function SwipeableEventCard({
  onDelete,
  canDelete,
  event,
  index,
  onPress,
}: SwipeableEventCardProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const handleDelete = () => {
    translateX.value = withSpring(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  const panGesture = Gesture.Pan()
    .enabled(canDelete)
    .activeOffsetX([-10, 10])
    .onUpdate((evt) => {
      if (evt.translationX < 0) {
        translateX.value = Math.max(evt.translationX, -100);
      } else {
        translateX.value = withSpring(0);
      }
    })
    .onEnd((evt) => {
      if (evt.translationX < DELETE_THRESHOLD) {
        translateX.value = withSpring(-80);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 40),
  }));

  if (!canDelete) {
    return <EventCard event={event} index={index} onPress={onPress} />;
  }

  return (
    <View className="relative mb-4 overflow-hidden rounded-2xl">
      {/* Delete button behind */}
      <Animated.View
        style={[deleteButtonStyle, { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 16, borderBottomRightRadius: 16 }]}
      >
        <Pressable
          onPress={handleDelete}
          className="flex-1 w-full items-center justify-center"
        >
          <Trash2 size={24} color="white" />
          <Text className="text-white text-xs font-medium mt-1">Delete</Text>
        </Pressable>
      </Animated.View>

      {/* Swipeable row */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <EventCard event={event} index={index} onPress={onPress} skipAnimation />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface CalendarViewProps {
  games: Game[];
  events: Event[];
  onSelectGame: (game: Game) => void;
  onSelectEvent: (event: Event) => void;
  onViewLines: (game: Game) => void;
  onAddGameOnDate?: (date: Date) => void;
  canManageTeam?: boolean;
}

function CalendarView({ games, events, onSelectGame, onSelectEvent, onViewLines, onAddGameOnDate, canManageTeam = false }: CalendarViewProps) {
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

export default function ScheduleScreen() {
  const router = useRouter();
  const teamName = useTeamStore((s) => s.teamName);
  const games = useTeamStore((s) => s.games);
  const events = useTeamStore((s) => s.events);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const addGame = useTeamStore((s) => s.addGame);
  const addEvent = useTeamStore((s) => s.addEvent);
  const removeGame = useTeamStore((s) => s.removeGame);
  const removeEvent = useTeamStore((s) => s.removeEvent);
  const addNotification = useTeamStore((s) => s.addNotification);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const canManageTeam = useTeamStore((s) => s.canManageTeam);
  const releaseScheduledGameInvites = useTeamStore((s) => s.releaseScheduledGameInvites);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  // Get current player's notification preferences
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const notificationPrefs = currentPlayer?.notificationPreferences;

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
          ).catch(console.error);
        }
      });
    }
  }, [releaseScheduledGameInvites, currentPlayerId]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRecordModalVisible, setIsRecordModalVisible] = useState(false);
  const [lineupViewerGame, setLineupViewerGame] = useState<Game | null>(null);
  const [viewMode, setViewMode] = useState<UpcomingGamesViewMode>(persistedViewMode);

  // On tablet, always use calendar view. On phone, sync with persisted preference.
  const effectiveViewMode: UpcomingGamesViewMode = isTablet ? 'calendar' : viewMode;

  // Sync local viewMode state when persisted value changes (e.g., on hydration)
  useEffect(() => {
    setViewMode(persistedViewMode);
  }, [persistedViewMode]);

  // Toggle between Game, Practice, and Event creation
  const [recordType, setRecordType] = useState<'game' | 'practice' | 'event'>('game');
  const [eventName, setEventName] = useState('');

  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [gameDate, setGameDate] = useState(new Date());
  const [gameTimeValue, setGameTimeValue] = useState('7:00');
  const [gameTimePeriod, setGameTimePeriod] = useState<'AM' | 'PM'>('PM');
  const [selectedJersey, setSelectedJersey] = useState(teamSettings?.jerseyColors?.[0]?.name || '');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBeerDuty, setShowBeerDuty] = useState(teamSettings?.showRefreshmentDuty !== false);
  const [selectedBeerDutyPlayer, setSelectedBeerDutyPlayer] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);

  // Invite release options
  const [inviteReleaseOption, setInviteReleaseOption] = useState<InviteReleaseOption>('now');
  const [inviteReleaseDate, setInviteReleaseDate] = useState(new Date());
  const [showInviteReleaseDatePicker, setShowInviteReleaseDatePicker] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time'>('date');

  // Record editing state
  const [recordWins, setRecordWins] = useState(teamSettings?.record?.wins?.toString() ?? '0');
  const [recordLosses, setRecordLosses] = useState(teamSettings?.record?.losses?.toString() ?? '0');
  const [recordTies, setRecordTies] = useState(teamSettings?.record?.ties?.toString() ?? '0');
  const [recordOtLosses, setRecordOtLosses] = useState(teamSettings?.record?.otLosses?.toString() ?? '0');
  const [recordWinStreak, setRecordWinStreak] = useState(teamSettings?.record?.longestWinStreak?.toString() ?? '0');
  const [recordLosingStreak, setRecordLosingStreak] = useState(teamSettings?.record?.longestLosingStreak?.toString() ?? '0');
  const [recordTeamGoals, setRecordTeamGoals] = useState(teamSettings?.record?.teamGoals?.toString() ?? '0');

  const sport = teamSettings?.sport ?? 'hockey';

  const activePlayers = players.filter((p) => p.status === 'active');
  const reservePlayers = players.filter((p) => p.status === 'reserve');

  // Initialize selected players with active players by default
  const initializeSelectedPlayers = () => {
    setSelectedPlayerIds(activePlayers.map((p) => p.id));
  };

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

  const resetForm = () => {
    setRecordType('game');
    setEventName('');
    setOpponent('');
    setLocation('');
    setGameDate(new Date());
    setGameTimeValue('7:00');
    setGameTimePeriod('PM');
    setSelectedJersey(teamSettings.jerseyColors?.[0]?.name || '');
    setNotes('');
    setShowBeerDuty(false);
    setSelectedBeerDutyPlayer(null);
    setSelectedPlayerIds([]);
    setShowPlayerSelection(false);
    setInviteReleaseOption('now');
    setInviteReleaseDate(new Date());
    setShowInviteReleaseDatePicker(false);
  };

  const handleCreateGame = () => {
    if (!opponent.trim() || !location.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Use selected players or default to active players if none selected
    const invitedPlayerIds = selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : activePlayers.map((p) => p.id);

    // Combine time value and period
    const fullGameTime = `${gameTimeValue.trim() || '7:00'} ${gameTimePeriod}`;

    const newGame: Game = {
      id: Date.now().toString(),
      opponent: opponent.trim(),
      date: gameDate.toISOString(),
      time: fullGameTime,
      location: location.trim(),
      address: '', // Address is now part of location field
      jerseyColor: selectedJersey,
      notes: notes.trim() || undefined,
      checkedInPlayers: [],
      checkedOutPlayers: [],
      invitedPlayers: invitedPlayerIds,
      photos: [],
      showBeerDuty: showBeerDuty,
      beerDutyPlayerId: selectedBeerDutyPlayer || undefined,
      // Invite release settings
      inviteReleaseOption: inviteReleaseOption,
      inviteReleaseDate: inviteReleaseOption === 'scheduled' ? inviteReleaseDate.toISOString() : undefined,
      invitesSent: inviteReleaseOption === 'now', // Only mark as sent if sending now
    };

    addGame(newGame);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushGameToSupabase(newGame, activeTeamId).catch(console.error);
    }

    // Handle notifications based on invite release option
    const formattedDate = format(gameDate, 'EEE, MMM d');

    if (inviteReleaseOption === 'now') {
      // Send local notification to the admin (current user)
      sendGameInviteNotification(newGame.id, opponent.trim(), formattedDate, fullGameTime);
      // Send push notifications to all OTHER invited players via backend
      const otherPlayerIds = invitedPlayerIds.filter((id) => id !== currentPlayerId);
      if (otherPlayerIds.length > 0) {
        sendPushToPlayers(
          otherPlayerIds,
          'New Game Added!',
          `You've been invited to play vs ${opponent.trim()} on ${formattedDate} at ${fullGameTime}. Make sure to check in or out in the app.`,
          { gameId: newGame.id, type: 'game_invite' }
        ).catch(console.error);
      }
    } else if (inviteReleaseOption === 'scheduled') {
      // Schedule notifications for later
      scheduleGameInviteNotification(newGame.id, opponent.trim(), formattedDate, fullGameTime, inviteReleaseDate);
    }
    // If 'none', no notifications are sent - user can send manually from game details

    // Schedule game reminders based on user notification preferences
    const gameDateTime = combineDateAndTime(gameDate, fullGameTime);
    if (notificationPrefs?.gameReminderDayBefore !== false) {
      scheduleGameReminderDayBefore(newGame.id, opponent.trim(), gameDateTime, fullGameTime);
    }
    if (notificationPrefs?.gameReminderHoursBefore !== false) {
      scheduleGameReminderHoursBefore(newGame.id, opponent.trim(), gameDateTime, fullGameTime);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsModalVisible(false);
    resetForm();
  };

  const handleCreateEvent = () => {
    if (!eventName.trim() || !location.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Combine time value and period
    const fullEventTime = `${gameTimeValue.trim() || '7:00'} ${gameTimePeriod}`;

    // Use selected players or default to active players if none selected
    const invitedPlayerIds = selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : activePlayers.map((p) => p.id);

    const newEvent: Event = {
      id: Date.now().toString(),
      title: eventName.trim(),
      type: 'other',
      date: gameDate.toISOString(),
      time: fullEventTime,
      location: location.trim(),
      address: '',
      notes: notes.trim() || undefined,
      invitedPlayers: invitedPlayerIds,
      confirmedPlayers: [],
      inviteReleaseOption: inviteReleaseOption,
      inviteReleaseDate: inviteReleaseOption === 'scheduled' ? inviteReleaseDate.toISOString() : undefined,
      invitesSent: inviteReleaseOption === 'now',
    };

    addEvent(newEvent);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushEventToSupabase(newEvent, activeTeamId).catch(console.error);
    }

    // Send notifications to invited players
    const formattedDate = format(gameDate, 'EEE, MMM d');

    // Only send immediate notification if inviteReleaseOption is 'now'
    if (inviteReleaseOption === 'now') {
      // Send local notification to the admin (current user)
      sendEventInviteNotification(newEvent.id, eventName.trim(), formattedDate, fullEventTime);
      // Send push notifications to all OTHER invited players via backend
      const otherPlayerIds = invitedPlayerIds.filter((id) => id !== currentPlayerId);
      if (otherPlayerIds.length > 0) {
        sendPushToPlayers(
          otherPlayerIds,
          'New Event Added!',
          `You've been invited to "${eventName.trim()}" on ${formattedDate} at ${fullEventTime}. Tap to RSVP.`,
          { eventId: newEvent.id, type: 'event_invite' }
        ).catch(console.error);
      }

      // Create in-app notifications for each invited player
      invitedPlayerIds.forEach((playerId) => {
        const notification: AppNotification = {
          id: `event-invite-${newEvent.id}-${playerId}-${Date.now()}`,
          type: 'event_invite',
          title: 'New Event Added!',
          message: `You've been invited to "${eventName.trim()}" on ${formattedDate} at ${fullEventTime}`,
          eventId: newEvent.id,
          toPlayerId: playerId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        addNotification(notification);
      });

      // Schedule reminders based on user notification preferences
      const eventDateTime = combineDateAndTime(gameDate, fullEventTime);
      if (notificationPrefs?.gameReminderDayBefore !== false) {
        scheduleEventReminderDayBefore(newEvent.id, eventName.trim(), eventDateTime, fullEventTime);
      }
      if (notificationPrefs?.gameReminderHoursBefore !== false) {
        scheduleEventReminderHourBefore(newEvent.id, eventName.trim(), eventDateTime, fullEventTime);
      }
    } else if (inviteReleaseOption === 'scheduled') {
      console.log('Event invites scheduled for:', inviteReleaseDate.toISOString());
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsModalVisible(false);
    resetForm();
  };

  const handleCreatePractice = () => {
    if (!location.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Combine time value and period
    const fullPracticeTime = `${gameTimeValue.trim() || '7:00'} ${gameTimePeriod}`;

    // Use selected players or default to active players if none selected
    const invitedPlayerIds = selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : activePlayers.map((p) => p.id);

    const newPractice: Event = {
      id: Date.now().toString(),
      title: 'Practice',
      type: 'practice',
      date: gameDate.toISOString(),
      time: fullPracticeTime,
      location: location.trim(),
      address: '',
      notes: notes.trim() || undefined,
      invitedPlayers: invitedPlayerIds,
      confirmedPlayers: [],
      inviteReleaseOption: inviteReleaseOption,
      inviteReleaseDate: inviteReleaseOption === 'scheduled' ? inviteReleaseDate.toISOString() : undefined,
      invitesSent: inviteReleaseOption === 'now',
    };

    addEvent(newPractice);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushEventToSupabase(newPractice, activeTeamId).catch(console.error);
    }

    // Send notifications to invited players
    const formattedDate = format(gameDate, 'EEE, MMM d');

    // Only send immediate notification if inviteReleaseOption is 'now'
    if (inviteReleaseOption === 'now') {
      // Send local notification to the admin (current user)
      sendEventInviteNotification(newPractice.id, 'Practice', formattedDate, fullPracticeTime);
      // Send push notifications to all OTHER invited players via backend
      const otherPracticePlayerIds = invitedPlayerIds.filter((id) => id !== currentPlayerId);
      if (otherPracticePlayerIds.length > 0) {
        sendPushToPlayers(
          otherPracticePlayerIds,
          'Practice Scheduled!',
          `Practice on ${formattedDate} at ${fullPracticeTime}. Make sure to check in or out in the app.`,
          { eventId: newPractice.id, type: 'practice_invite' }
        ).catch(console.error);
      }

      // Create in-app notifications for each invited player
      invitedPlayerIds.forEach((playerId) => {
        const notification: AppNotification = {
          id: `practice-invite-${newPractice.id}-${playerId}-${Date.now()}`,
          type: 'practice_invite',
          title: 'Practice Scheduled!',
          message: `Practice on ${formattedDate} at ${fullPracticeTime}`,
          eventId: newPractice.id,
          toPlayerId: playerId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        addNotification(notification);
      });

      // Schedule reminders based on user notification preferences
      const practiceDateTime = combineDateAndTime(gameDate, fullPracticeTime);
      if (notificationPrefs?.gameReminderDayBefore !== false) {
        scheduleEventReminderDayBefore(newPractice.id, 'Practice', practiceDateTime, fullPracticeTime);
      }
      if (notificationPrefs?.gameReminderHoursBefore !== false) {
        scheduleEventReminderHourBefore(newPractice.id, 'Practice', practiceDateTime, fullPracticeTime);
      }
    } else if (inviteReleaseOption === 'scheduled') {
      console.log('Practice invites scheduled for:', inviteReleaseDate.toISOString());
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsModalVisible(false);
    resetForm();
  };

  const handleCreate = () => {
    if (recordType === 'game') {
      handleCreateGame();
    } else if (recordType === 'practice') {
      handleCreatePractice();
    } else {
      handleCreateEvent();
    }
  };

  // Player selection helpers
  const togglePlayer = (playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const selectAllActive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const activeIds = activePlayers.map((p) => p.id);
    setSelectedPlayerIds((prev) => {
      const nonActiveSelected = prev.filter((id) => !activePlayers.find((p) => p.id === id));
      return [...nonActiveSelected, ...activeIds];
    });
  };

  const selectAllReserve = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const reserveIds = reservePlayers.map((p) => p.id);
    setSelectedPlayerIds((prev) => {
      const nonReserveSelected = prev.filter((id) => !reservePlayers.find((p) => p.id === id));
      return [...nonReserveSelected, ...reserveIds];
    });
  };

  const deselectAllActive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds((prev) => prev.filter((id) => !activePlayers.find((p) => p.id === id)));
  };

  const deselectAllReserve = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds((prev) => prev.filter((id) => !reservePlayers.find((p) => p.id === id)));
  };

  const selectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPlayerIds(players.map((p) => p.id));
  };

  const deselectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds([]);
  };

  const isAllActiveSelected = activePlayers.every((p) => selectedPlayerIds.includes(p.id));
  const isAllReserveSelected = reservePlayers.length > 0 && reservePlayers.every((p) => selectedPlayerIds.includes(p.id));

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
                // Reset form values to current record
                setRecordWins(teamSettings.record?.wins?.toString() ?? '0');
                setRecordLosses(teamSettings.record?.losses?.toString() ?? '0');
                setRecordTies(teamSettings.record?.ties?.toString() ?? '0');
                setRecordOtLosses(teamSettings.record?.otLosses?.toString() ?? '0');
                setRecordWinStreak(teamSettings.record?.longestWinStreak?.toString() ?? '0');
                setRecordLosingStreak(teamSettings.record?.longestLosingStreak?.toString() ?? '0');
                setRecordTeamGoals(teamSettings.record?.teamGoals?.toString() ?? '0');
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
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
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

          {effectiveViewMode === 'list' ? (
            <>
              {upcomingGames.length === 0 && upcomingEvents.length === 0 ? (
                <View className="bg-slate-800/50 rounded-2xl p-8 items-center">
                  <Calendar size={48} color="#475569" />
                  <Text className="text-slate-400 text-center mt-4">
                    Nothing scheduled
                  </Text>
                  {canManageTeam() && (
                    <Pressable
                      onPress={() => setIsModalVisible(true)}
                      className="mt-4 bg-cyan-500 rounded-xl px-6 py-3"
                    >
                      <Text className="text-white font-semibold">Add Game or Event</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <>
                  {/* Games - Grid on iPad */}
                  <View className={isTablet && columns >= 2 ? 'flex-row flex-wrap' : ''} style={isTablet && columns >= 2 ? { marginHorizontal: -6 } : undefined}>
                    {upcomingGames.map((game, index) => (
                      <View
                        key={game.id}
                        style={isTablet && columns >= 2 ? {
                          width: columns >= 3 ? '33.33%' : '50%',
                          paddingHorizontal: 6,
                          marginBottom: 12
                        } : undefined}
                      >
                        <SwipeableGameCard
                          game={game}
                          index={index}
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
                    ))}
                  </View>
                  {/* Events - Grid on iPad */}
                  <View className={isTablet && columns >= 2 ? 'flex-row flex-wrap' : ''} style={isTablet && columns >= 2 ? { marginHorizontal: -6 } : undefined}>
                    {upcomingEvents.map((event, index) => (
                      <View
                        key={event.id}
                        style={isTablet && columns >= 2 ? {
                          width: columns >= 3 ? '33.33%' : '50%',
                          paddingHorizontal: 6,
                          marginBottom: 12
                        } : undefined}
                      >
                        <SwipeableEventCard
                          event={event}
                          index={index}
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
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  },
                                },
                              ]
                            );
                          }}
                        />
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <CalendarView
              games={sortedGames}
              events={upcomingEvents}
              onSelectGame={(game) => router.push(`/game/${game.id}`)}
              onSelectEvent={(event) => router.push(`/event/${event.id}`)}
              onViewLines={(game) => setLineupViewerGame(game)}
              canManageTeam={canManageTeam()}
              onAddGameOnDate={(date) => {
                setGameDate(date);
                setIsModalVisible(true);
              }}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Create Game/Event Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">
                {recordType === 'game' ? 'New Game' : recordType === 'practice' ? 'New Practice' : 'New Event'}
              </Text>
              <Pressable onPress={handleCreate}>
                <Text className="text-cyan-400 font-semibold">Create</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
              {/* Game/Practice/Event Toggle */}
              <View className="mb-2">
                <View className="flex-row bg-slate-800/80 rounded-xl p-1">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRecordType('game');
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg items-center',
                      recordType === 'game' && 'bg-cyan-500'
                    )}
                  >
                    <Text className={cn(
                      'text-sm',
                      recordType === 'game' ? 'text-white font-bold' : 'text-slate-400 font-medium'
                    )}>
                      Game
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRecordType('practice');
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg items-center',
                      recordType === 'practice' && 'bg-orange-500'
                    )}
                  >
                    <Text className={cn(
                      'text-sm',
                      recordType === 'practice' ? 'text-white font-bold' : 'text-slate-400 font-medium'
                    )}>
                      Practice
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRecordType('event');
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg items-center',
                      recordType === 'event' && 'bg-blue-500'
                    )}
                  >
                    <Text className={cn(
                      'text-sm',
                      recordType === 'event' ? 'text-white font-bold' : 'text-slate-400 font-medium'
                    )}>
                      Event
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Opponent (Game only) */}
              {recordType === 'game' && (
                <View className="mb-2">
                  <Text className="text-slate-400 text-sm mb-1">Opponent <Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={opponent}
                    onChangeText={setOpponent}
                    placeholder="e.g., Ice Wolves"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base"
                  />
                </View>
              )}

              {/* Event Name (Event only - not for Practice) */}
              {recordType === 'event' && (
                <View className="mb-2">
                  <Text className="text-slate-400 text-sm mb-1">Event Name <Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={eventName}
                    onChangeText={setEventName}
                    placeholder="e.g., Team Practice, Team Dinner"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base"
                  />
                </View>
              )}

              {/* Date */}
              <View className="mb-2">
                <Text className="text-slate-400 text-sm mb-1">Date <Text className="text-red-400">*</Text></Text>
                <Pressable
                  onPress={() => setShowDatePicker(!showDatePicker)}
                  className="bg-slate-800 rounded-xl px-4 py-2.5"
                >
                  <Text className="text-white text-base">
                    {format(gameDate, 'EEEE, MMMM d, yyyy')}
                  </Text>
                </Pressable>
                {showDatePicker && (
                  <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                    <DateTimePicker
                      value={gameDate}
                      mode="date"
                      display="inline"
                      onChange={(event, date) => {
                        if (date) setGameDate(date);
                        if (Platform.OS === 'android') setShowDatePicker(false);
                      }}
                      minimumDate={new Date()}
                      themeVariant="dark"
                      accentColor="#67e8f9"
                    />
                  </View>
                )}
              </View>

              {/* Time */}
              <View className="mb-2">
                <Text className="text-slate-400 text-sm mb-1">Time <Text className="text-red-400">*</Text></Text>
                <View className="flex-row items-center">
                  <TextInput
                    value={gameTimeValue}
                    onChangeText={setGameTimeValue}
                    placeholder="7:00"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base flex-1"
                    keyboardType="numbers-and-punctuation"
                  />
                  <View className="flex-row ml-2">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setGameTimePeriod('AM');
                      }}
                      className={cn(
                        'px-3 py-2.5 rounded-l-xl',
                        gameTimePeriod === 'AM'
                          ? 'bg-cyan-500'
                          : 'bg-slate-800 border border-slate-700'
                      )}
                    >
                      <Text className={cn(
                        'font-semibold',
                        gameTimePeriod === 'AM' ? 'text-white' : 'text-slate-500'
                      )}>
                        AM
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setGameTimePeriod('PM');
                      }}
                      className={cn(
                        'px-3 py-2.5 rounded-r-xl',
                        gameTimePeriod === 'PM'
                          ? 'bg-cyan-500'
                          : 'bg-slate-800 border border-slate-700'
                      )}
                    >
                      <Text className={cn(
                        'font-semibold',
                        gameTimePeriod === 'PM' ? 'text-white' : 'text-slate-500'
                      )}>
                        PM
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Location */}
              <View className="mb-2" style={{ zIndex: 50 }}>
                <Text className="text-slate-400 text-sm mb-1">Location <Text className="text-red-400">*</Text></Text>
                <AddressSearch
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Search for a venue or address..."
                />
              </View>

              {/* Jersey Color (Game only) */}
              {recordType === 'game' && (
                <View className="mb-2">
                  <Text className="text-slate-400 text-sm mb-1">Jersey Color</Text>
                  <View className="flex-row bg-slate-800/80 rounded-xl p-1">
                    {(teamSettings.jerseyColors ?? []).map((color, index) => (
                      <Pressable
                        key={color.name}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedJersey(color.name);
                        }}
                        className={cn(
                          'flex-1 flex-row items-center justify-center py-2 rounded-lg',
                          selectedJersey === color.name
                            ? 'bg-slate-700'
                            : ''
                        )}
                      >
                        <View
                          className={cn(
                            "w-3.5 h-3.5 rounded-full mr-1.5",
                            selectedJersey === color.name ? "border-2 border-white" : "border border-white/30"
                          )}
                          style={{ backgroundColor: color.color }}
                        />
                        <Text
                          className={cn(
                            'text-sm',
                            selectedJersey === color.name ? 'text-white font-bold' : 'text-slate-500 font-medium'
                          )}
                        >
                          {color.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Player Invitations */}
              <View className="mb-2">
                <Pressable
                  onPress={() => {
                    if (!showPlayerSelection && selectedPlayerIds.length === 0) {
                      initializeSelectedPlayers();
                    }
                    setShowPlayerSelection(!showPlayerSelection);
                  }}
                  className="flex-row items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2.5"
                >
                  <View className="flex-row items-center">
                    <Users size={16} color="#67e8f9" />
                    <View className="ml-2.5">
                      <Text className="text-white text-sm font-medium">Invite Players</Text>
                      <Text className="text-slate-400 text-xs">
                        {selectedPlayerIds.length === 0
                          ? 'All active players (default)'
                          : `${selectedPlayerIds.length} player${selectedPlayerIds.length !== 1 ? 's' : ''} selected`}
                      </Text>
                    </View>
                  </View>
                  <ChevronDown
                    size={16}
                    color="#64748b"
                    style={{ transform: [{ rotate: showPlayerSelection ? '180deg' : '0deg' }] }}
                  />
                </Pressable>

                {showPlayerSelection && (
                  <View className="mt-2 bg-slate-800/40 rounded-xl p-3">
                    {/* Group Selection Buttons */}
                    <View className="flex-row mb-3">
                      <Pressable
                        onPress={isAllActiveSelected ? deselectAllActive : selectAllActive}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg mr-2 border items-center',
                          isAllActiveSelected
                            ? 'bg-green-500/20 border-green-500/50'
                            : 'bg-slate-700/50 border-slate-600'
                        )}
                      >
                        <Text className={cn(
                          'font-medium text-xs',
                          isAllActiveSelected ? 'text-green-400' : 'text-slate-400'
                        )}>
                          {isAllActiveSelected ? '✓ Active' : 'Active'} ({activePlayers.length})
                        </Text>
                      </Pressable>
                      {reservePlayers.length > 0 && (
                        <Pressable
                          onPress={isAllReserveSelected ? deselectAllReserve : selectAllReserve}
                          className={cn(
                            'flex-1 py-1.5 rounded-lg mr-2 border items-center',
                            isAllReserveSelected
                              ? 'bg-amber-500/20 border-amber-500/50'
                              : 'bg-slate-700/50 border-slate-600'
                          )}
                        >
                          <Text className={cn(
                            'font-medium text-xs',
                            isAllReserveSelected ? 'text-amber-400' : 'text-slate-400'
                          )}>
                            {isAllReserveSelected ? '✓ Reserve' : 'Reserve'} ({reservePlayers.length})
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={selectedPlayerIds.length === players.length ? deselectAll : selectAll}
                        className={cn(
                          'py-1.5 px-2.5 rounded-lg border items-center',
                          selectedPlayerIds.length === players.length
                            ? 'bg-cyan-500/20 border-cyan-500/50'
                            : 'bg-slate-700/50 border-slate-600'
                        )}
                      >
                        <Text className={cn(
                          'font-medium text-xs',
                          selectedPlayerIds.length === players.length ? 'text-cyan-400' : 'text-slate-400'
                        )}>
                          {selectedPlayerIds.length === players.length ? '✓ All' : 'All'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Active Players */}
                    <Text className="text-green-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                      Active Players
                    </Text>
                    <View className="flex-row flex-wrap mb-3">
                      {activePlayers.map((player) => {
                        const isSelected = selectedPlayerIds.includes(player.id);
                        return (
                          <Pressable
                            key={player.id}
                            onPress={() => togglePlayer(player.id)}
                            className={cn(
                              'flex-row items-center px-2 py-1.5 rounded-lg mr-1.5 mb-1.5 border',
                              isSelected
                                ? 'bg-green-500/20 border-green-500/50'
                                : 'bg-slate-700/50 border-slate-600'
                            )}
                          >
                            <PlayerAvatar player={player} size={20} />
                            <Text className={cn(
                              'font-medium ml-1.5 text-xs',
                              isSelected ? 'text-green-400' : 'text-slate-400'
                            )}>
                              {player.firstName}
                            </Text>
                            {isSelected && <Check size={12} color="#22c55e" style={{ marginLeft: 3 }} />}
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Reserve Players */}
                    {reservePlayers.length > 0 && (
                      <>
                        <Text className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                          Reserve Players
                        </Text>
                        <View className="flex-row flex-wrap">
                          {reservePlayers.map((player) => {
                            const isSelected = selectedPlayerIds.includes(player.id);
                            return (
                              <Pressable
                                key={player.id}
                                onPress={() => togglePlayer(player.id)}
                                className={cn(
                                  'flex-row items-center px-2 py-1.5 rounded-lg mr-1.5 mb-1.5 border',
                                  isSelected
                                    ? 'bg-amber-500/20 border-amber-500/50'
                                    : 'bg-slate-700/50 border-slate-600'
                                )}
                              >
                                <PlayerAvatar player={player} size={20} />
                                <Text className={cn(
                                  'font-medium ml-1.5 text-xs',
                                  isSelected ? 'text-amber-400' : 'text-slate-400'
                                )}>
                                  {player.firstName}
                                </Text>
                                {isSelected && <Check size={12} color="#f59e0b" style={{ marginLeft: 3 }} />}
                              </Pressable>
                            );
                          })}
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* Invite Release Options */}
              <View className="mb-2">
                <Text className="text-slate-400 text-xs mb-1">Release Invites</Text>
                <View className="bg-slate-800/40 rounded-xl p-1.5">
                  {/* Release Now Option */}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setInviteReleaseOption('now');
                      setShowInviteReleaseDatePicker(false);
                    }}
                    className={cn(
                      'flex-row items-center px-2.5 py-2 rounded-lg mb-1 border',
                      inviteReleaseOption === 'now'
                        ? 'bg-green-500/20 border-green-500/50'
                        : 'bg-slate-800/50 border-transparent'
                    )}
                  >
                    <Send size={14} color={inviteReleaseOption === 'now' ? '#22c55e' : '#64748b'} />
                    <View className="ml-2 flex-1">
                      <Text className={cn(
                        'text-sm font-medium',
                        inviteReleaseOption === 'now' ? 'text-green-400' : 'text-slate-500'
                      )}>
                        Release invites now
                      </Text>
                      <Text className={cn('text-[10px]', inviteReleaseOption === 'now' ? 'text-slate-400' : 'text-slate-600')}>
                        Players will be notified immediately
                      </Text>
                    </View>
                    {inviteReleaseOption === 'now' && <Check size={14} color="#22c55e" />}
                  </Pressable>

                  {/* Schedule Release Option */}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setInviteReleaseOption('scheduled');
                      setAndroidPickerMode('date');
                      setShowInviteReleaseDatePicker(true);
                    }}
                    className={cn(
                      'flex-row items-center px-2.5 py-2 rounded-lg mb-1 border',
                      inviteReleaseOption === 'scheduled'
                        ? 'bg-cyan-500/20 border-cyan-500/50'
                        : 'bg-slate-800/50 border-transparent'
                    )}
                  >
                    <Bell size={14} color={inviteReleaseOption === 'scheduled' ? '#22d3ee' : '#64748b'} />
                    <View className="ml-2 flex-1">
                      <Text className={cn(
                        'text-sm font-medium',
                        inviteReleaseOption === 'scheduled' ? 'text-cyan-400' : 'text-slate-500'
                      )}>
                        Schedule release
                      </Text>
                      <Text className={cn('text-[10px]', inviteReleaseOption === 'scheduled' ? 'text-slate-400' : 'text-slate-600')}>
                        Choose when to notify players
                      </Text>
                    </View>
                    {inviteReleaseOption === 'scheduled' && <Check size={14} color="#22d3ee" />}
                  </Pressable>

                  {/* Schedule Date/Time Picker */}
                  {inviteReleaseOption === 'scheduled' && (
                    <View className="mt-1 mb-1">
                      <Pressable
                        onPress={() => {
                          setAndroidPickerMode('date');
                          setShowInviteReleaseDatePicker(!showInviteReleaseDatePicker);
                        }}
                        className="bg-slate-700/80 rounded-lg px-3 py-2"
                      >
                        <Text className="text-cyan-400 text-sm">
                          {format(inviteReleaseDate, 'EEE, MMM d, yyyy h:mm a')}
                        </Text>
                      </Pressable>
                      {showInviteReleaseDatePicker && (
                        <View className="bg-slate-700/80 rounded-xl mt-2 overflow-hidden items-center">
                          {Platform.OS === 'ios' ? (
                            <DateTimePicker
                              value={inviteReleaseDate}
                              mode="datetime"
                              display="inline"
                              onChange={(event, date) => {
                                if (date) setInviteReleaseDate(date);
                              }}
                              minimumDate={new Date()}
                              themeVariant="dark"
                              accentColor="#22d3ee"
                            />
                          ) : (
                            <DateTimePicker
                              value={inviteReleaseDate}
                              mode={androidPickerMode}
                              display="default"
                              onChange={(event, date) => {
                                if (event.type === 'dismissed') {
                                  setShowInviteReleaseDatePicker(false);
                                  setAndroidPickerMode('date');
                                  return;
                                }
                                if (date) {
                                  if (androidPickerMode === 'date') {
                                    // Save the date and show time picker
                                    setInviteReleaseDate(date);
                                    setAndroidPickerMode('time');
                                  } else {
                                    // Time selected, save and close
                                    setInviteReleaseDate(date);
                                    setShowInviteReleaseDatePicker(false);
                                    setAndroidPickerMode('date');
                                  }
                                }
                              }}
                              minimumDate={androidPickerMode === 'date' ? new Date() : undefined}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Don't Send Option */}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setInviteReleaseOption('none');
                      setShowInviteReleaseDatePicker(false);
                    }}
                    className={cn(
                      'flex-row items-center px-2.5 py-2 rounded-lg border',
                      inviteReleaseOption === 'none'
                        ? 'bg-slate-600/50 border-slate-500/50'
                        : 'bg-slate-800/50 border-transparent'
                    )}
                  >
                    <BellOff size={14} color={inviteReleaseOption === 'none' ? '#94a3b8' : '#64748b'} />
                    <View className="ml-2 flex-1">
                      <Text className={cn(
                        'text-sm font-medium',
                        inviteReleaseOption === 'none' ? 'text-slate-300' : 'text-slate-500'
                      )}>
                        Don't send invites
                      </Text>
                      <Text className="text-slate-600 text-[10px]">
                        Send manually later
                      </Text>
                    </View>
                    {inviteReleaseOption === 'none' && <Check size={14} color="#94a3b8" />}
                  </Pressable>
                </View>
              </View>

              {/* Refreshment Duty (Game only) */}
              {recordType === 'game' && teamSettings.showRefreshmentDuty !== false && (
              <View className="mb-2">
                <View className="flex-row items-center justify-between bg-slate-800/60 rounded-xl py-2 px-3">
                  <View className="flex-row items-center">
                    {teamSettings.refreshmentDutyIs21Plus !== false ? (
                      <Beer size={14} color="#f59e0b" />
                    ) : (
                      <JuiceBoxIcon size={14} color="#a855f7" />
                    )}
                    <Text className="text-white font-medium ml-2 text-sm">
                      {teamSettings.sport === 'hockey' && teamSettings.refreshmentDutyIs21Plus !== false
                        ? 'Post Game Beer Duty'
                        : 'Refreshment Duty'}
                    </Text>
                  </View>
                  <Switch
                    value={showBeerDuty}
                    onValueChange={setShowBeerDuty}
                    trackColor={{ false: '#334155', true: teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b40' : '#a855f740' }}
                    thumbColor={showBeerDuty ? (teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b' : '#a855f7') : '#64748b'}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>

                {showBeerDuty && (
                  <View className="mt-1.5">
                    <Text className="text-slate-400 text-[10px] mb-1">Assign Player</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                      <Pressable
                        onPress={() => setSelectedBeerDutyPlayer(null)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg mr-1.5 items-center justify-center border',
                          selectedBeerDutyPlayer === null
                            ? 'bg-amber-500 border-amber-500'
                            : 'bg-slate-800 border-slate-700'
                        )}
                        style={{ height: 32 }}
                      >
                        <Text className={cn(
                          'font-medium text-sm',
                          selectedBeerDutyPlayer === null ? 'text-slate-900' : 'text-slate-400'
                        )}>
                          None
                        </Text>
                      </Pressable>
                      {activePlayers.map((player) => (
                        <Pressable
                          key={player.id}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedBeerDutyPlayer(player.id);
                          }}
                          className={cn(
                            'flex-row items-center px-2 py-1.5 rounded-lg mr-1.5 border',
                            selectedBeerDutyPlayer === player.id
                              ? 'bg-amber-500 border-amber-500'
                              : 'bg-slate-800 border-slate-700'
                          )}
                        >
                          <PlayerAvatar player={player} size={20} />
                          <Text className={cn(
                            'font-medium ml-1.5 text-sm',
                            selectedBeerDutyPlayer === player.id ? 'text-slate-900' : 'text-slate-400'
                          )}>
                            {player.firstName}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              )}

              {/* Notes */}
              <View className="mb-3">
                <Text className="text-slate-400 text-sm mb-1">Notes (Optional)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any additional info..."
                  placeholderTextColor="#64748b"
                  autoCapitalize="sentences"
                  multiline
                  numberOfLines={3}
                  className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base"
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Edit Record Modal */}
      <Modal
        visible={isRecordModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsRecordModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsRecordModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Team Record</Text>
              <Pressable
                onPress={() => {
                  const newRecord: TeamRecord = {
                    wins: parseInt(recordWins, 10) || 0,
                    losses: parseInt(recordLosses, 10) || 0,
                    ties: (sport === 'hockey' || sport === 'soccer') ? (parseInt(recordTies, 10) || 0) : undefined,
                    otLosses: sport === 'hockey' ? (parseInt(recordOtLosses, 10) || 0) : undefined,
                    // Preserve existing streak and goals values (edited in Stats & Analytics)
                    longestWinStreak: teamSettings.record?.longestWinStreak,
                    longestLosingStreak: teamSettings.record?.longestLosingStreak,
                    teamGoals: teamSettings.record?.teamGoals,
                  };
                  setTeamSettings({ record: newRecord });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setIsRecordModalVisible(false);
                }}
              >
                <Text className="text-cyan-400 font-semibold">Save</Text>
              </Pressable>
            </View>

            <View className="px-5 pt-6">
              <Text className="text-slate-400 text-sm mb-4">
                Format: {getRecordLabel(sport)}
              </Text>

              <View className="flex-row flex-wrap">
                {/* Wins */}
                <View className="w-1/2 pr-2 mb-4">
                  <Text className="text-slate-400 text-sm mb-2">Wins</Text>
                  <TextInput
                    value={recordWins}
                    onChangeText={setRecordWins}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                  />
                </View>

                {/* Losses */}
                <View className="w-1/2 pl-2 mb-4">
                  <Text className="text-slate-400 text-sm mb-2">Losses</Text>
                  <TextInput
                    value={recordLosses}
                    onChangeText={setRecordLosses}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                  />
                </View>

                {/* Ties (Hockey, Soccer) */}
                {(sport === 'hockey' || sport === 'soccer') && (
                  <View className="w-1/2 pr-2 mb-4">
                    <Text className="text-slate-400 text-sm mb-2">Ties</Text>
                    <TextInput
                      value={recordTies}
                      onChangeText={setRecordTies}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#64748b"
                      className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                    />
                  </View>
                )}

                {/* OT Losses (Hockey only) */}
                {sport === 'hockey' && (
                  <View className="w-1/2 pl-2 mb-4">
                    <Text className="text-slate-400 text-sm mb-2">OT Losses</Text>
                    <TextInput
                      value={recordOtLosses}
                      onChangeText={setRecordOtLosses}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#64748b"
                      className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                    />
                  </View>
                )}
              </View>

              {/* Clear record button */}
              {teamSettings.record && (
                <Pressable
                  onPress={() => {
                    setTeamSettings({ record: undefined });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setIsRecordModalVisible(false);
                  }}
                  className="mt-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10"
                >
                  <Text className="text-red-400 text-center font-medium">Clear Record</Text>
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Lineup Viewer Modal (Hockey) */}
      {lineupViewerGame?.lineup && teamSettings.sport === 'hockey' && (
        <LineupViewer
          visible={!!lineupViewerGame}
          onClose={() => setLineupViewerGame(null)}
          lineup={lineupViewerGame.lineup}
          players={players}
          opponent={lineupViewerGame.opponent}
        />
      )}

      {/* Basketball Lineup Viewer Modal */}
      {lineupViewerGame?.basketballLineup && teamSettings.sport === 'basketball' && (
        <BasketballLineupViewer
          visible={!!lineupViewerGame}
          onClose={() => setLineupViewerGame(null)}
          lineup={lineupViewerGame.basketballLineup}
          players={players}
          opponent={lineupViewerGame.opponent}
        />
      )}

      {/* Baseball Lineup Viewer Modal */}
      {lineupViewerGame?.baseballLineup && teamSettings.sport === 'baseball' && (
        <BaseballLineupViewer
          visible={!!lineupViewerGame}
          onClose={() => setLineupViewerGame(null)}
          lineup={lineupViewerGame.baseballLineup}
          players={players}
          opponent={lineupViewerGame.opponent}
          isSoftball={teamSettings.isSoftball}
        />
      )}

      {/* Soccer Lineup Viewer Modal */}
      {lineupViewerGame?.soccerLineup && teamSettings.sport === 'soccer' && (
        <SoccerLineupViewer
          visible={!!lineupViewerGame}
          onClose={() => setLineupViewerGame(null)}
          lineup={lineupViewerGame.soccerLineup}
          players={players}
          opponent={lineupViewerGame.opponent}
        />
      )}
    </View>
  );
}
