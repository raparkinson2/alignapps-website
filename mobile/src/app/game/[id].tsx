import { View, Text, ScrollView, Pressable, Platform, Alert, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useState, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import { fetchAndSaveWeather } from '@/lib/weather-service';
import {
  MapPin,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Circle,
  Navigation,
  Beer,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
  UserPlus,
  ListOrdered,
  Send,
  Calendar,
  FileText,
  Trophy,
  Minus,
  BarChart3,
  Check,
  Eye,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useTeamStore, Player, SPORT_POSITION_NAMES, AppNotification, getPlayerName, Sport } from '@/lib/store';
import { cn } from '@/lib/cn';
import { pushGameToSupabase, pushGameResponseToSupabase, pushNotificationToSupabase, deleteGameFromSupabase, pushTeamToSupabase, pushGameViewedToSupabase } from '@/lib/realtime-sync';
import { sendPushToPlayers, scheduleGameReminderDayBefore, scheduleGameReminderHoursBefore } from '@/lib/notifications';
import { JerseyIcon } from '@/components/JerseyIcon';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { GameLineupDisplay } from '@/components/game/GameLineupDisplay';
import { GameInlineEditModals } from '@/components/game/GameInlineEditModals';
import { GameSettingsModal } from '@/components/game/GameSettingsModal';
import { BeerDutyModal } from '@/components/game/BeerDutyModal';
import { EditGameModal } from '@/components/game/EditGameModal';
import { ReleaseInvitesModal } from '@/components/game/ReleaseInvitesModal';
import { InvitePlayersModal } from '@/components/game/InvitePlayersModal';
import { GameStatsModal, GameStatEditMode } from '@/components/game/GameStatsModal';
import { SoccerFormationModal } from '@/components/game/SoccerFormationModal';
import { LineupModals } from '@/components/game/LineupModals';
import { syncError } from '@/lib/sync-error-handler';
import {
  hexToColorName,
  colorNameToHex,
  isGoalie,
  playerIsGoalie,
  isPitcher,
  playerIsPitcher,
  playerHasNonPitcherPositions,
  playerHasNonGoaliePositions,
  getDisplayPosition,
  formatShortName,
  getGameStatHeaders,
  getGameGoalieHeaders,
  getGamePitcherHeaders,
  getGameStatValuesForPlayer,
  playerHasGameStats,
  getGameStatFields,
} from '@/lib/game-utils';

// Error boundary to catch render crashes and show a useful error instead of black screen
class GameScreenErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || String(error) };
  }
  componentDidCatch(error: Error) {
    console.error('GameDetailScreen render crash:', error?.message, error?.stack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Error loading game</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

interface PlayerRowProps {
  player: Player;
  status: 'in' | 'out' | 'none'; // IN, OUT, or no response
  onToggle: () => void;
  index: number;
  canToggle: boolean; // Whether the current user can toggle this player's check-in
  isSelf: boolean; // Whether this is the current user's row
  isAssociatedChild?: boolean; // Whether current user is a parent of this player
  hasViewed?: boolean;
  showViewedBadge?: boolean;
}

function PlayerRow({ player, status, onToggle, index, canToggle, isSelf, isAssociatedChild, hasViewed, showViewedBadge }: PlayerRowProps) {
  const sport = useTeamStore((s) => s.teamSettings.sport);
  const positionName = SPORT_POSITION_NAMES[sport][player.position] || player.position;

  const handlePress = () => {
    if (!canToggle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        onPress={handlePress}
        disabled={!canToggle}
        className={cn(
          'flex-row items-center p-3 rounded-xl mb-2',
          status === 'in' ? 'bg-green-500/20' : status === 'out' ? 'bg-red-500/20' : 'bg-slate-800/60'
        )}
      >
        <View className="relative">
          <PlayerAvatar player={player} size={44} />
          {status === 'in' && (
            <View className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
              <CheckCircle2 size={14} color="white" />
            </View>
          )}
          {status === 'out' && (
            <View className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5">
              <XCircle size={14} color="white" />
            </View>
          )}
          {isSelf && (
            <View className="absolute -top-1 -right-1 bg-cyan-500 rounded-full px-1.5 py-0.5">
              <Text className="text-white text-[8px] font-bold">YOU</Text>
            </View>
          )}
          {isAssociatedChild && !isSelf && (
            <View className="absolute -top-1 -right-1 bg-amber-500 rounded-full px-1.5 py-0.5">
              <Text className="text-white text-[8px] font-bold">CHILD</Text>
            </View>
          )}
        </View>

        <View className="flex-1 ml-3">
          <Text className="text-white font-semibold">{getPlayerName(player)}</Text>
          <Text className="text-slate-400 text-xs">#{player.number} · {positionName}</Text>
          {showViewedBadge && hasViewed && status === 'none' && (
            <View className="flex-row items-center mt-0.5">
              <Eye size={10} color="#22d3ee" />
              <Text className="text-cyan-400 text-[10px] ml-0.5">Viewed</Text>
            </View>
          )}
        </View>

        {status === 'in' ? (
          <CheckCircle2 size={24} color="#22c55e" />
        ) : status === 'out' ? (
          <XCircle size={24} color="#ef4444" />
        ) : (
          <Circle size={24} color="#475569" />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function GameDetailScreen() {
  return (
    <GameScreenErrorBoundary>
      <GameDetailScreenInner />
    </GameScreenErrorBoundary>
  );
}

function GameDetailScreenInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const checkInToGame = useTeamStore((s) => s.checkInToGame);
  const checkOutFromGame = useTeamStore((s) => s.checkOutFromGame);
  const clearPlayerResponse = useTeamStore((s) => s.clearPlayerResponse);
  const addNotification = useTeamStore((s) => s.addNotification);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const updateGame = useTeamStore((s) => s.updateGame);
  const removeGame = useTeamStore((s) => s.removeGame);

  // Wrapper: updates local store AND pushes to Supabase so other users see changes
  const updateGameAndSync = (gameId: string, updates: Parameters<typeof updateGame>[1]) => {
    updateGame(gameId, updates);
    if (activeTeamId) {
      const currentGame = useTeamStore.getState().games.find((g) => g.id === gameId);
      if (currentGame) {
        pushGameToSupabase({ ...currentGame, ...updates } as any, activeTeamId).catch(syncError('sync'));
      }
    }
  };
  const canManageTeam = useTeamStore((s) => s.canManageTeam);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const markEventViewedLocally = useTeamStore((s) => s.markEventViewedLocally);
  const localViewedEventIds = useTeamStore((s) => s.localViewedEventIds);

  // Get current player and check their roles for stats permissions
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isCoach = currentPlayer?.roles?.includes('coach') ?? false;
  const canManageStats = canManageTeam() || isCoach;

  // Parent/guardian: detect if current user is a parent with an associated player (child)
  // Parent portal features (child check-in) require the team to be on a premium plan
  const isParent = currentPlayer?.roles?.includes('parent') ?? false;
  const teamIsPremium = teamSettings?.isPremium ?? false;
  const associatedChildId = (isParent && teamIsPremium) ? (currentPlayer?.associatedPlayerId ?? null) : null;


  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isBeerDutyModalVisible, setIsBeerDutyModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  // Inline edit modal states
  const [isEditOpponentModalVisible, setIsEditOpponentModalVisible] = useState(false);
  const [isEditDateModalVisible, setIsEditDateModalVisible] = useState(false);
  const [isEditTimeModalVisible, setIsEditTimeModalVisible] = useState(false);
  const [isEditJerseyModalVisible, setIsEditJerseyModalVisible] = useState(false);
  const [isEditLocationModalVisible, setIsEditLocationModalVisible] = useState(false);
  const [isEditNotesModalVisible, setIsEditNotesModalVisible] = useState(false);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isLineupModalVisible, setIsLineupModalVisible] = useState(false);
  const [isBasketballLineupModalVisible, setIsBasketballLineupModalVisible] = useState(false);
  const [isBaseballLineupModalVisible, setIsBaseballLineupModalVisible] = useState(false);
  const [isSoccerLineupModalVisible, setIsSoccerLineupModalVisible] = useState(false);
  const [isSoccerDiamondLineupModalVisible, setIsSoccerDiamondLineupModalVisible] = useState(false);
  const [isSoccerFormationModalVisible, setIsSoccerFormationModalVisible] = useState(false);
  const [isLacrosseLineupModalVisible, setIsLacrosseLineupModalVisible] = useState(false);
  const [isBattingOrderModalVisible, setIsBattingOrderModalVisible] = useState(false);
  const [isReleaseInvitesModalVisible, setIsReleaseInvitesModalVisible] = useState(false);


  // Final score state
  const [scoreUs, setScoreUs] = useState('');
  const [scoreThem, setScoreThem] = useState('');
  const [selectedResult, setSelectedResult] = useState<'win' | 'loss' | 'tie' | 'otLoss' | null>(null);
  const [isFinalScoreExpanded, setIsFinalScoreExpanded] = useState(false);

  // Game stats state
  const [isGameStatsExpanded, setIsGameStatsExpanded] = useState(false);
  const [isGameStatsModalVisible, setIsGameStatsModalVisible] = useState(false);
  const [selectedStatsPlayer, setSelectedStatsPlayer] = useState<Player | null>(null);
  const [gameStatsEditMode, setGameStatsEditMode] = useState<GameStatEditMode>('skater');
  const [editGameStats, setEditGameStats] = useState<Record<string, string>>({});

  const game = games.find((g) => g.id === id);
  const [gameNotFoundTimeout, setGameNotFoundTimeout] = useState(false);

  useEffect(() => {
    if (!game) {
      const t = setTimeout(() => setGameNotFoundTimeout(true), 3000);
      return () => clearTimeout(t);
    } else {
      setGameNotFoundTimeout(false);
    }
  }, [game]);

  // Initialize final score state from game data
  useEffect(() => {
    if (game) {
      setScoreUs(game.finalScoreUs?.toString() ?? '');
      setScoreThem(game.finalScoreThem?.toString() ?? '');
      setSelectedResult(game.gameResult ?? null);
    }
  }, [game?.id, game?.finalScoreUs, game?.finalScoreThem, game?.gameResult]);

  // Auto-purge coaches/parents from invitedPlayers if they were added before role filtering was introduced
  useEffect(() => {
    if (!game?.invitedPlayers?.length) return;
    const coachParentIds = new Set(
      players
        .filter((p) => p.position === 'Coach' || p.position === 'Parent' || p.roles?.includes('coach') || p.roles?.includes('parent'))
        .map((p) => p.id)
    );
    const hasCoachOrParent = game.invitedPlayers.some((id) => coachParentIds.has(id));
    if (hasCoachOrParent) {
      updateGameAndSync(game.id, {
        invitedPlayers: game.invitedPlayers.filter((id) => !coachParentIds.has(id)),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  // Track that this player has viewed the game
  useEffect(() => {
    if (!game || !currentPlayerId) return;
    markEventViewedLocally(game.id);
    pushGameViewedToSupabase(game.id, currentPlayerId).catch(syncError('sync'));
  }, [game?.id, currentPlayerId]);

  if (!game) {
    if (!gameNotFoundTimeout) {
      return (
        <View className="flex-1 bg-slate-900 items-center justify-center">
          <Text className="text-slate-400">Loading...</Text>
        </View>
      );
    }
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center">
        <Text className="text-white">Game not found</Text>
      </View>
    );
  }

  // Deduplicate players array before filtering to prevent double-renders from race conditions
  const uniquePlayers = players.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);
  // Helper to check if a player is a coach or parent (should be excluded from check-in and lineups)
  const isCoachOrParent = (p: Player) =>
    p.position === 'Coach' || p.position === 'Parent' ||
    p.roles?.includes('coach') || p.roles?.includes('parent');
  // Only non-coach/parent players participate in check-in
  const eligiblePlayers = uniquePlayers.filter((p) => !isCoachOrParent(p));
  const checkedInCount = game.checkedInPlayers?.filter((id) => eligiblePlayers.some((p) => p.id === id)).length ?? 0;
  const checkedOutCount = game.checkedOutPlayers?.filter((id) => eligiblePlayers.some((p) => p.id === id)).length ?? 0;
  const checkedInPlayers = eligiblePlayers.filter((p) => game.checkedInPlayers?.includes(p.id));
  const invitedPlayers = eligiblePlayers.filter((p) => game.invitedPlayers?.includes(p.id));
  const pendingCount = invitedPlayers.length - checkedInCount - checkedOutCount;

  // Sort invited players: checked in first, then pending, then checked out
  const sortedInvitedPlayers = [...invitedPlayers].sort((a, b) => {
    const statusOrder = { in: 0, none: 1, out: 2 };
    const aStatus = game.checkedInPlayers?.includes(a.id) ? 'in' : game.checkedOutPlayers?.includes(a.id) ? 'out' : 'none';
    const bStatus = game.checkedInPlayers?.includes(b.id) ? 'in' : game.checkedOutPlayers?.includes(b.id) ? 'out' : 'none';
    return statusOrder[aStatus] - statusOrder[bStatus];
  });

  // If the current player isn't invited yet, show their row at the top so they can self-check-in
  // Only show self-check-in if the current player is not a coach or parent
  const currentPlayerInList = sortedInvitedPlayers.some((p) => p.id === currentPlayerId);
  const currentPlayerObjRaw = !currentPlayerInList && currentPlayerId ? players.find((p) => p.id === currentPlayerId) : null;
  const currentPlayerObj = currentPlayerObjRaw && !isCoachOrParent(currentPlayerObjRaw) ? currentPlayerObjRaw : null;

  // If current user is a parent, also ensure their associated child appears at the top if not already invited
  const associatedChildInList = associatedChildId ? sortedInvitedPlayers.some((p) => p.id === associatedChildId) : false;
  const associatedChildObj = (isParent && associatedChildId && !associatedChildInList)
    ? players.find((p) => p.id === associatedChildId) ?? null
    : null;

  const playersToDisplay = [
    ...(currentPlayerObj ? [currentPlayerObj] : []),
    ...(associatedChildObj ? [associatedChildObj] : []),
    ...sortedInvitedPlayers,
  ];

  const beerDutyPlayer = game.beerDutyPlayerId ? uniquePlayers.find((p) => p.id === game.beerDutyPlayerId) : null;

  // Get jersey color info - handle both color name and hex code
  // Safely handle undefined/null jerseyColor from Supabase
  const safeJerseyColor = game.jerseyColor ?? '#1a1a1a';
  const jerseyColorInfo = teamSettings.jerseyColors.find((c) => c.name === safeJerseyColor || c.color === safeJerseyColor);
  // If found in settings, use the name. Otherwise, try to convert hex to color name
  const jerseyColorName = jerseyColorInfo?.name || hexToColorName(safeJerseyColor);
  const jerseyColorHex = jerseyColorInfo?.color || (safeJerseyColor.startsWith('#') ? safeJerseyColor : colorNameToHex(safeJerseyColor));

  // Create gradient colors based on jersey color
  const getGradientColors = (hexColor: string): [string, string, string] => {
    // Darken the color for the gradient
    const darkenColor = (hex: string, amount: number): string => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, (num >> 16) - amount);
      const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
      const b = Math.max(0, (num & 0x0000ff) - amount);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    };

    return [hexColor, darkenColor(hexColor, 40), '#0f172a'];
  };

  const gradientColors = getGradientColors(jerseyColorHex || '#1a1a1a');

  const handleToggleCheckIn = (playerId: string) => {
    const isIn = game.checkedInPlayers?.includes(playerId);
    const isOut = game.checkedOutPlayers?.includes(playerId);
    const isInvited = game.invitedPlayers?.includes(playerId);

    // If the player isn't yet in invitedPlayers (self-check-in by a non-invited player),
    // add them to the invite list first so they appear for everyone.
    if (!isInvited && activeTeamId) {
      const currentInvited = game.invitedPlayers ?? [];
      if (!currentInvited.includes(playerId)) {
        updateGameAndSync(game.id, {
          invitedPlayers: [...currentInvited, playerId],
        });
      }
      pushGameResponseToSupabase(game.id, playerId, 'invited').catch(syncError('sync'));
    }

    // Cycle through: none -> in -> out -> none
    if (!isIn && !isOut) {
      // Currently no response, mark as IN
      checkInToGame(game.id, playerId);
      if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'in').catch(syncError('sync'));

      // Schedule local reminders on this device if it's the current player checking themselves in
      if (playerId === currentPlayerId) {
        const notificationPrefs = players.find((p) => p.id === currentPlayerId)?.notificationPreferences;
        const gameDate = parseISO(game.date);
        // Parse time string like "7:00 PM" into a full Date
        const timeMatch = game.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const isPM = timeMatch[3].toUpperCase() === 'PM';
          const gameDateTime = new Date(gameDate);
          gameDateTime.setHours(isPM && hours !== 12 ? hours + 12 : !isPM && hours === 12 ? 0 : hours, minutes, 0, 0);
          if (notificationPrefs?.gameReminderDayBefore !== false) {
            scheduleGameReminderDayBefore(game.id, game.opponent, gameDateTime, game.time);
          }
          if (notificationPrefs?.gameReminderHoursBefore !== false) {
            scheduleGameReminderHoursBefore(game.id, game.opponent, gameDateTime, game.time);
          }
        }
      }
    } else if (isIn) {
      // Currently IN, mark as OUT - cancel any scheduled reminders on this device
      checkOutFromGame(game.id, playerId);
      if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'out').catch(syncError('sync'));
      if (playerId === currentPlayerId) {
        Notifications.cancelAllScheduledNotificationsAsync().catch(syncError('sync'));
      }
    } else {
      // Currently OUT, clear response (back to invited)
      clearPlayerResponse(game.id, playerId);
      if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'invited').catch(syncError('sync'));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getPlayerStatus = (playerId: string): 'in' | 'out' | 'none' => {
    if (game.checkedInPlayers?.includes(playerId)) return 'in';
    if (game.checkedOutPlayers?.includes(playerId)) return 'out';
    return 'none';
  };

  // Check if user can edit a specific player's game stats
  const canEditPlayerStats = (playerId: string): boolean => {
    // Admins, captains, and coaches can edit anyone's stats
    if (canManageStats) return true;
    // If allowPlayerSelfStats is enabled, players can edit their own stats
    if (teamSettings.allowPlayerSelfStats && playerId === currentPlayerId) return true;
    return false;
  };

  // Open game stats modal for a player
  const openGameStatsModal = (player: Player, mode: GameStatEditMode) => {
    if (!canEditPlayerStats(player.id) || !game) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStatsPlayer(player);
    setGameStatsEditMode(mode);

    // Determine which position to use for getting stat fields based on mode
    let positionForStats: string;
    let statType: string;
    if (mode === 'pitcher') {
      positionForStats = 'P';
      statType = 'pitcher';
    } else if (mode === 'goalie' || mode === 'lacrosse_goalie') {
      positionForStats = teamSettings.sport === 'soccer' ? 'GK' : 'G';
      statType = mode === 'lacrosse_goalie' ? 'lacrosse_goalie' : 'goalie';
    } else if (mode === 'lacrosse') {
      positionForStats = 'batter';
      statType = 'lacrosse';
    } else if (mode === 'batter') {
      positionForStats = 'batter';
      statType = 'batter';
    } else {
      positionForStats = 'batter';
      statType = 'skater';
    }

    const statFields = getGameStatFields(teamSettings.sport, positionForStats);

    // Check if there's existing stats for this game
    const existingLog = (player.gameLogs || []).find(
      log => (log.gameId === game.id || log.id.startsWith(game.id)) && log.statType === statType
    );

    const statsObj: Record<string, string> = {};
    if (existingLog) {
      // Load existing stats
      const existingStats = existingLog.stats as unknown as Record<string, number>;
      statFields.forEach((field) => {
        statsObj[field.key] = String(existingStats[field.key] ?? 0);
      });
    } else {
      // Start with empty stats (zeros) for entering this game's stats
      statFields.forEach((field) => {
        statsObj[field.key] = '0';
      });
    }
    setEditGameStats(statsObj);
    setIsGameStatsModalVisible(true);
  };

  const handleOpenMaps = () => {
    const locationQuery = game.address
      ? `${game.location}, ${game.address}`
      : game.location;
    const encodedAddress = encodeURIComponent(locationQuery);
    Linking.openURL(`https://maps.apple.com/?q=${encodedAddress}`);
  };

  const handleSendInAppNotification = async (type: 'invite' | 'reminder') => {
    const gameDate = parseISO(game.date);
    const dateStr = format(gameDate, 'EEEE, MMMM d');

    const title = type === 'invite' ? 'Game Invite' : 'Game Reminder';
    const message = type === 'invite'
      ? `You're invited to play vs ${game.opponent} on ${dateStr} at ${game.time}. Wear your ${jerseyColorName} jersey!`
      : `Reminder: Game vs ${game.opponent} is coming up on ${dateStr} at ${game.time}. Don't forget your ${jerseyColorName} jersey!`;

    // For reminders, only send to players who haven't checked out
    // For invites (mass), send to all invited players
    const targetPlayers = type === 'reminder'
      ? invitedPlayers.filter((p) => !game.checkedOutPlayers?.includes(p.id))
      : invitedPlayers;

    if (targetPlayers.length === 0) {
      Alert.alert('No Players', 'No players to send reminders to.');
      return;
    }

    // Only send push notification if current user is one of the target players
    // Local push notifications only work on the current device
    const isCurrentUserTargeted = currentPlayerId && targetPlayers.some((p) => p.id === currentPlayerId);
    if (isCurrentUserTargeted) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: message,
            data: { gameId: game.id, type: type === 'invite' ? 'game_invite' : 'game_reminder' },
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
          },
          trigger: null, // Send immediately
        });
      } catch (error) {
        console.log('Could not send push notification:', error);
      }
    }

    // Send real push notifications to all target players using fresh tokens
    sendPushToPlayers(
      targetPlayers.map((p) => p.id),
      title,
      message,
      {
        gameId: game.id,
        type: type === 'invite' ? 'game_invite' : 'game_reminder',
      }
    ).catch(syncError('sync'));

    // Add to in-app notifications for target players only
    targetPlayers.forEach((player) => {
      const notification: AppNotification = {
        id: `${Date.now()}-${player.id}`,
        type: type === 'invite' ? 'game_invite' : 'game_reminder',
        title,
        message,
        gameId: game.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: player.id,
        createdAt: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(syncError('sync'));
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Notifications Sent',
      `${type === 'invite' ? 'Game invites' : 'Reminders'} sent to ${targetPlayers.length} player${targetPlayers.length !== 1 ? 's' : ''}!`
    );
  };

  const handleSelectBeerDutyPlayer = (playerId: string | undefined) => {
    updateGameAndSync(game.id, { beerDutyPlayerId: playerId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsBeerDutyModalVisible(false);
  };

  const openEditModal = () => {
    setIsSettingsModalVisible(false);
    setIsEditModalVisible(true);
  };

  // Inline edit handlers — open the modal; each modal manages its own form state
  const openEditOpponentModal = () => { setIsEditOpponentModalVisible(true); };
  const openEditDateModal = () => { setIsEditDateModalVisible(true); };
  const openEditTimeModal = () => { setIsEditTimeModalVisible(true); };
  const openEditJerseyModal = () => { setIsEditJerseyModalVisible(true); };
  const openEditLocationModal = () => { setIsEditLocationModalVisible(true); };

  const handleDeleteGame = () => {
    Alert.alert(
      'Delete Game',
      `Are you sure you want to delete the game vs ${game.opponent}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeGame(game.id);
            deleteGameFromSupabase(game.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const handleSaveFinalScore = () => {
    if (!selectedResult) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const usScore = scoreUs ? parseInt(scoreUs, 10) : undefined;
    const themScore = scoreThem ? parseInt(scoreThem, 10) : undefined;

    // Update game with final score
    updateGameAndSync(game.id, {
      finalScoreUs: usScore,
      finalScoreThem: themScore,
      gameResult: selectedResult,
      resultRecorded: true,
    });

    // Auto-fetch weather in background for past games
    if (activeTeamId) {
      const updatedGame = { ...game, finalScoreUs: usScore, finalScoreThem: themScore, gameResult: selectedResult };
      fetchAndSaveWeather(updatedGame as any, activeTeamId).catch(() => {});
    }

    // Update team record if not already recorded
    if (!game.resultRecorded) {
      const currentRecord = teamSettings.record || { wins: 0, losses: 0, ties: 0, otLosses: 0 };
      const newRecord = { ...currentRecord };

      if (selectedResult === 'win') {
        newRecord.wins = (newRecord.wins || 0) + 1;
      } else if (selectedResult === 'loss') {
        newRecord.losses = (newRecord.losses || 0) + 1;
      } else if (selectedResult === 'tie') {
        newRecord.ties = (newRecord.ties || 0) + 1;
      } else if (selectedResult === 'otLoss') {
        newRecord.otLosses = (newRecord.otLosses || 0) + 1;
      }

      setTeamSettings({ record: newRecord });
      if (activeTeamId) {
        setTimeout(() => {
          const s = useTeamStore.getState();
          pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
        }, 50);
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClearFinalScore = () => {
    Alert.alert(
      'Clear Result',
      'This will remove the final score and adjust the team record. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Reverse the record update if it was recorded
            if (game.resultRecorded && game.gameResult) {
              const currentRecord = teamSettings.record || { wins: 0, losses: 0, ties: 0, otLosses: 0 };
              const newRecord = { ...currentRecord };

              if (game.gameResult === 'win') {
                newRecord.wins = Math.max(0, (newRecord.wins || 0) - 1);
              } else if (game.gameResult === 'loss') {
                newRecord.losses = Math.max(0, (newRecord.losses || 0) - 1);
              } else if (game.gameResult === 'tie') {
                newRecord.ties = Math.max(0, (newRecord.ties || 0) - 1);
              } else if (game.gameResult === 'otLoss') {
                newRecord.otLosses = Math.max(0, (newRecord.otLosses || 0) - 1);
              }

              setTeamSettings({ record: newRecord });
              if (activeTeamId) {
                setTimeout(() => {
                  const s = useTeamStore.getState();
                  pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
                }, 50);
              }
            }

            // Clear the game result
            updateGameAndSync(game.id, {
              finalScoreUs: undefined,
              finalScoreThem: undefined,
              gameResult: undefined,
              resultRecorded: false,
            });

            setScoreUs('');
            setScoreThem('');
            setSelectedResult(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleSelectSoccerFormation = (formation: '442' | 'diamond') => {
    setIsSoccerFormationModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (formation === '442') {
      setIsSoccerLineupModalVisible(true);
    } else {
      setIsSoccerDiamondLineupModalVisible(true);
    }
  };

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.3, 0.6]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="flex-row items-center justify-between px-4 py-3"
        >
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
          >
            <ChevronLeft size={24} color="white" />
          </Pressable>

          {canManageTeam() && (
            <Pressable
              onPress={handleDeleteGame}
              className="w-10 h-10 rounded-full bg-red-500/80 items-center justify-center"
            >
              <Trash2 size={20} color="white" />
            </Pressable>
          )}
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Game Header Card */}
          <Animated.View
            entering={FadeInUp.delay(100).springify()}
            className="mx-4 mb-4"
          >
            <Pressable
              onPress={canManageTeam() ? openEditOpponentModal : undefined}
              className="bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700/50 active:bg-slate-700/80"
              disabled={!canManageTeam()}
            >
              <View className="p-5">
                <Text
                  className="text-white text-2xl font-bold text-center"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {teamName} vs {game.opponent}
                </Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Date, Time, and Jersey Cards */}
          <Animated.View entering={FadeInUp.delay(105).springify()} className="mx-4 mb-4">
            <View className="flex-row">
              <Pressable
                onPress={canManageTeam() ? openEditDateModal : undefined}
                disabled={!canManageTeam()}
                className="flex-1 bg-slate-800/80 rounded-2xl p-4 mr-2 active:bg-slate-700/80"
              >
                <View className="flex-row items-center mb-1">
                  <Text className="text-slate-400 text-xs">Date</Text>
                </View>
                <Text className="text-white font-semibold">{format(parseISO(game.date), 'EEEE, MMMM d, yyyy')}</Text>
              </Pressable>
              <Pressable
                onPress={canManageTeam() ? openEditTimeModal : undefined}
                disabled={!canManageTeam()}
                className="bg-slate-800/80 rounded-2xl p-4 mx-1 active:bg-slate-700/80"
              >
                <View className="flex-row items-center mb-1">
                  <Text className="text-slate-400 text-xs">Time</Text>
                </View>
                <Text className="text-white font-semibold">{game.time}</Text>
              </Pressable>
              <Pressable
                onPress={canManageTeam() ? openEditJerseyModal : undefined}
                disabled={!canManageTeam()}
                className="bg-slate-800/80 rounded-2xl p-4 ml-2 active:bg-slate-700/80"
              >
                <View className="flex-row items-center mb-1">
                  <Text className="text-slate-400 text-xs">Jersey</Text>
                </View>
                <View className="flex-row items-center">
                  <JerseyIcon size={16} color={jerseyColorHex} />
                  <Text className="text-white font-semibold ml-2">{jerseyColorName}</Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>

          {/* Location Card */}
          <Animated.View
            entering={FadeInUp.delay(110).springify()}
            className="mx-4 mb-4"
          >
            <Pressable
              onPress={canManageTeam() ? openEditLocationModal : handleOpenMaps}
              className="bg-slate-800/80 rounded-2xl p-4 flex-row items-center justify-between active:bg-slate-700/80"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-cyan-500/20 items-center justify-center">
                  <MapPin size={20} color="#67e8f9" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-slate-400 text-xs">Location</Text>
                  <Text className="text-white font-semibold">{game.location}</Text>
                  {game.address && (
                    <Text className="text-slate-400 text-sm">{game.address}</Text>
                  )}
                </View>
              </View>
              <Pressable
                onPress={handleOpenMaps}
                className="bg-cyan-500/20 rounded-full p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Navigation size={18} color="#67e8f9" />
              </Pressable>
            </Pressable>
          </Animated.View>

          {/* Notes Section */}
          <Animated.View
            entering={FadeInUp.delay(111).springify()}
            className="mx-4 mb-3"
          >
            <Pressable
              onPress={canManageTeam() ? () => {
                setIsEditNotesModalVisible(true);
              } : undefined}
              className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              disabled={!canManageTeam()}
            >
              <View className="flex-row items-center">
                <FileText size={18} color="#ffffff" />
                <View className="flex-1 ml-2.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white font-medium text-sm">Notes</Text>
                    <Text className="text-slate-500 text-[10px]">{(game.notes || '').length}/30</Text>
                  </View>
                  <Text className="text-slate-400 text-xs">
                    {game.notes || (canManageTeam() ? 'Tap to add notes' : 'No notes')}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Beer/Refreshment Duty - Show if team setting enabled (game.showBeerDuty defaults to true for new games) */}
          {(game.showBeerDuty !== false) && teamSettings.showRefreshmentDuty !== false && (
            <Animated.View
              entering={FadeInUp.delay(113).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={canManageTeam() ? () => setIsBeerDutyModalVisible(true) : undefined}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  {teamSettings.refreshmentDutyIs21Plus !== false ? (
                    <Beer size={18} color="#d97706" />
                  ) : (
                    <JuiceBoxIcon size={18} color="#9333ea" />
                  )}
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">
                      {teamSettings.refreshmentDutyIs21Plus !== false ? 'Beer Duty' : 'Refreshment Duty'}
                    </Text>
                    <Text className="text-slate-400 text-xs">
                      {beerDutyPlayer ? getPlayerName(beerDutyPlayer) : (canManageTeam() ? 'Tap to assign' : 'Not assigned')}
                    </Text>
                  </View>
                  {canManageTeam() && (
                    <ChevronDown size={16} color={teamSettings.refreshmentDutyIs21Plus !== false ? "#d97706" : "#9333ea"} />
                  )}
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Set Lines Button - Only for hockey and captains/admins */}
          {teamSettings.sport === 'hockey' && teamSettings.showLineups !== false && canManageTeam() && (
            <Animated.View
              entering={FadeInUp.delay(115).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={() => setIsLineupModalVisible(true)}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <ListOrdered size={18} color="#10b981" />
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">Set Lines</Text>
                    <Text className="text-slate-400 text-xs">Tap to edit lineup</Text>
                  </View>
                  <ChevronDown size={16} color="#10b981" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Starting 5 Button - Only for basketball and captains/admins */}
          {teamSettings.sport === 'basketball' && teamSettings.showLineups !== false && canManageTeam() && (
            <Animated.View
              entering={FadeInUp.delay(115).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={() => setIsBasketballLineupModalVisible(true)}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <ListOrdered size={18} color="#10b981" />
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">Starting 5</Text>
                    <Text className="text-slate-400 text-xs">Tap to edit lineup</Text>
                  </View>
                  <ChevronDown size={16} color="#10b981" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Set Batting Order Button - Only for baseball and captains/admins */}
          {teamSettings.sport === 'baseball' && teamSettings.showLineups !== false && canManageTeam() && (
            <Animated.View
              entering={FadeInUp.delay(115).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={() => setIsBattingOrderModalVisible(true)}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <ListOrdered size={18} color="#10b981" />
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">Set Batting Order</Text>
                    <Text className="text-slate-400 text-xs">Tap to edit lineup</Text>
                  </View>
                  <ChevronDown size={16} color="#10b981" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Set Batting Order Button - Only for softball and captains/admins */}
          {teamSettings.sport === 'softball' && teamSettings.showLineups !== false && canManageTeam() && (
            <Animated.View
              entering={FadeInUp.delay(115).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={() => setIsBattingOrderModalVisible(true)}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <ListOrdered size={18} color="#10b981" />
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">Set Batting Order</Text>
                    <Text className="text-slate-400 text-xs">Tap to edit lineup</Text>
                  </View>
                  <ChevronDown size={16} color="#10b981" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Set Lineup Button - Only for soccer and captains/admins */}
          {teamSettings.sport === 'soccer' && teamSettings.showLineups !== false && canManageTeam() && (
            <Animated.View
              entering={FadeInUp.delay(115).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={() => setIsSoccerFormationModalVisible(true)}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <ListOrdered size={18} color="#10b981" />
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">Set Lineup</Text>
                    <Text className="text-slate-400 text-xs">Tap to edit lineup</Text>
                  </View>
                  <ChevronDown size={16} color="#10b981" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Set Lineup Button - Only for lacrosse and captains/admins */}
          {teamSettings.sport === 'lacrosse' && teamSettings.showLineups !== false && canManageTeam() && (
            <Animated.View
              entering={FadeInUp.delay(115).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={() => setIsLacrosseLineupModalVisible(true)}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <ListOrdered size={18} color="#10b981" />
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">Set Lineup</Text>
                    <Text className="text-slate-400 text-xs">Tap to edit lineup</Text>
                  </View>
                  <ChevronDown size={16} color="#10b981" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Final Score Section - Visible to all, editable by captains/admins/coaches */}
          <Animated.View
            entering={FadeInUp.delay(120).springify()}
            className="mx-4 mb-3"
          >
            <Pressable
              onPress={() => {
                if (!canManageTeam()) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsFinalScoreExpanded(!isFinalScoreExpanded);
              }}
              className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
            >
              <View className="flex-row items-center">
                <Trophy size={18} color={game.gameResult ? (game.gameResult === 'win' ? '#22c55e' : game.gameResult === 'loss' ? '#ef4444' : game.gameResult === 'otLoss' ? '#f97316' : '#94a3b8') : '#f59e0b'} />
                <View className="flex-1 ml-2.5">
                  <Text className="text-white font-medium text-sm">
                    Final Score
                  </Text>
                  <Text className="text-slate-400 text-xs">
                    {game.gameResult
                      ? `${game.gameResult === 'win' ? 'Win' : game.gameResult === 'loss' ? 'Loss' : game.gameResult === 'otLoss' ? 'OT Loss' : 'Tie'}${(game.finalScoreUs !== undefined && game.finalScoreThem !== undefined) ? ` ${game.finalScoreUs}-${game.finalScoreThem}` : ''}`
                      : canManageTeam() ? 'Tap to enter result' : 'Not yet entered'}
                  </Text>
                </View>
                {canManageTeam() && (
                  <ChevronDown
                    size={16}
                    color={game.gameResult === 'win' ? '#22c55e' : game.gameResult === 'loss' ? '#ef4444' : game.gameResult === 'otLoss' ? '#f97316' : game.gameResult === 'tie' ? '#94a3b8' : '#f59e0b'}
                    style={{ transform: [{ rotate: isFinalScoreExpanded ? '180deg' : '0deg' }] }}
                  />
                )}
              </View>
            </Pressable>

              {/* Expanded content */}
              {isFinalScoreExpanded && (
                <View className="bg-slate-800/60 rounded-xl mt-2 p-3">
                  {/* Score inputs */}
                  <View className="flex-row items-center justify-center mb-3">
                    <View className="items-center">
                      <Text className="text-slate-400 text-xs mb-1">{teamName || 'Us'}</Text>
                      <TextInput
                        value={scoreUs}
                        onChangeText={setScoreUs}
                        placeholder="0"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        className="bg-slate-700/80 rounded-lg px-4 py-2 text-white text-xl font-bold text-center w-16"
                      />
                    </View>
                    <View className="mx-4">
                      <Minus size={20} color="#64748b" />
                    </View>
                    <View className="items-center">
                      <Text className="text-slate-400 text-xs mb-1">{game.opponent}</Text>
                      <TextInput
                        value={scoreThem}
                        onChangeText={setScoreThem}
                        placeholder="0"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        className="bg-slate-700/80 rounded-lg px-4 py-2 text-white text-xl font-bold text-center w-16"
                      />
                    </View>
                  </View>

                  {/* Win/Loss/Tie/OT Loss toggle */}
                  <View className="flex-row rounded-lg overflow-hidden mb-3">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedResult('win');
                      }}
                      className={cn(
                        'flex-1 py-2 items-center border-r border-slate-600',
                        selectedResult === 'win' ? 'bg-green-500' : 'bg-slate-700/80'
                      )}
                    >
                      <Text className={cn(
                        'text-sm font-semibold',
                        selectedResult === 'win' ? 'text-white' : 'text-slate-400'
                      )}>
                        Win
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedResult('loss');
                      }}
                      className={cn(
                        'flex-1 py-2 items-center border-r border-slate-600',
                        selectedResult === 'loss' ? 'bg-red-500' : 'bg-slate-700/80'
                      )}
                    >
                      <Text className={cn(
                        'text-sm font-semibold',
                        selectedResult === 'loss' ? 'text-white' : 'text-slate-400'
                      )}>
                        Loss
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedResult('tie');
                      }}
                      className={cn(
                        'flex-1 py-2 items-center',
                        teamSettings.sport === 'hockey' ? 'border-r border-slate-600' : '',
                        selectedResult === 'tie' ? 'bg-slate-500' : 'bg-slate-700/80'
                      )}
                    >
                      <Text className={cn(
                        'text-sm font-semibold',
                        selectedResult === 'tie' ? 'text-white' : 'text-slate-400'
                      )}>
                        Tie
                      </Text>
                    </Pressable>
                    {teamSettings.sport === 'hockey' && (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedResult('otLoss');
                        }}
                        className={cn(
                          'flex-1 py-2 items-center',
                          selectedResult === 'otLoss' ? 'bg-orange-500' : 'bg-slate-700/80'
                        )}
                      >
                        <Text className={cn(
                          'text-sm font-semibold',
                          selectedResult === 'otLoss' ? 'text-white' : 'text-slate-400'
                        )}>
                          OT Loss
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Save/Clear buttons */}
                  <View className="flex-row">
                    {game.resultRecorded && (
                      <Pressable
                        onPress={handleClearFinalScore}
                        className="flex-1 py-2 rounded-lg bg-slate-700/80 mr-2 items-center active:bg-slate-600"
                      >
                        <Text className="text-slate-400 text-sm font-medium">Clear</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleSaveFinalScore}
                      disabled={!selectedResult}
                      className={cn(
                        'flex-1 py-2 rounded-lg items-center',
                        selectedResult ? 'bg-amber-500 active:bg-amber-600' : 'bg-slate-700/50'
                      )}
                    >
                      <Text className={cn(
                        'text-sm font-medium',
                        selectedResult ? 'text-slate-900' : 'text-slate-500'
                      )}>
                        {game.resultRecorded ? 'Update' : 'Save to Record'}
                      </Text>
                    </Pressable>
                  </View>

                  {!game.resultRecorded && selectedResult && (
                    <Text className="text-slate-500 text-xs text-center mt-2">
                      This will add a {selectedResult} to your team record
                    </Text>
                  )}
                </View>
              )}
            </Animated.View>

          {/* View Game Recap - shown when result has been recorded */}
          {game.gameResult && (
            <Animated.View entering={FadeInUp.delay(118).springify()} className="mx-4 mb-3">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/game-recap/${game.id}`);
                }}
                className="rounded-xl py-2.5 px-3 active:opacity-80 flex-row items-center"
                style={{
                  backgroundColor: game.gameResult === 'win' ? 'rgba(34,197,94,0.15)' :
                    game.gameResult === 'loss' ? 'rgba(239,68,68,0.15)' :
                    game.gameResult === 'otLoss' ? 'rgba(249,115,22,0.15)' :
                    'rgba(148,163,184,0.12)',
                  borderWidth: 1,
                  borderColor: game.gameResult === 'win' ? 'rgba(34,197,94,0.3)' :
                    game.gameResult === 'loss' ? 'rgba(239,68,68,0.3)' :
                    game.gameResult === 'otLoss' ? 'rgba(249,115,22,0.3)' :
                    'rgba(148,163,184,0.2)',
                }}
              >
                <Trophy size={18} color={
                  game.gameResult === 'win' ? '#22c55e' :
                  game.gameResult === 'loss' ? '#ef4444' :
                  game.gameResult === 'otLoss' ? '#f97316' :
                  '#94a3b8'
                } />
                <View className="flex-1 ml-2.5">
                  <Text className="text-white font-medium text-sm">Game Recap</Text>
                  <Text className="text-slate-400 text-xs">View full game summary</Text>
                </View>
                <ChevronRight size={16} color="#64748b" />
              </Pressable>
            </Animated.View>
          )}

          {/* Game Stats Section - Only when team stats is enabled */}
          {teamSettings.showTeamStats && (canManageStats || teamSettings.allowPlayerSelfStats) && (
            <Animated.View
              entering={FadeInUp.delay(122).springify()}
              className="mx-4 mb-3"
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsGameStatsExpanded(!isGameStatsExpanded);
                }}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <BarChart3 size={18} color="#8b5cf6" />
                  <View className="flex-1 ml-2.5">
                    <Text className="text-white font-medium text-sm">
                      Game Stats
                    </Text>
                    <Text className="text-slate-400 text-xs">
                      Tap to enter player stats
                    </Text>
                  </View>
                  <ChevronDown
                    size={16}
                    color="#8b5cf6"
                    style={{ transform: [{ rotate: isGameStatsExpanded ? '180deg' : '0deg' }] }}
                  />
                </View>
              </Pressable>

              {/* Expanded content - Table-style player stats */}
              {isGameStatsExpanded && (
                <View className="bg-slate-800/60 rounded-xl mt-2 overflow-hidden">
                  {checkedInPlayers.length > 0 ? (
                    <View>
                      {/* Player Statistics Table */}
                      <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider px-3 pt-3 pb-2">
                        Player Statistics
                      </Text>

                      {/* Table Header for Players */}
                      <View className="flex-row items-center px-2 py-2 bg-slate-700/50 border-b border-slate-700">
                        <View style={{ flex: 1 }}>
                          <Text className="text-slate-300 font-semibold text-xs">Player</Text>
                        </View>
                        <View style={{ width: 32 }}>
                          <Text className="text-slate-300 font-semibold text-center text-[10px]">Pos</Text>
                        </View>
                        {getGameStatHeaders(teamSettings.sport).map((header) => (
                          <View key={header} style={{ width: 28 }}>
                            <Text className="text-slate-300 font-semibold text-center text-[10px]">{header}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Non-Goalie/Non-Pitcher Player Rows */}
                      {checkedInPlayers
                        .filter(p => {
                          if (teamSettings.sport === 'hockey' || teamSettings.sport === 'soccer' || teamSettings.sport === 'lacrosse') {
                            return playerHasNonGoaliePositions(p);
                          }
                          if (teamSettings.sport === 'baseball' || teamSettings.sport === 'softball') {
                            return playerHasNonPitcherPositions(p);
                          }
                          return true;
                        })
                        .map((player, index, arr) => {
                          const canEdit = canEditPlayerStats(player.id);
                          const statValues = getGameStatValuesForPlayer(teamSettings.sport, player, game.id, false, false);
                          const hasStats = playerHasGameStats(player, game.id);
                          const showBorder = index !== arr.length - 1 ||
                            ((teamSettings.sport === 'hockey' || teamSettings.sport === 'soccer' || teamSettings.sport === 'lacrosse') && checkedInPlayers.some(p => playerIsGoalie(p))) ||
                            ((teamSettings.sport === 'baseball' || teamSettings.sport === 'softball') && checkedInPlayers.some(p => playerIsPitcher(p)));

                          return (
                            <Pressable
                              key={player.id}
                              onPress={() => {
                                if (!canEdit) return;
                                const mode: GameStatEditMode = teamSettings.sport === 'baseball' || teamSettings.sport === 'softball' ? 'batter' : teamSettings.sport === 'lacrosse' ? 'lacrosse' : 'skater';
                                openGameStatsModal(player, mode);
                              }}
                              disabled={!canEdit}
                              className={cn(
                                'flex-row items-center px-2 py-2.5',
                                canEdit ? 'active:bg-slate-700/50' : '',
                                showBorder ? 'border-b border-slate-700/50' : ''
                              )}
                            >
                              <View className="flex-row items-center" style={{ flex: 1 }}>
                                <Text className="text-violet-400 font-semibold text-xs mr-1">#{player.number}</Text>
                                <Text className="text-white text-sm font-medium" numberOfLines={1} style={{ flex: 1 }}>
                                  {formatShortName(getPlayerName(player))}
                                </Text>
                              </View>
                              <View style={{ width: 32 }}>
                                <Text className="text-slate-400 text-center text-xs">{getDisplayPosition(player)}</Text>
                              </View>
                              {statValues.map((value, i) => (
                                <View key={i} style={{ width: 28 }}>
                                  <Text className={cn(
                                    'text-center text-xs',
                                    hasStats ? 'text-white font-medium' : 'text-slate-500'
                                  )}>
                                    {value}
                                  </Text>
                                </View>
                              ))}
                            </Pressable>
                          );
                        })}

                      {/* Goalie Section for Hockey/Soccer/Lacrosse */}
                      {(teamSettings.sport === 'hockey' || teamSettings.sport === 'soccer' || teamSettings.sport === 'lacrosse') &&
                       checkedInPlayers.some(p => playerIsGoalie(p)) && (
                        <>
                          {/* Goalie Header */}
                          <View className="flex-row items-center px-2 py-2 bg-slate-700/50 border-b border-slate-700">
                            <View style={{ flex: 1 }}>
                              <Text className="text-slate-300 font-semibold text-xs">Goalies</Text>
                            </View>
                            <View style={{ width: 32 }} />
                            {getGameGoalieHeaders(teamSettings.sport).map((header) => (
                              <View key={header} style={{ width: 28 }}>
                                <Text className="text-slate-300 font-semibold text-center text-[10px]">{header}</Text>
                              </View>
                            ))}
                          </View>

                          {/* Goalie Rows */}
                          {checkedInPlayers.filter(p => playerIsGoalie(p)).map((player, index, arr) => {
                            const canEdit = canEditPlayerStats(player.id);
                            const statValues = getGameStatValuesForPlayer(teamSettings.sport, player, game.id, true, false);
                            const hasStats = playerHasGameStats(player, game.id);

                            return (
                              <Pressable
                                key={`goalie-${player.id}`}
                                onPress={() => {
                                  if (!canEdit) return;
                                  const mode: GameStatEditMode = teamSettings.sport === 'lacrosse' ? 'lacrosse_goalie' : 'goalie';
                                  openGameStatsModal(player, mode);
                                }}
                                disabled={!canEdit}
                                className={cn(
                                  'flex-row items-center px-2 py-2.5',
                                  canEdit ? 'active:bg-slate-700/50' : '',
                                  index !== arr.length - 1 ? 'border-b border-slate-700/50' : ''
                                )}
                              >
                                <View className="flex-row items-center" style={{ flex: 1 }}>
                                  <Text className="text-violet-400 font-semibold text-xs mr-1">#{player.number}</Text>
                                  <Text className="text-white text-sm font-medium" numberOfLines={1} style={{ flex: 1 }}>
                                    {formatShortName(getPlayerName(player))}
                                  </Text>
                                </View>
                                <View style={{ width: 32 }}>
                                  <Text className="text-slate-400 text-center text-xs">G</Text>
                                </View>
                                {statValues.map((value, i) => (
                                  <View key={i} style={{ width: 28 }}>
                                    <Text className={cn(
                                      'text-center text-xs',
                                      hasStats ? 'text-white font-medium' : 'text-slate-500'
                                    )}>
                                      {value}
                                    </Text>
                                  </View>
                                ))}
                              </Pressable>
                            );
                          })}
                        </>
                      )}

                      {/* Pitcher Section for Baseball/Softball */}
                      {(teamSettings.sport === 'baseball' || teamSettings.sport === 'softball') &&
                       checkedInPlayers.some(p => playerIsPitcher(p)) && (
                        <>
                          {/* Pitcher Header */}
                          <View className="flex-row items-center px-2 py-2 bg-slate-700/50 border-b border-slate-700">
                            <View style={{ flex: 1 }}>
                              <Text className="text-slate-300 font-semibold text-xs">Pitchers</Text>
                            </View>
                            <View style={{ width: 32 }} />
                            {getGamePitcherHeaders().map((header) => (
                              <View key={header} style={{ width: 28 }}>
                                <Text className="text-slate-300 font-semibold text-center text-[10px]">{header}</Text>
                              </View>
                            ))}
                          </View>

                          {/* Pitcher Rows */}
                          {checkedInPlayers.filter(p => playerIsPitcher(p)).map((player, index, arr) => {
                            const canEdit = canEditPlayerStats(player.id);
                            const statValues = getGameStatValuesForPlayer(teamSettings.sport, player, game.id, false, true);
                            const hasStats = playerHasGameStats(player, game.id);

                            return (
                              <Pressable
                                key={`pitcher-${player.id}`}
                                onPress={() => {
                                  if (!canEdit) return;
                                  openGameStatsModal(player, 'pitcher');
                                }}
                                disabled={!canEdit}
                                className={cn(
                                  'flex-row items-center px-2 py-2.5',
                                  canEdit ? 'active:bg-slate-700/50' : '',
                                  index !== arr.length - 1 ? 'border-b border-slate-700/50' : ''
                                )}
                              >
                                <View className="flex-row items-center" style={{ flex: 1 }}>
                                  <Text className="text-violet-400 font-semibold text-xs mr-1">#{player.number}</Text>
                                  <Text className="text-white text-sm font-medium" numberOfLines={1} style={{ flex: 1 }}>
                                    {formatShortName(getPlayerName(player))}
                                  </Text>
                                </View>
                                <View style={{ width: 32 }}>
                                  <Text className="text-slate-400 text-center text-xs">P</Text>
                                </View>
                                {statValues.map((value, i) => (
                                  <View key={i} style={{ width: 28 }}>
                                    <Text className={cn(
                                      'text-center text-xs',
                                      hasStats ? 'text-white font-medium' : 'text-slate-500'
                                    )}>
                                      {value}
                                    </Text>
                                  </View>
                                ))}
                              </Pressable>
                            );
                          })}
                        </>
                      )}
                    </View>
                  ) : (
                    <View className="items-center py-6">
                      <Text className="text-slate-500 text-sm">No players checked in</Text>
                      <Text className="text-slate-600 text-xs mt-1">Players must check in to enter stats</Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          <GameLineupDisplay
            gameId={game.id}
            onOpenLineupModal={() => setIsLineupModalVisible(true)}
            onOpenBasketballLineupModal={() => setIsBasketballLineupModalVisible(true)}
            onOpenBaseballLineupModal={() => setIsBaseballLineupModalVisible(true)}
            onOpenBattingOrderModal={() => setIsBattingOrderModalVisible(true)}
            onOpenSoccerLineupModal={() => setIsSoccerLineupModalVisible(true)}
            onOpenSoccerDiamondLineupModal={() => setIsSoccerDiamondLineupModalVisible(true)}
            onOpenLacrosseLineupModal={() => setIsLacrosseLineupModalVisible(true)}
          />

          {/* Divider */}
          <View className="mx-4 mt-3 mb-5">
            <View className="h-px bg-slate-700/50" />
          </View>

          {/* Release Invites Status - Visible to admins/captains */}
          {canManageTeam() && (
            <Animated.View
              entering={FadeInUp.delay(155).springify()}
              className="mx-4 mb-4"
            >
              <Pressable
                onPress={() => {
                  if (!game.invitesSent) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsReleaseInvitesModalVisible(true);
                  }
                }}
                disabled={game.invitesSent}
                className="flex-row items-center justify-center py-2.5 px-3 bg-slate-800/40 rounded-xl active:bg-slate-700/40"
              >
                <Calendar size={14} color="#67e8f9" />
                <Text className="text-cyan-400 text-sm ml-1.5">Release Invites:</Text>
                {game.invitesSent ? (
                  <View className="flex-row items-center ml-1.5">
                    <Check size={14} color="#22c55e" />
                    <Text className="text-green-400 text-sm ml-1">Invites sent</Text>
                  </View>
                ) : game.inviteReleaseOption === 'scheduled' && game.inviteReleaseDate ? (
                  // Check if scheduled time has passed
                  new Date() >= parseISO(game.inviteReleaseDate) ? (
                    <View className="flex-row items-center ml-1.5">
                      <Check size={14} color="#22c55e" />
                      <Text className="text-green-400 text-sm ml-1">Invites sent</Text>
                    </View>
                  ) : (
                    <Text className="text-amber-400 text-sm ml-1.5">
                      Scheduled {format(parseISO(game.inviteReleaseDate), 'MMM d, h:mm a')}
                    </Text>
                  )
                ) : game.inviteReleaseOption === 'none' ? (
                  <Text className="text-slate-400 text-sm ml-1.5">Not scheduled</Text>
                ) : (
                  <Text className="text-green-400 text-sm ml-1.5">Ready to send</Text>
                )}
              </Pressable>
            </Animated.View>
          )}

          {/* Check-In Section */}
          <Animated.View
            entering={FadeInUp.delay(200).springify()}
            className="mx-4 mb-4"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <CheckCircle2 size={18} color="#22c55e" />
                <Text className="text-green-400 text-lg font-semibold ml-2">
                  Check In
                </Text>
              </View>
              <View className="flex-row items-center">
                {canManageTeam() && (
                  <Pressable
                    onPress={() => setIsInviteModalVisible(true)}
                    className="flex-row items-center bg-cyan-500/20 rounded-lg px-3 py-1.5 mr-2"
                  >
                    <UserPlus size={14} color="#67e8f9" />
                    <Text className="text-cyan-400 text-sm font-medium ml-1">Invite More</Text>
                  </Pressable>
                )}
                {canManageTeam() && (
                  <Pressable
                    onPress={() => handleSendInAppNotification('reminder')}
                    className="flex-row items-center bg-green-500/20 rounded-lg px-3 py-1.5"
                  >
                    <Send size={14} color="#22c55e" />
                    <Text className="text-green-400 text-sm font-medium ml-1">Send Reminder</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* RSVP Stats */}
            <View className="flex-row mb-4">
              <View className="flex-1 bg-green-500/20 rounded-xl p-3 mr-2 items-center">
                <Text className="text-green-400 text-2xl font-bold">{checkedInCount}</Text>
                <Text className="text-green-400/70 text-xs">Confirmed</Text>
              </View>
              <View className="flex-1 bg-slate-700/50 rounded-xl p-3 mx-1 items-center">
                <Text className="text-slate-300 text-2xl font-bold">{pendingCount}</Text>
                <Text className="text-slate-400 text-xs">Pending</Text>
              </View>
              <View className="flex-1 bg-red-500/20 rounded-xl p-3 ml-2 items-center">
                <Text className="text-red-400 text-2xl font-bold">{checkedOutCount}</Text>
                <Text className="text-red-400/70 text-xs">Declined</Text>
              </View>
            </View>

            {/* Instruction note */}
            <View className="bg-slate-700/30 rounded-xl px-3 py-2.5 mb-3 border border-slate-600/30">
              <Text className="text-slate-400 text-xs text-center">
                {canManageTeam()
                  ? <>Tap to cycle: <Text className="text-green-400 font-medium">IN</Text> → <Text className="text-red-400 font-medium">OUT</Text> → <Text className="text-slate-500 font-medium">No Response</Text></>
                  : isParent && associatedChildId
                    ? <>Tap your child's row to update their RSVP</>
                    : <>Tap your row to update your RSVP</>
                }
              </Text>
            </View>

            <View className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700/50">
              {playersToDisplay.map((player, index) => {
                const isSelf = player.id === currentPlayerId;
                // Parents can toggle their associated child's check-in
                const isAssociatedChild = !!associatedChildId && player.id === associatedChildId;
                // Admins and captains can toggle anyone, regular players can only toggle themselves,
                // parents can toggle their associated child
                const canToggle = canManageTeam() || isSelf || isAssociatedChild;
                const hasViewed = player.id === currentPlayerId
                  ? localViewedEventIds.includes(game.id)
                  : (game as any).viewedBy?.includes(player.id) ?? false;

                return (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    status={getPlayerStatus(player.id)}
                    onToggle={() => handleToggleCheckIn(player.id)}
                    index={index}
                    canToggle={canToggle}
                    isSelf={isSelf}
                    isAssociatedChild={isAssociatedChild}
                    hasViewed={hasViewed}
                    showViewedBadge={canManageTeam()}
                  />
                );
              })}
              {playersToDisplay.length === 0 && (
                <Text className="text-slate-400 text-center py-4">
                  No players invited yet
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Game Notes */}
          {game.notes && (
            <Animated.View
              entering={FadeInUp.delay(250).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                <Text className="text-slate-400 text-sm font-medium mb-2">Notes</Text>
                <Text className="text-white">{game.notes}</Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Extracted modal components ── */}
      <GameSettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
        gameId={game.id}
        onOpenEditModal={openEditModal}
        onDeleteGame={handleDeleteGame}
      />

      <BeerDutyModal
        visible={isBeerDutyModalVisible}
        onClose={() => setIsBeerDutyModalVisible(false)}
        gameId={game.id}
        onSelectPlayer={handleSelectBeerDutyPlayer}
      />

      <EditGameModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        gameId={game.id}
      />

      <ReleaseInvitesModal
        visible={isReleaseInvitesModalVisible}
        onClose={() => setIsReleaseInvitesModalVisible(false)}
        gameId={game.id}
      />

      <InvitePlayersModal
        visible={isInviteModalVisible}
        onClose={() => setIsInviteModalVisible(false)}
        gameId={game.id}
      />

      <GameStatsModal
        visible={isGameStatsModalVisible}
        onClose={() => setIsGameStatsModalVisible(false)}
        gameId={game.id}
        selectedStatsPlayer={selectedStatsPlayer}
        gameStatsEditMode={gameStatsEditMode}
        editGameStats={editGameStats}
        setEditGameStats={setEditGameStats}
        onSaved={() => {
          setIsGameStatsModalVisible(false);
          setSelectedStatsPlayer(null);
        }}
      />

      <SoccerFormationModal
        visible={isSoccerFormationModalVisible}
        onClose={() => setIsSoccerFormationModalVisible(false)}
        gameId={game.id}
        onSelectFormation={handleSelectSoccerFormation}
      />

      <GameInlineEditModals
        isEditOpponentModalVisible={isEditOpponentModalVisible}
        isEditDateModalVisible={isEditDateModalVisible}
        isEditTimeModalVisible={isEditTimeModalVisible}
        isEditJerseyModalVisible={isEditJerseyModalVisible}
        isEditLocationModalVisible={isEditLocationModalVisible}
        isEditNotesModalVisible={isEditNotesModalVisible}
        onCloseOpponent={() => setIsEditOpponentModalVisible(false)}
        onCloseDate={() => setIsEditDateModalVisible(false)}
        onCloseTime={() => setIsEditTimeModalVisible(false)}
        onCloseJersey={() => setIsEditJerseyModalVisible(false)}
        onCloseLocation={() => setIsEditLocationModalVisible(false)}
        onCloseNotes={() => setIsEditNotesModalVisible(false)}
        gameId={game.id}
        initialOpponent={game.opponent}
        initialDate={parseISO(game.date)}
        initialTime={(() => {
          const [time, period] = game.time.split(' ');
          const [hours, minutes] = time.split(':').map(Number);
          const d = new Date();
          let hour = hours;
          if (period === 'PM' && hours !== 12) hour += 12;
          if (period === 'AM' && hours === 12) hour = 0;
          d.setHours(hour, minutes, 0, 0);
          return d;
        })()}
        currentJerseyColor={game.jerseyColor}
        initialLocation={game.address ? `${game.location}, ${game.address}` : game.location}
        initialNotes={game.notes || ''}
        onSaveOpponent={(opponent) => {
          updateGameAndSync(game.id, { opponent });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsEditOpponentModalVisible(false);
        }}
        onSaveDate={(date) => {
          updateGameAndSync(game.id, { date: date.toISOString() });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsEditDateModalVisible(false);
        }}
        onSaveTime={(time) => {
          updateGameAndSync(game.id, { time: format(time, 'h:mm a') });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsEditTimeModalVisible(false);
        }}
        onSaveJersey={(color) => {
          updateGameAndSync(game.id, { jerseyColor: color });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsEditJerseyModalVisible(false);
        }}
        onSaveLocation={(location, address) => {
          const updates = { location, address: address || '', weatherAutoFetched: false, weatherTemp: undefined, weatherCondition: undefined, weatherIsForecast: undefined };
          updateGameAndSync(game.id, updates);
          if (activeTeamId) {
            fetchAndSaveWeather({ ...game, ...updates } as any, activeTeamId).catch(() => {});
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setIsEditLocationModalVisible(false);
        }}
        onSaveNotes={(notes) => {
          updateGameAndSync(game.id, { notes });
          setIsEditNotesModalVisible(false);
        }}
      />

      <LineupModals
        gameId={game.id}
        isLineupModalVisible={isLineupModalVisible}
        onCloseLineup={() => setIsLineupModalVisible(false)}
        isBasketballLineupModalVisible={isBasketballLineupModalVisible}
        onCloseBasketballLineup={() => setIsBasketballLineupModalVisible(false)}
        isBaseballLineupModalVisible={isBaseballLineupModalVisible}
        onCloseBaseballLineup={() => setIsBaseballLineupModalVisible(false)}
        isSoccerLineupModalVisible={isSoccerLineupModalVisible}
        onCloseSoccerLineup={() => setIsSoccerLineupModalVisible(false)}
        isSoccerDiamondLineupModalVisible={isSoccerDiamondLineupModalVisible}
        onCloseSoccerDiamondLineup={() => setIsSoccerDiamondLineupModalVisible(false)}
        isLacrosseLineupModalVisible={isLacrosseLineupModalVisible}
        onCloseLacrosseLineup={() => setIsLacrosseLineupModalVisible(false)}
        isBattingOrderModalVisible={isBattingOrderModalVisible}
        onCloseBattingOrder={() => setIsBattingOrderModalVisible(false)}
      />

      {/* SENTINEL — end of extracted modals */}
    </View>
  );
}
