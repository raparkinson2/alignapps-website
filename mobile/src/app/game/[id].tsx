import { View, Text, ScrollView, Pressable, Platform, Alert, Modal, TextInput, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useState, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import {
  MapPin,
  Clock,
  Users,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Circle,
  Navigation,
  Shirt,
  Bell,
  BellRing,
  BellOff,
  Beer,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Pencil,
  Check,
  Trash2,
  Plus,
  UserPlus,
  ListOrdered,
  Send,
  Calendar,
  StickyNote,
  FileText,
  Trophy,
  Minus,
  BarChart3,
  Save,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTeamStore, Player, SPORT_POSITION_NAMES, AppNotification, HockeyLineup, BasketballLineup, BaseballLineup, BattingOrderLineup, SoccerLineup, SoccerDiamondLineup, LacrosseLineup, getPlayerName, InviteReleaseOption, Sport, HockeyStats, HockeyGoalieStats, BaseballStats, BaseballPitcherStats, BasketballStats, SoccerStats, SoccerGoalieStats, LacrosseStats, LacrosseGoalieStats, PlayerStats, GameLogEntry, getPlayerPositions } from '@/lib/store';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';
import { pushGameToSupabase, pushGameResponseToSupabase, pushNotificationToSupabase, pushPlayerToSupabase, deleteGameFromSupabase, pushTeamToSupabase } from '@/lib/realtime-sync';
import { sendPushToPlayers, scheduleGameReminderDayBefore, scheduleGameReminderHoursBefore } from '@/lib/notifications';
import { AddressSearch } from '@/components/AddressSearch';
import { JerseyIcon } from '@/components/JerseyIcon';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { LineupEditor } from '@/components/LineupEditor';
import { hasAssignedPlayers } from '@/components/LineupViewer';
import { BasketballLineupEditor, hasAssignedBasketballPlayers } from '@/components/BasketballLineupEditor';
import { BasketballLineupViewer } from '@/components/BasketballLineupViewer';
import { BaseballLineupEditor, hasAssignedBaseballPlayers } from '@/components/BaseballLineupEditor';
import { BaseballLineupViewer } from '@/components/BaseballLineupViewer';
import { BattingOrderLineupEditor, hasAssignedBattingOrder } from '@/components/BattingOrderLineupEditor';
import { BattingOrderLineupViewer } from '@/components/BattingOrderLineupViewer';
import { SoccerLineupEditor, hasAssignedSoccerPlayers } from '@/components/SoccerLineupEditor';
import { SoccerLineupViewer } from '@/components/SoccerLineupViewer';
import { SoccerDiamondLineupEditor, hasAssignedSoccerDiamondPlayers } from '@/components/SoccerDiamondLineupEditor';
import { SoccerDiamondLineupViewer } from '@/components/SoccerDiamondLineupViewer';
import { LacrosseLineupEditor, hasAssignedLacrossePlayers } from '@/components/LacrosseLineupEditor';
import { LacrosseLineupViewer } from '@/components/LacrosseLineupViewer';

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

// Edit mode type for game stats - determines which stats to show/edit
type GameStatEditMode = 'batter' | 'pitcher' | 'skater' | 'goalie' | 'lacrosse' | 'lacrosse_goalie';

// Check if player is a goalie (checks all positions)
function isGoalie(position: string): boolean {
  return position === 'G' || position === 'GK';
}

// Check if any of the player's positions is a goalie
function playerIsGoalie(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => isGoalie(p));
}

// Check if player is a pitcher
function isPitcher(position: string): boolean {
  return position === 'P';
}

// Check if any of the player's positions is a pitcher
function playerIsPitcher(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.includes('P');
}

// Check if player has non-pitcher positions (for baseball)
function playerHasNonPitcherPositions(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => p !== 'P');
}

// Check if player has non-goalie positions (for hockey/soccer/lacrosse)
function playerHasNonGoaliePositions(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => !isGoalie(p));
}

// Get display position string (e.g., "P/3B" or "LW/C")
function getDisplayPosition(player: Player): string {
  const positions = getPlayerPositions(player);
  return positions.join('/');
}

// Format name as "F. LastName"
function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return `${firstName.charAt(0)}. ${lastName}`;
}

// Get stat column headers for table display based on sport
function getGameStatHeaders(sport: Sport): string[] {
  switch (sport) {
    case 'hockey':
      return ['G', 'A', 'P', 'PIM', '+/-'];
    case 'baseball':
    case 'softball':
      return ['AB', 'H', 'BB', 'K', 'RBI', 'R', 'HR'];
    case 'basketball':
      return ['PTS', 'REB', 'AST', 'STL', 'BLK'];
    case 'soccer':
      return ['G', 'A', 'YC'];
    case 'lacrosse':
      return ['G', 'A', 'GB', 'CT'];
    default:
      return ['G', 'A', 'P', 'PIM', '+/-'];
  }
}

// Get goalie stat headers for table display (includes calculated stats)
function getGameGoalieHeaders(sport: Sport): string[] {
  if (sport === 'lacrosse') {
    return ['MP', 'SA', 'SV', 'GA', 'GAA', 'SV%', 'GB'];
  }
  return ['MP', 'SA', 'SV', 'GA', 'GAA', 'SV%'];
}

// Get pitcher stat headers for table display (includes ERA calculated)
function getGamePitcherHeaders(): string[] {
  return ['IP', 'K', 'BB', 'H', 'HR', 'ER', 'ERA'];
}

// Get stat values for a player for this specific game
function getGameStatValuesForPlayer(
  sport: Sport,
  player: Player,
  gameId: string,
  isGoalieStats: boolean = false,
  isPitcherStats: boolean = false
): (number | string)[] {
  // Find the game log for this specific game
  const gameLogs = player.gameLogs || [];

  // Determine which stat type to look for
  let statType: string;
  if (isPitcherStats) {
    statType = 'pitcher';
  } else if (isGoalieStats) {
    statType = sport === 'lacrosse' ? 'lacrosse_goalie' : 'goalie';
  } else if (sport === 'baseball' || sport === 'softball') {
    statType = 'batter';
  } else if (sport === 'lacrosse') {
    statType = 'lacrosse';
  } else {
    statType = 'skater';
  }

  // Find by gameId field first, then fall back to id prefix match for backwards compatibility
  const gameLog = gameLogs.find(log =>
    (log.gameId === gameId || log.id.startsWith(gameId)) && log.statType === statType
  );

  if (!gameLog) {
    // Return zeros based on sport/type
    if (isPitcherStats) return [0, 0, 0, 0, 0, 0, '-'];
    if (isGoalieStats && sport === 'lacrosse') return [0, 0, 0, 0, '-', '-', 0];
    if (isGoalieStats) return [0, 0, 0, 0, '-', '-'];
    switch (sport) {
      case 'hockey': return [0, 0, 0, 0, 0];
      case 'baseball':
      case 'softball': return [0, 0, 0, 0, 0, 0, 0];
      case 'basketball': return [0, 0, 0, 0, 0];
      case 'soccer': return [0, 0, 0];
      case 'lacrosse': return [0, 0, 0, 0];
      default: return [0, 0, 0, 0, 0];
    }
  }

  const stats = gameLog.stats as unknown as Record<string, number>;

  // Return values in the correct order for headers
  if (isPitcherStats) {
    const innings = stats.innings ?? 0;
    const earnedRuns = stats.earnedRuns ?? 0;
    // Calculate ERA (Earned Run Average) - earned runs per 9 innings
    const era = innings > 0 ? ((earnedRuns / innings) * 9).toFixed(2) : '-';

    return [
      innings,
      stats.strikeouts ?? 0,
      stats.walks ?? 0,
      stats.hits ?? 0,
      stats.homeRuns ?? 0,
      earnedRuns,
      era
    ];
  }

  if (isGoalieStats) {
    const minutesPlayed = stats.minutesPlayed ?? 0;
    const shotsAgainst = stats.shotsAgainst ?? 0;
    const saves = stats.saves ?? 0;
    const goalsAgainst = stats.goalsAgainst ?? 0;

    // Calculate GAA (Goals Against Average) - goals per 60 minutes
    const gaa = minutesPlayed > 0 ? ((goalsAgainst / minutesPlayed) * 60).toFixed(2) : '0.00';

    // Calculate SV% (Save Percentage)
    const svPct = shotsAgainst > 0 ? ((saves / shotsAgainst) * 100).toFixed(0) + '%' : '-';

    if (sport === 'lacrosse') {
      return [
        minutesPlayed,
        shotsAgainst,
        saves,
        goalsAgainst,
        gaa,
        svPct,
        stats.groundBalls ?? 0
      ];
    }
    return [
      minutesPlayed,
      shotsAgainst,
      saves,
      goalsAgainst,
      gaa,
      svPct
    ];
  }

  switch (sport) {
    case 'hockey': {
      const goals = stats.goals ?? 0;
      const assists = stats.assists ?? 0;
      const points = goals + assists;
      const plusMinus = stats.plusMinus ?? 0;
      const plusMinusStr = plusMinus > 0 ? `+${plusMinus}` : `${plusMinus}`;
      return [goals, assists, points, stats.pim ?? 0, plusMinusStr];
    }
    case 'baseball':
    case 'softball':
      return [
        stats.atBats ?? 0,
        stats.hits ?? 0,
        stats.walks ?? 0,
        stats.strikeouts ?? 0,
        stats.rbi ?? 0,
        stats.runs ?? 0,
        stats.homeRuns ?? 0
      ];
    case 'basketball':
      return [
        stats.points ?? 0,
        stats.rebounds ?? 0,
        stats.assists ?? 0,
        stats.steals ?? 0,
        stats.blocks ?? 0
      ];
    case 'soccer':
      return [stats.goals ?? 0, stats.assists ?? 0, stats.yellowCards ?? 0];
    case 'lacrosse':
      return [
        stats.goals ?? 0,
        stats.assists ?? 0,
        stats.groundBalls ?? 0,
        stats.causedTurnovers ?? 0
      ];
    default:
      return [0, 0, 0, 0, 0];
  }
}

// Check if player has stats entered for this game
function playerHasGameStats(player: Player, gameId: string): boolean {
  const gameLogs = player.gameLogs || [];
  return gameLogs.some(log => log.gameId === gameId || log.id.startsWith(gameId));
}

// Get stat field definitions based on sport and position
function getGameStatFields(sport: Sport, position: string): { key: string; label: string }[] {
  const playerIsGoaliePos = isGoalie(position);
  const playerIsPitcherPos = isPitcher(position);

  // Goalie stats for hockey/soccer (no games field - each log = 1 GP)
  if (playerIsGoaliePos && (sport === 'hockey' || sport === 'soccer')) {
    if (sport === 'hockey') {
      return [
        { key: 'minutesPlayed', label: 'Minutes Played' },
        { key: 'shotsAgainst', label: 'Shots Against' },
        { key: 'saves', label: 'Saves' },
        { key: 'goalsAgainst', label: 'Goals Against' },
      ];
    }
    return [
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
    ];
  }

  // Lacrosse goalie stats
  if (playerIsGoaliePos && sport === 'lacrosse') {
    return [
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
      { key: 'groundBalls', label: 'Ground Balls' },
    ];
  }

  // Pitcher stats for baseball/softball
  if (playerIsPitcherPos && (sport === 'baseball' || sport === 'softball')) {
    return [
      { key: 'innings', label: 'Innings' },
      { key: 'strikeouts', label: 'Strikeouts (K)' },
      { key: 'walks', label: 'Walks (BB)' },
      { key: 'hits', label: 'Hits' },
      { key: 'homeRuns', label: 'Home Runs' },
      { key: 'earnedRuns', label: 'Earned Runs' },
    ];
  }

  // Regular player stats (no gamesPlayed field - each log = 1 GP)
  switch (sport) {
    case 'hockey':
      return [
        { key: 'goals', label: 'Goals' },
        { key: 'assists', label: 'Assists' },
        { key: 'pim', label: 'PIM' },
        { key: 'plusMinus', label: '+/-' },
      ];
    case 'baseball':
    case 'softball':
      return [
        { key: 'atBats', label: 'At Bats' },
        { key: 'hits', label: 'Hits' },
        { key: 'walks', label: 'Walks' },
        { key: 'strikeouts', label: 'Strikeouts' },
        { key: 'rbi', label: 'RBI' },
        { key: 'runs', label: 'Runs' },
        { key: 'homeRuns', label: 'Home Runs' },
      ];
    case 'basketball':
      return [
        { key: 'points', label: 'Points' },
        { key: 'rebounds', label: 'Rebounds' },
        { key: 'assists', label: 'Assists' },
        { key: 'steals', label: 'Steals' },
        { key: 'blocks', label: 'Blocks' },
      ];
    case 'soccer':
      return [
        { key: 'goals', label: 'Goals' },
        { key: 'assists', label: 'Assists' },
        { key: 'yellowCards', label: 'Yellow Cards' },
      ];
    case 'lacrosse':
      return [
        { key: 'goals', label: 'Goals' },
        { key: 'assists', label: 'Assists' },
        { key: 'groundBalls', label: 'Ground Balls' },
        { key: 'causedTurnovers', label: 'Caused Turnovers' },
      ];
    default:
      return [];
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
}

function PlayerRow({ player, status, onToggle, index, canToggle, isSelf, isAssociatedChild }: PlayerRowProps) {
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
        pushGameToSupabase({ ...currentGame, ...updates } as any, activeTeamId).catch(console.error);
      }
    }
  };
  const canManageTeam = useTeamStore((s) => s.canManageTeam);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const addGameLog = useTeamStore((s) => s.addGameLog);
  const updateGameLog = useTeamStore((s) => s.updateGameLog);
  const removeGameLog = useTeamStore((s) => s.removeGameLog);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);

  // Get current player and check their roles for stats permissions
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isCoach = currentPlayer?.roles?.includes('coach') ?? false;
  const canManageStats = canManageTeam() || isCoach;

  // Parent/guardian: detect if current user is a parent with an associated player (child)
  const isParent = currentPlayer?.roles?.includes('parent') ?? false;
  const associatedChildId = isParent ? (currentPlayer?.associatedPlayerId ?? null) : null;


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
  const [isLinesExpanded, setIsLinesExpanded] = useState(false);
  const [isBasketballLineupExpanded, setIsBasketballLineupExpanded] = useState(false);
  const [isBattingOrderExpanded, setIsBattingOrderExpanded] = useState(false);
  const [isSoccerLineupExpanded, setIsSoccerLineupExpanded] = useState(false);
  const [isSoccerDiamondLineupExpanded, setIsSoccerDiamondLineupExpanded] = useState(false);
  const [isLacrosseLineupExpanded, setIsLacrosseLineupExpanded] = useState(false);

  // Edit form state
  const [editOpponent, setEditOpponent] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editTime, setEditTime] = useState(new Date());
  const [editJersey, setEditJersey] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editShowBeerDuty, setEditShowBeerDuty] = useState(true);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  // Invite release edit state
  const [editInviteReleaseOption, setEditInviteReleaseOption] = useState<InviteReleaseOption>('now');
  const [editInviteReleaseDate, setEditInviteReleaseDate] = useState(new Date());
  const [showEditInviteReleaseDatePicker, setShowEditInviteReleaseDatePicker] = useState(false);

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

  const uninvitedPlayers = eligiblePlayers.filter((p) => !game.invitedPlayers?.includes(p.id));
  const uninvitedActive = uninvitedPlayers.filter((p) => p.status === 'active');
  const uninvitedReserve = uninvitedPlayers.filter((p) => p.status === 'reserve');
  const activePlayers = eligiblePlayers.filter((p) => p.status === 'active');
  const reservePlayers = eligiblePlayers.filter((p) => p.status === 'reserve');
  const allRosterPlayers = [...activePlayers, ...reservePlayers]; // For refreshment duty selection
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
      pushGameResponseToSupabase(game.id, playerId, 'invited').catch(console.error);
    }

    // Cycle through: none -> in -> out -> none
    if (!isIn && !isOut) {
      // Currently no response, mark as IN
      checkInToGame(game.id, playerId);
      if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'in').catch(console.error);

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
      if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'out').catch(console.error);
      if (playerId === currentPlayerId) {
        Notifications.cancelAllScheduledNotificationsAsync().catch(console.error);
      }
    } else {
      // Currently OUT, clear response (back to invited)
      clearPlayerResponse(game.id, playerId);
      if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'invited').catch(console.error);
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

  // Save game stats for a player
  const saveGameStats = () => {
    if (!selectedStatsPlayer || !game) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Determine which position to use for getting stat fields based on edit mode
    let positionForStats: string;
    let statType: 'skater' | 'goalie' | 'batter' | 'pitcher' | 'lacrosse' | 'lacrosse_goalie';

    if (gameStatsEditMode === 'pitcher') {
      positionForStats = 'P';
      statType = 'pitcher';
    } else if (gameStatsEditMode === 'goalie') {
      positionForStats = teamSettings.sport === 'soccer' ? 'GK' : 'G';
      statType = 'goalie';
    } else if (gameStatsEditMode === 'lacrosse_goalie') {
      positionForStats = 'G';
      statType = 'lacrosse_goalie';
    } else if (gameStatsEditMode === 'batter') {
      positionForStats = 'batter';
      statType = 'batter';
    } else if (gameStatsEditMode === 'lacrosse') {
      positionForStats = 'batter';
      statType = 'lacrosse';
    } else {
      positionForStats = 'batter';
      statType = 'skater';
    }

    const statFields = getGameStatFields(teamSettings.sport, positionForStats);
    const newStats: Record<string, number> = {};
    statFields.forEach((field) => {
      newStats[field.key] = parseInt(editGameStats[field.key] || '0', 10) || 0;
    });

    // Check if there's an existing game log for this game and stat type
    const existingLog = (selectedStatsPlayer.gameLogs || []).find(
      log => (log.gameId === game.id || log.id.startsWith(game.id)) && log.statType === statType
    );

    if (existingLog) {
      // Update existing log
      updateGameLog(selectedStatsPlayer.id, existingLog.id, {
        stats: newStats as unknown as PlayerStats,
      });
    } else {
      // Create new game log entry with the game's date and gameId
      const gameLogEntry: GameLogEntry = {
        id: `${game.id}-${Date.now()}`,
        gameId: game.id, // Store the game ID for reliable matching
        date: game.date, // Use the game's date
        stats: newStats as unknown as PlayerStats,
        statType,
      };

      // Add game log
      addGameLog(selectedStatsPlayer.id, gameLogEntry);
    }

    // Recalculate cumulative stats from all game logs of this type
    const currentPlayer = players.find(p => p.id === selectedStatsPlayer.id);
    const currentLogs = currentPlayer?.gameLogs || [];

    // Build list of logs after the update
    let allLogsOfType: GameLogEntry[];
    if (existingLog) {
      // Replace the existing log's stats in our calculation
      allLogsOfType = currentLogs
        .filter(log => log.statType === statType)
        .map(log => log.id === existingLog.id ? { ...log, stats: newStats as unknown as PlayerStats } : log);
    } else {
      // Add the new log to our calculation
      allLogsOfType = [
        ...currentLogs.filter(log => log.statType === statType),
        { id: `${game.id}-new`, gameId: game.id, date: game.date, stats: newStats as unknown as PlayerStats, statType }
      ];
    }

    const cumulativeStats: Record<string, number> = {};
    allLogsOfType.forEach(log => {
      const logStats = log.stats as unknown as Record<string, number>;
      Object.keys(logStats).forEach(key => {
        cumulativeStats[key] = (cumulativeStats[key] || 0) + (logStats[key] || 0);
      });
    });

    // Add games played count (each log = 1 game)
    if (gameStatsEditMode === 'goalie' || gameStatsEditMode === 'lacrosse_goalie') {
      cumulativeStats.games = allLogsOfType.length;
    } else {
      cumulativeStats.gamesPlayed = allLogsOfType.length;
    }

    // Save cumulative stats to the appropriate stats field based on edit mode
    if (gameStatsEditMode === 'pitcher') {
      updatePlayer(selectedStatsPlayer.id, { pitcherStats: cumulativeStats as unknown as BaseballPitcherStats });
    } else if (gameStatsEditMode === 'goalie' || gameStatsEditMode === 'lacrosse_goalie') {
      updatePlayer(selectedStatsPlayer.id, { goalieStats: cumulativeStats as unknown as HockeyGoalieStats });
    } else {
      updatePlayer(selectedStatsPlayer.id, { stats: cumulativeStats as unknown as PlayerStats });
    }

    // Sync updated stats to Supabase
    if (activeTeamId) {
      const updated = useTeamStore.getState().players.find(p => p.id === selectedStatsPlayer.id);
      if (updated) pushPlayerToSupabase(updated, activeTeamId).catch(console.error);
    }

    // Close modal
    setIsGameStatsModalVisible(false);
    setSelectedStatsPlayer(null);

    // Show success
    Alert.alert('Stats Saved', `Game stats ${existingLog ? 'updated' : 'saved'} for ${selectedStatsPlayer.firstName} ${selectedStatsPlayer.lastName}.`);
  };

  // Get stat fields for the currently selected player
  const currentGameStatFields = selectedStatsPlayer ? (() => {
    let positionForStats: string;
    if (gameStatsEditMode === 'pitcher') {
      positionForStats = 'P';
    } else if (gameStatsEditMode === 'goalie' || gameStatsEditMode === 'lacrosse_goalie') {
      positionForStats = teamSettings.sport === 'soccer' ? 'GK' : 'G';
    } else {
      positionForStats = 'batter';
    }
    return getGameStatFields(teamSettings.sport, positionForStats);
  })() : [];

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
    ).catch(console.error);

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
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Notifications Sent',
      `${type === 'invite' ? 'Game invites' : 'Reminders'} sent to ${targetPlayers.length} player${targetPlayers.length !== 1 ? 's' : ''}!`
    );
  };

  const handleInvitePlayer = async (playerId: string, sendNotification: boolean = true) => {
    const currentInvited = game.invitedPlayers ?? [];
    if (currentInvited.includes(playerId)) return;

    updateGameAndSync(game.id, {
      invitedPlayers: [...currentInvited, playerId],
    });

    // Persist the invite to game_responses so it survives app reloads and syncs to other users
    if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'invited').catch(console.error);

    if (sendNotification) {
      const gameDate = parseISO(game.date);
      const dateStr = format(gameDate, 'EEEE, MMMM d');
      const title = 'Game Invite';
      const message = `You're invited to play vs ${game.opponent} on ${dateStr} at ${game.time}. Wear your ${jerseyColorName} jersey!`;

      // Only send push notification if inviting the current user (self-invite)
      // Local push notifications only work on the current device
      if (playerId === currentPlayerId) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body: message,
              data: { gameId: game.id, type: 'game_invite' },
              sound: true,
              ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
            },
            trigger: null,
          });
        } catch (error) {
          console.log('Could not send push notification:', error);
        }
      }

      // Send real push notification to the invited player's device using fresh token
      sendPushToPlayers([playerId], title, message, { gameId: game.id, type: 'game_invite' }).catch(console.error);

      // Add to in-app notifications
      const notification: AppNotification = {
        id: `${Date.now()}-${playerId}`,
        type: 'game_invite',
        title,
        message,
        gameId: game.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: playerId,
        createdAt: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleInviteMultiplePlayers = async (playerIds: string[]) => {
    const currentInvited = game.invitedPlayers ?? [];
    const newInvites = playerIds.filter((id) => !currentInvited.includes(id));
    if (newInvites.length === 0) return;

    updateGameAndSync(game.id, {
      invitedPlayers: [...currentInvited, ...newInvites],
    });

    // Persist each new invite to game_responses so it survives app reloads and syncs to other users
    if (activeTeamId) {
      newInvites.forEach((id) => pushGameResponseToSupabase(game.id, id, 'invited').catch(console.error));
    }

    const gameDate = parseISO(game.date);
    const dateStr = format(gameDate, 'EEEE, MMMM d');
    const title = 'Game Invite';
    const message = `You're invited to play vs ${game.opponent} on ${dateStr} at ${game.time}. Wear your ${jerseyColorName} jersey!`;

    // Only send push notification if current user is being invited
    // Local push notifications only work on the current device
    if (currentPlayerId && newInvites.includes(currentPlayerId)) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: message,
            data: { gameId: game.id, type: 'game_invite' },
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
          },
          trigger: null,
        });
      } catch (error) {
        console.log('Could not send push notification:', error);
      }
    }

    // Send real push notifications to all newly invited players using fresh tokens
    sendPushToPlayers(newInvites, title, message, { gameId: game.id, type: 'game_invite' }).catch(console.error);

    // Add to in-app notifications
    newInvites.forEach((playerId) => {
      const notification: AppNotification = {
        id: `${Date.now()}-${playerId}`,
        type: 'game_invite',
        title,
        message,
        gameId: game.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: playerId,
        createdAt: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Invites Sent', `${newInvites.length} player${newInvites.length !== 1 ? 's' : ''} invited!`);
    setIsInviteModalVisible(false);
  };

  const handleSelectBeerDutyPlayer = (playerId: string | undefined) => {
    updateGameAndSync(game.id, { beerDutyPlayerId: playerId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsBeerDutyModalVisible(false);
  };

  const openEditModal = () => {
    // Populate form with current game data
    setEditOpponent(game.opponent);
    // Combine location and address into single field for editing
    const combinedLocation = game.address
      ? `${game.location}, ${game.address}`
      : game.location;
    setEditLocation(combinedLocation);
    setEditDate(parseISO(game.date));
    // Parse time string to Date
    const [time, period] = game.time.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    const timeDate = new Date();
    let hour = hours;
    if (period === 'PM' && hours !== 12) hour += 12;
    if (period === 'AM' && hours === 12) hour = 0;
    timeDate.setHours(hour, minutes, 0, 0);
    setEditTime(timeDate);
    setEditJersey(game.jerseyColor);
    setEditNotes(game.notes || '');
    setEditShowBeerDuty(game.showBeerDuty !== false);
    // Set invite release state from game
    setEditInviteReleaseOption(game.inviteReleaseOption || 'now');
    setEditInviteReleaseDate(game.inviteReleaseDate ? parseISO(game.inviteReleaseDate) : new Date());
    setShowEditInviteReleaseDatePicker(false);
    setIsSettingsModalVisible(false);
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editOpponent.trim() || !editLocation.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const timeString = format(editTime, 'h:mm a');

    updateGameAndSync(game.id, {
      opponent: editOpponent.trim(),
      location: editLocation.trim(),
      address: '', // Address is now part of location field
      date: editDate.toISOString(),
      time: timeString,
      jerseyColor: editJersey,
      notes: editNotes.trim() || undefined,
      showBeerDuty: editShowBeerDuty,
      inviteReleaseOption: editInviteReleaseOption,
      inviteReleaseDate: editInviteReleaseOption === 'scheduled' ? editInviteReleaseDate.toISOString() : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditModalVisible(false);
  };

  // Inline edit handlers
  const openEditOpponentModal = () => {
    setEditOpponent(game.opponent);
    setIsEditOpponentModalVisible(true);
  };

  const handleSaveOpponent = () => {
    if (!editOpponent.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    updateGameAndSync(game.id, { opponent: editOpponent.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditOpponentModalVisible(false);
  };

  const openEditDateModal = () => {
    setEditDate(parseISO(game.date));
    setIsEditDateModalVisible(true);
  };

  const handleSaveDate = () => {
    updateGameAndSync(game.id, { date: editDate.toISOString() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditDateModalVisible(false);
  };

  const openEditTimeModal = () => {
    const [time, period] = game.time.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    const timeDate = new Date();
    let hour = hours;
    if (period === 'PM' && hours !== 12) hour += 12;
    if (period === 'AM' && hours === 12) hour = 0;
    timeDate.setHours(hour, minutes, 0, 0);
    setEditTime(timeDate);
    setIsEditTimeModalVisible(true);
  };

  const handleSaveTime = () => {
    const timeString = format(editTime, 'h:mm a');
    updateGameAndSync(game.id, { time: timeString });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditTimeModalVisible(false);
  };

  const openEditJerseyModal = () => {
    setEditJersey(game.jerseyColor);
    setIsEditJerseyModalVisible(true);
  };

  const handleSaveJersey = (color: string) => {
    updateGameAndSync(game.id, { jerseyColor: color });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditJerseyModalVisible(false);
  };

  const openEditLocationModal = () => {
    const combinedLocation = game.address
      ? `${game.location}, ${game.address}`
      : game.location;
    setEditLocation(combinedLocation);
    setIsEditLocationModalVisible(true);
  };

  const handleSaveLocation = () => {
    if (!editLocation.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    updateGameAndSync(game.id, { location: editLocation.trim(), address: '' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditLocationModalVisible(false);
  };

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

  const handleSaveReleaseInvites = () => {
    updateGameAndSync(game.id, {
      inviteReleaseOption: editInviteReleaseOption,
      inviteReleaseDate: editInviteReleaseOption === 'scheduled' ? editInviteReleaseDate.toISOString() : undefined,
      invitesSent: editInviteReleaseOption === 'now' ? true : game.invitesSent,
    });

    // If releasing now, send notifications
    if (editInviteReleaseOption === 'now' && !game.invitesSent) {
      const dateStr = format(parseISO(game.date), 'EEE, MMM d');
      invitedPlayers.forEach((player) => {
        const notification: AppNotification = {
          id: `game-invite-${game.id}-${player.id}-${Date.now()}`,
          type: 'game_invite',
          title: 'Game Invite!',
          message: `You're invited to play vs ${game.opponent} on ${dateStr} at ${game.time}. Wear your ${jerseyColorName} jersey!`,
          gameId: game.id,
          toPlayerId: player.id,
          read: false,
          createdAt: new Date().toISOString(),
        };
        addNotification(notification);
        if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsReleaseInvitesModalVisible(false);
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
          pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
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
                  pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
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

  const handleSaveLineup = (lineup: HockeyLineup) => {
    updateGameAndSync(game.id, { lineup });
    setIsLineupModalVisible(false);
  };

  const handleSaveBasketballLineup = (basketballLineup: BasketballLineup) => {
    updateGameAndSync(game.id, { basketballLineup });
    setIsBasketballLineupModalVisible(false);
  };

  const handleSaveBaseballLineup = (baseballLineup: BaseballLineup) => {
    updateGameAndSync(game.id, { baseballLineup });
    setIsBaseballLineupModalVisible(false);
  };

  const handleSaveSoccerLineup = (soccerLineup: SoccerLineup) => {
    updateGameAndSync(game.id, { soccerLineup });
    setIsSoccerLineupModalVisible(false);
  };

  const handleSaveSoccerDiamondLineup = (soccerDiamondLineup: SoccerDiamondLineup) => {
    updateGameAndSync(game.id, { soccerDiamondLineup });
    setIsSoccerDiamondLineupModalVisible(false);
  };

  const handleSaveLacrosseLineup = (lacrosseLineup: LacrosseLineup) => {
    updateGameAndSync(game.id, { lacrosseLineup });
    setIsLacrosseLineupModalVisible(false);
  };

  const handleSaveBattingOrderLineup = (battingOrderLineup: BattingOrderLineup) => {
    updateGameAndSync(game.id, { battingOrderLineup });
    setIsBattingOrderModalVisible(false);
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
                setEditNotes(game.notes || '');
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
                      {teamSettings.sport === 'hockey' && teamSettings.refreshmentDutyIs21Plus !== false
                        ? 'Refreshment Duty'
                        : 'Refreshment Duty'}
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

          {/* Lines Display - Only for hockey when lineup is set and has players */}
          {teamSettings.sport === 'hockey' && teamSettings.showLineups !== false && game.lineup && hasAssignedPlayers(game.lineup) && (
            <Animated.View
              entering={FadeInUp.delay(125).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsLinesExpanded(!isLinesExpanded);
                  }}
                  className="p-4 active:bg-emerald-500/30"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <ListOrdered size={20} color="#10b981" />
                      <Text className="text-emerald-400 font-semibold ml-2">Lines</Text>
                    </View>
                    {isLinesExpanded ? (
                      <ChevronUp size={20} color="#10b981" />
                    ) : (
                      <ChevronDown size={20} color="#10b981" />
                    )}
                  </View>
                </Pressable>

                {/* Expandable Content */}
                {isLinesExpanded && (
                  <Pressable
                    onPress={canManageTeam() ? () => setIsLineupModalVisible(true) : undefined}
                    className="px-4 pb-4"
                  >
                    {/* Forward Lines Preview */}
                    {game.lineup.forwardLines.slice(0, game.lineup.numForwardLines).map((line, index) => {
                      const lw = line.lw ? players.find((p) => p.id === line.lw) : null;
                      const c = line.c ? players.find((p) => p.id === line.c) : null;
                      const rw = line.rw ? players.find((p) => p.id === line.rw) : null;
                      if (!lw && !c && !rw) return null;
                      const positions = ['LW', 'C', 'RW'];
                      return (
                        <View key={`fwd-${index}`} className="mb-4">
                          <Text className="text-slate-400 text-xs mb-2">Line {index + 1}</Text>
                          <View className="flex-row justify-around">
                            {[lw, c, rw].map((player, i) => (
                              <View key={i} className="items-center">
                                {player ? (
                                  <>
                                    <PlayerAvatar player={player} size={48} borderWidth={2} borderColor="#10b981" />
                                    <Text className="text-white text-xs mt-1">{player.firstName}</Text>
                                    <Text className="text-emerald-400 text-xs font-medium">{positions[i]}</Text>
                                    <Text className="text-slate-400 text-xs">#{player.number}</Text>
                                  </>
                                ) : (
                                  <>
                                    <View className="w-12 h-12 rounded-full bg-slate-700/50 items-center justify-center border-2 border-slate-600">
                                      <Text className="text-slate-500 text-xs">-</Text>
                                    </View>
                                    <Text className="text-slate-500 text-xs font-medium mt-1">{positions[i]}</Text>
                                  </>
                                )}
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })}

                    {/* Defense Pairs Preview */}
                    {game.lineup.defenseLines.slice(0, game.lineup.numDefenseLines).map((line, index) => {
                      const ld = line.ld ? players.find((p) => p.id === line.ld) : null;
                      const rd = line.rd ? players.find((p) => p.id === line.rd) : null;
                      if (!ld && !rd) return null;
                      const positions = ['LD', 'RD'];
                      return (
                        <View key={`def-${index}`} className="mb-4">
                          <Text className="text-slate-400 text-xs mb-2">D-Pair {index + 1}</Text>
                          <View className="flex-row justify-around px-8">
                            {[ld, rd].map((player, i) => (
                              <View key={i} className="items-center">
                                {player ? (
                                  <>
                                    <PlayerAvatar player={player} size={48} borderWidth={2} borderColor="#10b981" />
                                    <Text className="text-white text-xs mt-1">{player.firstName}</Text>
                                    <Text className="text-emerald-400 text-xs font-medium">{positions[i]}</Text>
                                    <Text className="text-slate-400 text-xs">#{player.number}</Text>
                                  </>
                                ) : (
                                  <>
                                    <View className="w-12 h-12 rounded-full bg-slate-700/50 items-center justify-center border-2 border-slate-600">
                                      <Text className="text-slate-500 text-xs">-</Text>
                                    </View>
                                    <Text className="text-slate-500 text-xs font-medium mt-1">{positions[i]}</Text>
                                  </>
                                )}
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })}

                    {/* Goalies Preview */}
                    {game.lineup.goalieLines.slice(0, game.lineup.numGoalieLines).map((line, index) => {
                      const g = line.g ? players.find((p) => p.id === line.g) : null;
                      if (!g) return null;
                      return (
                        <View key={`goal-${index}`} className="mb-4">
                          <Text className="text-slate-400 text-xs mb-2">{index === 0 ? 'Starter' : 'Backup'}</Text>
                          <View className="items-center">
                            <PlayerAvatar player={g} size={48} borderWidth={2} borderColor="#10b981" />
                            <Text className="text-white text-xs mt-1">{g.firstName}</Text>
                            <Text className="text-emerald-400 text-xs font-medium">G</Text>
                            <Text className="text-slate-400 text-xs">#{g.number}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Basketball Lineup Display - Only when lineup is set and has players */}
          {teamSettings.sport === 'basketball' && teamSettings.showLineups !== false && game.basketballLineup && hasAssignedBasketballPlayers(game.basketballLineup) && (
            <Animated.View
              entering={FadeInUp.delay(125).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsBasketballLineupExpanded(!isBasketballLineupExpanded);
                  }}
                  className="p-4 active:bg-emerald-500/30"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <ListOrdered size={20} color="#10b981" />
                      <Text className="text-emerald-400 font-semibold ml-2">Starting 5</Text>
                    </View>
                    {isBasketballLineupExpanded ? (
                      <ChevronUp size={20} color="#10b981" />
                    ) : (
                      <ChevronDown size={20} color="#10b981" />
                    )}
                  </View>
                </Pressable>

                {/* Expandable Content */}
                {isBasketballLineupExpanded && (
                  <Pressable
                    onPress={canManageTeam() ? () => setIsBasketballLineupModalVisible(true) : undefined}
                    className="px-4 pb-4 active:bg-emerald-500/30"
                  >
                    {/* Starting 5 Preview */}
                    <Text className="text-slate-400 text-xs mb-2">Starting 5</Text>
                    <View className="flex-row justify-around mb-2">
                      {/* PG */}
                      {game.basketballLineup.hasPG && (
                        <View className="items-center">
                          {game.basketballLineup.starters.pg ? (
                            <>
                              <PlayerAvatar player={players.find((p) => p.id === game.basketballLineup!.starters.pg)} size={32} />
                              <Text className="text-white text-xs mt-0.5">#{players.find((p) => p.id === game.basketballLineup!.starters.pg)?.number}</Text>
                            </>
                          ) : (
                            <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                              <Text className="text-slate-500 text-xs">PG</Text>
                            </View>
                          )}
                        </View>
                      )}
                      {/* Guards */}
                      {game.basketballLineup.starters.guards.slice(0, game.basketballLineup.numGuards).map((playerId, i) => {
                        const player = playerId ? players.find((p) => p.id === playerId) : null;
                        return (
                          <View key={`g-${i}`} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-xs">G</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {/* Forwards */}
                      {game.basketballLineup.starters.forwards.slice(0, game.basketballLineup.numForwards).map((playerId, i) => {
                        const player = playerId ? players.find((p) => p.id === playerId) : null;
                        return (
                          <View key={`f-${i}`} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-xs">F</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {/* Centers */}
                      {game.basketballLineup.starters.centers.slice(0, game.basketballLineup.numCenters).map((playerId, i) => {
                        const player = playerId ? players.find((p) => p.id === playerId) : null;
                        return (
                          <View key={`c-${i}`} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-xs">C</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Bench count */}
                    {game.basketballLineup.bench.filter(Boolean).length > 0 && (
                      <Text className="text-slate-400 text-xs text-center">
                        + {game.basketballLineup.bench.filter(Boolean).length} on bench
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Batting Order Display - For baseball when lineup is set */}
          {teamSettings.sport === 'baseball' && teamSettings.showLineups !== false && game.battingOrderLineup && hasAssignedBattingOrder(game.battingOrderLineup) && (
            <Animated.View
              entering={FadeInUp.delay(125).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsBattingOrderExpanded(!isBattingOrderExpanded);
                  }}
                  className="p-4 active:bg-emerald-500/30"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <ListOrdered size={20} color="#10b981" />
                      <Text className="text-emerald-400 font-semibold ml-2">
                        Batting Order{(game.battingOrderLineup?.numHitters ?? 9) > 9 ? ` (${game.battingOrderLineup?.numHitters} hitters)` : ''}
                      </Text>
                    </View>
                    {isBattingOrderExpanded ? (
                      <ChevronUp size={20} color="#10b981" />
                    ) : (
                      <ChevronDown size={20} color="#10b981" />
                    )}
                  </View>
                </Pressable>

                {/* Expandable Content */}
                {isBattingOrderExpanded && (
                  <Pressable
                    onPress={canManageTeam() ? () => setIsBattingOrderModalVisible(true) : undefined}
                    className="px-4 pb-4 active:bg-emerald-500/30"
                  >
                    {/* Batting Order Preview */}
                    <View className="gap-1">
                      {(game.battingOrderLineup?.battingOrder ?? []).slice(0, game.battingOrderLineup?.numHitters ?? 9).map((entry, index) => {
                        const player = entry?.playerId ? players.find((p) => p.id === entry.playerId) : null;
                        return (
                          <View key={index} className="flex-row items-center py-1">
                            <Text className="text-emerald-400 font-bold w-6">{index + 1}.</Text>
                            {player ? (
                              <>
                                <Text className="text-white flex-1">{getPlayerName(player)}</Text>
                                <Text className="text-emerald-400 font-semibold">{entry?.position}</Text>
                              </>
                            ) : (
                              <Text className="text-slate-500 flex-1">-</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Batting Order Display - For softball when lineup is set */}
          {teamSettings.sport === 'softball' && teamSettings.showLineups !== false && game.battingOrderLineup && hasAssignedBattingOrder(game.battingOrderLineup) && (
            <Animated.View
              entering={FadeInUp.delay(125).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsBattingOrderExpanded(!isBattingOrderExpanded);
                  }}
                  className="p-4 active:bg-emerald-500/30"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <ListOrdered size={20} color="#10b981" />
                      <Text className="text-emerald-400 font-semibold ml-2">Batting Order ({game.battingOrderLineup?.numHitters ?? 10} hitters)</Text>
                    </View>
                    {isBattingOrderExpanded ? (
                      <ChevronUp size={20} color="#10b981" />
                    ) : (
                      <ChevronDown size={20} color="#10b981" />
                    )}
                  </View>
                </Pressable>

                {/* Expandable Content */}
                {isBattingOrderExpanded && (
                  <Pressable
                    onPress={canManageTeam() ? () => setIsBattingOrderModalVisible(true) : undefined}
                    className="px-4 pb-4 active:bg-emerald-500/30"
                  >
                    {/* Batting Order Preview */}
                    <View className="gap-1">
                      {(game.battingOrderLineup?.battingOrder ?? []).slice(0, game.battingOrderLineup?.numHitters ?? 10).map((entry, index) => {
                        const player = entry?.playerId ? players.find((p) => p.id === entry.playerId) : null;
                        return (
                          <View key={index} className="flex-row items-center py-1">
                            <Text className="text-emerald-400 font-bold w-6">{index + 1}.</Text>
                            {player ? (
                              <>
                                <Text className="text-white flex-1">{getPlayerName(player)}</Text>
                                <Text className="text-emerald-400 font-semibold">{entry?.position}</Text>
                              </>
                            ) : (
                              <Text className="text-slate-500 flex-1">-</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Soccer Lineup Display - Only when lineup is set and has players */}
          {teamSettings.sport === 'soccer' && teamSettings.showLineups !== false && game.soccerLineup && hasAssignedSoccerPlayers(game.soccerLineup) && (
            <Animated.View
              entering={FadeInUp.delay(125).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsSoccerLineupExpanded(!isSoccerLineupExpanded);
                  }}
                  className="p-4 active:bg-emerald-500/30"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <ListOrdered size={20} color="#10b981" />
                      <Text className="text-emerald-400 font-semibold ml-2">Lineup</Text>
                    </View>
                    {isSoccerLineupExpanded ? (
                      <ChevronUp size={20} color="#10b981" />
                    ) : (
                      <ChevronDown size={20} color="#10b981" />
                    )}
                  </View>
                </Pressable>

                {/* Expandable Content */}
                {isSoccerLineupExpanded && (
                  <Pressable
                    onPress={canManageTeam() ? () => setIsSoccerLineupModalVisible(true) : undefined}
                    className="px-4 pb-4 active:bg-emerald-500/30"
                  >
                    {/* Forwards Preview */}
                    <Text className="text-slate-400 text-xs mb-2">Forwards</Text>
                    <View className="flex-row justify-center gap-6 mb-3">
                      {['st1', 'st2'].map((pos) => {
                        const playerId = game.soccerLineup![pos as keyof SoccerLineup];
                        const player = playerId ? players.find((p) => p.id === playerId) : null;
                        return (
                          <View key={pos} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-[10px]">ST</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Midfield Preview */}
                    <Text className="text-slate-400 text-xs mb-2">Midfield</Text>
                    <View className="flex-row justify-around mb-3">
                      {[
                        { key: 'lm', label: 'LM' },
                        { key: 'cm1', label: 'CM' },
                        { key: 'cm2', label: 'CM' },
                        { key: 'rm', label: 'RM' },
                      ].map(({ key, label }) => {
                        const playerId = game.soccerLineup![key as keyof SoccerLineup];
                        const player = playerId ? players.find((p) => p.id === playerId) : null;
                        return (
                          <View key={key} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-[10px]">{label}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Defense Preview */}
                    <Text className="text-slate-400 text-xs mb-2">Defense</Text>
                    <View className="flex-row justify-around mb-3">
                      {[
                        { key: 'lb', label: 'LB' },
                        { key: 'cb1', label: 'CB' },
                        { key: 'cb2', label: 'CB' },
                        { key: 'rb', label: 'RB' },
                      ].map(({ key, label }) => {
                        const playerId = game.soccerLineup![key as keyof SoccerLineup];
                        const player = playerId ? players.find((p) => p.id === playerId) : null;
                        return (
                          <View key={key} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-[10px]">{label}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Goalkeeper Preview */}
                    <Text className="text-slate-400 text-xs mb-2">Goalkeeper</Text>
                    <View className="flex-row justify-center">
                      {(() => {
                        const player = game.soccerLineup!.gk ? players.find((p) => p.id === game.soccerLineup!.gk) : null;
                        return (
                          <View className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-[10px]">GK</Text>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Soccer Diamond Lineup Display - Only when lineup is set and has players */}
          {teamSettings.sport === 'soccer' && teamSettings.showLineups !== false && game.soccerDiamondLineup && hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup) && (
            <Animated.View
              entering={FadeInUp.delay(125).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsSoccerDiamondLineupExpanded(!isSoccerDiamondLineupExpanded);
                  }}
                  className="p-4 active:bg-emerald-500/30"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <ListOrdered size={20} color="#10b981" />
                      <Text className="text-emerald-400 font-semibold ml-2">Lineup (Diamond)</Text>
                    </View>
                    {isSoccerDiamondLineupExpanded ? (
                      <ChevronUp size={20} color="#10b981" />
                    ) : (
                      <ChevronDown size={20} color="#10b981" />
                    )}
                  </View>
                </Pressable>

                {/* Expandable Content */}
                {isSoccerDiamondLineupExpanded && (
                  <Pressable
                    onPress={canManageTeam() ? () => setIsSoccerDiamondLineupModalVisible(true) : undefined}
                    className="px-4 pb-4 active:bg-emerald-500/30"
                  >
                    {/* Forwards Preview */}
                    <Text className="text-slate-400 text-xs mb-2">Forwards</Text>
                    <View className="flex-row justify-center gap-6 mb-3">
                      {['st1', 'st2'].map((pos) => {
                        const playerId = game.soccerDiamondLineup![pos as keyof SoccerDiamondLineup];
                        const player = playerId ? players.find((p) => p.id === playerId) : null;
                        return (
                      <View key={pos} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">ST</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* CAM Preview */}
                <Text className="text-slate-400 text-xs mb-2">Attacking Mid</Text>
                <View className="items-center mb-3">
                  {(() => {
                    const player = game.soccerDiamondLineup!.cam ? players.find((p) => p.id === game.soccerDiamondLineup!.cam) : null;
                    return (
                      <View className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">CAM</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* LM / RM Preview */}
                <Text className="text-slate-400 text-xs mb-2">Wide Mids</Text>
                <View className="flex-row justify-around mb-3">
                  {[
                    { key: 'lm', label: 'LM' },
                    { key: 'rm', label: 'RM' },
                  ].map(({ key, label }) => {
                    const playerId = game.soccerDiamondLineup![key as keyof SoccerDiamondLineup];
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={key} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">{label}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* CDM Preview */}
                <Text className="text-slate-400 text-xs mb-2">Defensive Mid</Text>
                <View className="items-center mb-3">
                  {(() => {
                    const player = game.soccerDiamondLineup!.cdm ? players.find((p) => p.id === game.soccerDiamondLineup!.cdm) : null;
                    return (
                      <View className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">CDM</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* Defense Preview */}
                <Text className="text-slate-400 text-xs mb-2">Defense</Text>
                <View className="flex-row justify-around mb-3">
                  {[
                    { key: 'lb', label: 'LB' },
                    { key: 'cb1', label: 'CB' },
                    { key: 'cb2', label: 'CB' },
                    { key: 'rb', label: 'RB' },
                  ].map(({ key, label }) => {
                    const playerId = game.soccerDiamondLineup![key as keyof SoccerDiamondLineup];
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={key} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">{label}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Goalkeeper Preview */}
                <Text className="text-slate-400 text-xs mb-2">Goalkeeper</Text>
                <View className="flex-row justify-center">
                  {(() => {
                    const player = game.soccerDiamondLineup!.gk ? players.find((p) => p.id === game.soccerDiamondLineup!.gk) : null;
                    return (
                      <View className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">GK</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Lacrosse Lineup Display - Only when lineup is set and has players */}
          {teamSettings.sport === 'lacrosse' && teamSettings.showLineups !== false && game.lacrosseLineup && hasAssignedLacrossePlayers(game.lacrosseLineup) && (
            <Animated.View
              entering={FadeInUp.delay(125).springify()}
              className="mx-4 mb-4"
            >
              <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
                {/* Collapsible Header */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsLacrosseLineupExpanded(!isLacrosseLineupExpanded);
                  }}
                  className="p-4 active:bg-emerald-500/30"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <ListOrdered size={20} color="#10b981" />
                      <Text className="text-emerald-400 font-semibold ml-2">Lineup ({game.lacrosseLineup.numAttackers}A-{game.lacrosseLineup.numMidfielders}M-{game.lacrosseLineup.numDefenders}D)</Text>
                    </View>
                    {isLacrosseLineupExpanded ? (
                      <ChevronUp size={20} color="#10b981" />
                    ) : (
                      <ChevronDown size={20} color="#10b981" />
                    )}
                  </View>
                </Pressable>

                {/* Expandable Content */}
                {isLacrosseLineupExpanded && (
                  <Pressable
                    onPress={canManageTeam() ? () => setIsLacrosseLineupModalVisible(true) : undefined}
                    className="px-4 pb-4 active:bg-emerald-500/30"
                  >

                {/* Attackers Preview */}
                <Text className="text-slate-400 text-xs mb-2">Attackers</Text>
                <View className="flex-row justify-around mb-3">
                  {game.lacrosseLineup.attackers.slice(0, game.lacrosseLineup.numAttackers).map((playerId, index) => {
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={`attacker-${index}`} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">A{index + 1}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Midfielders Preview */}
                <Text className="text-slate-400 text-xs mb-2">Midfielders</Text>
                <View className="flex-row justify-around mb-3">
                  {game.lacrosseLineup.midfielders.slice(0, game.lacrosseLineup.numMidfielders).map((playerId, index) => {
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={`midfielder-${index}`} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">M{index + 1}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Defenders Preview */}
                <Text className="text-slate-400 text-xs mb-2">Defenders</Text>
                <View className="flex-row justify-around mb-3">
                  {game.lacrosseLineup.defenders.slice(0, game.lacrosseLineup.numDefenders).map((playerId, index) => {
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={`defender-${index}`} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">D{index + 1}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Goalie Preview */}
                <Text className="text-slate-400 text-xs mb-2">Goalie</Text>
                <View className="flex-row justify-center">
                  {(() => {
                    const player = game.lacrosseLineup!.goalie ? players.find((p) => p.id === game.lacrosseLineup!.goalie) : null;
                    return (
                      <View className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">G</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

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
                    // Initialize edit state with current values
                    setEditInviteReleaseOption(game.inviteReleaseOption || 'now');
                    setEditInviteReleaseDate(game.inviteReleaseDate ? parseISO(game.inviteReleaseDate) : new Date());
                    setShowEditInviteReleaseDatePicker(false);
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

      {/* Game Settings Modal (Admin only) */}
      <Modal
        visible={isSettingsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsSettingsModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Game Settings</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              {/* Tip for inline editing */}
              <View className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700/50">
                <Text className="text-slate-400 text-sm">
                  Tap any field on the game screen to edit it directly.
                </Text>
              </View>

              {/* Advanced Edit Button */}
              <Pressable
                onPress={openEditModal}
                className="bg-slate-800/60 rounded-xl p-4 mb-4 border border-slate-700/50 active:bg-slate-700/60"
              >
                <View className="flex-row items-center">
                  <Pencil size={20} color="#67e8f9" />
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Advanced Settings</Text>
                    <Text className="text-slate-400 text-sm">Invite release, notes, refreshment duty</Text>
                  </View>
                </View>
              </Pressable>

              {/* Delete Game Button */}
              {isAdmin() && (
                <Pressable
                  onPress={handleDeleteGame}
                  className="bg-red-500/20 rounded-xl p-4 mb-4 border border-red-500/30 active:bg-red-500/30"
                >
                  <View className="flex-row items-center">
                    <Trash2 size={20} color="#ef4444" />
                    <View className="ml-3">
                      <Text className="text-red-400 font-semibold">Delete Game</Text>
                      <Text className="text-slate-400 text-sm">Permanently remove this game</Text>
                    </View>
                  </View>
                </Pressable>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Beer Duty Player Selection Modal */}
      <Modal
        visible={isBeerDutyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsBeerDutyModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsBeerDutyModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">
                {teamSettings.sport === 'hockey' && teamSettings.refreshmentDutyIs21Plus !== false
                  ? 'Assign Post Game Beer Duty'
                  : 'Assign Refreshment Duty'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
              {/* None option to clear selection */}
              <Pressable
                onPress={() => handleSelectBeerDutyPlayer(undefined)}
                className={cn(
                  'flex-row items-center p-4 rounded-xl mb-2 border',
                  !game.beerDutyPlayerId
                    ? 'bg-slate-600/30 border-slate-500/50'
                    : 'bg-slate-800/60 border-slate-700/50'
                )}
              >
                <View className="w-11 h-11 rounded-full bg-slate-700 items-center justify-center">
                  <X size={20} color="#94a3b8" />
                </View>
                <Text className="text-slate-300 font-semibold ml-3 flex-1">None</Text>
                {!game.beerDutyPlayerId && (
                  <CheckCircle2 size={24} color="#94a3b8" />
                )}
              </Pressable>

              {allRosterPlayers.map((player) => (
                <Pressable
                  key={player.id}
                  onPress={() => handleSelectBeerDutyPlayer(player.id)}
                  className={cn(
                    'flex-row items-center p-4 rounded-xl mb-2 border',
                    game.beerDutyPlayerId === player.id
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'bg-slate-800/60 border-slate-700/50'
                  )}
                >
                  <PlayerAvatar player={player} size={44} />
                  <View className="flex-1 ml-3">
                    <Text className="text-white font-semibold">{getPlayerName(player)}</Text>
                    {player.status === 'reserve' && (
                      <Text className="text-slate-400 text-xs">Reserve</Text>
                    )}
                  </View>
                  {game.beerDutyPlayerId === player.id && (
                    <CheckCircle2 size={24} color="#f59e0b" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Edit Game Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Game</Text>
              <Pressable onPress={handleSaveEdit}>
                <Text className="text-cyan-400 font-semibold">Save</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              {/* Opponent */}
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Opponent</Text>
                <TextInput
                  value={editOpponent}
                  onChangeText={setEditOpponent}
                  placeholder="e.g., Ice Wolves"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                />
              </View>

              {/* Date */}
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Date</Text>
                <Pressable
                  onPress={() => setShowEditDatePicker(!showEditDatePicker)}
                  className="bg-slate-800 rounded-xl px-4 py-3"
                >
                  <Text className="text-white text-lg">
                    {format(editDate, 'EEEE, MMMM d, yyyy')}
                  </Text>
                </Pressable>
                {showEditDatePicker && (
                  <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                    <DateTimePicker
                      value={editDate}
                      mode="date"
                      display="inline"
                      onChange={(event, date) => {
                        if (date) setEditDate(date);
                        if (Platform.OS === 'android') setShowEditDatePicker(false);
                      }}
                      themeVariant="dark"
                      accentColor="#67e8f9"
                    />
                  </View>
                )}
              </View>

              {/* Time */}
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Time</Text>
                <Pressable
                  onPress={() => setShowEditTimePicker(!showEditTimePicker)}
                  className="bg-slate-800 rounded-xl px-4 py-3"
                >
                  <Text className="text-white text-lg">
                    {format(editTime, 'h:mm a')}
                  </Text>
                </Pressable>
                {showEditTimePicker && (
                  <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                    <DateTimePicker
                      value={editTime}
                      mode="time"
                      display="spinner"
                      onChange={(event, time) => {
                        if (time) setEditTime(time);
                        if (Platform.OS === 'android') setShowEditTimePicker(false);
                      }}
                      themeVariant="dark"
                      accentColor="#67e8f9"
                    />
                  </View>
                )}
              </View>

              {/* Location */}
              <View className="mb-5" style={{ zIndex: 50 }}>
                <Text className="text-slate-400 text-sm mb-2">Location</Text>
                <AddressSearch
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Search for a venue or address..."
                />
              </View>

              {/* Jersey Color */}
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Jersey Color</Text>
                <View className="flex-row flex-wrap">
                  {teamSettings.jerseyColors.map((color) => (
                    <Pressable
                      key={color.name}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditJersey(color.name);
                      }}
                      className={cn(
                        'flex-row items-center px-4 py-3 rounded-xl mr-2 mb-2 border',
                        editJersey === color.name
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-slate-800 border-slate-700'
                      )}
                    >
                      <View
                        className="w-5 h-5 rounded-full mr-2 border border-white/30"
                        style={{ backgroundColor: color.color }}
                      />
                      <Text
                        className={cn(
                          'font-medium',
                          editJersey === color.name ? 'text-cyan-400' : 'text-slate-400'
                        )}
                      >
                        {color.name}
                      </Text>
                      {editJersey === color.name && (
                        <Check size={16} color="#67e8f9" style={{ marginLeft: 8 }} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Notes (Optional)</Text>
                <TextInput
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Any additional info..."
                  placeholderTextColor="#64748b"
                  autoCapitalize="sentences"
                  multiline
                  numberOfLines={3}
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />
              </View>

              {/* Refreshment Duty Toggle - Only show if team setting is enabled */}
              {teamSettings.showRefreshmentDuty !== false && (
                <View className="mb-5">
                  <View className="flex-row items-center justify-between bg-slate-800 rounded-xl p-4">
                    <View className="flex-row items-center">
                      {teamSettings.refreshmentDutyIs21Plus !== false ? (
                        <Beer size={20} color="#f59e0b" />
                      ) : (
                        <JuiceBoxIcon size={20} color="#a855f7" />
                      )}
                      <Text className="text-white font-medium ml-3">
                        {teamSettings.sport === 'hockey' && teamSettings.refreshmentDutyIs21Plus !== false
                          ? 'Post Game Beer Duty'
                          : 'Refreshment Duty'}
                      </Text>
                    </View>
                    <Switch
                      value={editShowBeerDuty}
                      onValueChange={setEditShowBeerDuty}
                      trackColor={{ false: '#334155', true: teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b40' : '#a855f740' }}
                      thumbColor={editShowBeerDuty ? (teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b' : '#a855f7') : '#64748b'}
                    />
                  </View>
                </View>
              )}

              {/* Invite Release Options */}
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Invite Release</Text>
                {game.invitesSent ? (
                  <View className="bg-green-500/20 rounded-xl p-4 border border-green-500/30">
                    <View className="flex-row items-center">
                      <Check size={20} color="#22c55e" />
                      <Text className="text-green-400 font-medium ml-2">Invites already sent</Text>
                    </View>
                    <Text className="text-slate-400 text-sm mt-1">
                      Players have been notified about this game
                    </Text>
                  </View>
                ) : (
                  <View className="bg-slate-800/50 rounded-xl p-3">
                    {/* Release Now Option */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditInviteReleaseOption('now');
                        setShowEditInviteReleaseDatePicker(false);
                      }}
                      className={cn(
                        'flex-row items-center p-3 rounded-xl mb-2 border',
                        editInviteReleaseOption === 'now'
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-slate-700/50 border-slate-600'
                      )}
                    >
                      <Send size={18} color={editInviteReleaseOption === 'now' ? '#22c55e' : '#64748b'} />
                      <View className="ml-3 flex-1">
                        <Text className={cn(
                          'font-medium',
                          editInviteReleaseOption === 'now' ? 'text-green-400' : 'text-slate-400'
                        )}>
                          Release invites now
                        </Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                          Players will be notified on save
                        </Text>
                      </View>
                      {editInviteReleaseOption === 'now' && <Check size={18} color="#22c55e" />}
                    </Pressable>

                    {/* Schedule Release Option */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditInviteReleaseOption('scheduled');
                        setShowEditInviteReleaseDatePicker(true);
                      }}
                      className={cn(
                        'flex-row items-center p-3 rounded-xl mb-2 border',
                        editInviteReleaseOption === 'scheduled'
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-slate-700/50 border-slate-600'
                      )}
                    >
                      <Bell size={18} color={editInviteReleaseOption === 'scheduled' ? '#22d3ee' : '#64748b'} />
                      <View className="ml-3 flex-1">
                        <Text className={cn(
                          'font-medium',
                          editInviteReleaseOption === 'scheduled' ? 'text-cyan-400' : 'text-slate-400'
                        )}>
                          Schedule release
                        </Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                          Choose when to notify players
                        </Text>
                      </View>
                      {editInviteReleaseOption === 'scheduled' && <Check size={18} color="#22d3ee" />}
                    </Pressable>

                    {/* Schedule Date/Time Picker */}
                    {editInviteReleaseOption === 'scheduled' && (
                      <View className="mt-2">
                        <Pressable
                          onPress={() => setShowEditInviteReleaseDatePicker(!showEditInviteReleaseDatePicker)}
                          className="bg-slate-700/80 rounded-xl px-4 py-3"
                        >
                          <Text className="text-cyan-400 text-base">
                            {format(editInviteReleaseDate, 'EEE, MMM d, yyyy h:mm a')}
                          </Text>
                        </Pressable>
                        {showEditInviteReleaseDatePicker && (
                          <View className="bg-slate-700/80 rounded-xl mt-2 overflow-hidden items-center">
                            <DateTimePicker
                              value={editInviteReleaseDate}
                              mode="datetime"
                              display="inline"
                              onChange={(event, date) => {
                                if (date) setEditInviteReleaseDate(date);
                                if (Platform.OS === 'android') setShowEditInviteReleaseDatePicker(false);
                              }}
                              minimumDate={new Date()}
                              themeVariant="dark"
                              accentColor="#22d3ee"
                            />
                          </View>
                        )}
                      </View>
                    )}

                    {/* Don't Send Option */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditInviteReleaseOption('none');
                        setShowEditInviteReleaseDatePicker(false);
                      }}
                      className={cn(
                        'flex-row items-center p-3 rounded-xl border',
                        editInviteReleaseOption === 'none'
                          ? 'bg-slate-600/50 border-slate-500'
                          : 'bg-slate-800/50 border-transparent'
                      )}
                    >
                      <BellOff size={18} color={editInviteReleaseOption === 'none' ? '#94a3b8' : '#64748b'} />
                      <View className="ml-3 flex-1">
                        <Text className={cn(
                          'font-medium',
                          editInviteReleaseOption === 'none' ? 'text-slate-300' : 'text-slate-400'
                        )}>
                          Don't send invites
                        </Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                          Send manually later
                        </Text>
                      </View>
                      {editInviteReleaseOption === 'none' && <Check size={18} color="#94a3b8" />}
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Release Invites Modal */}
      <Modal
        visible={isReleaseInvitesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsReleaseInvitesModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsReleaseInvitesModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Release Invites</Text>
              <Pressable onPress={handleSaveReleaseInvites}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              <View className="bg-slate-800/50 rounded-xl p-3">
                {/* Release Now Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditInviteReleaseOption('now');
                    setShowEditInviteReleaseDatePicker(false);
                  }}
                  className={cn(
                    'flex-row items-center p-3 rounded-xl mb-2 border',
                    editInviteReleaseOption === 'now'
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'bg-slate-700/50 border-slate-600'
                  )}
                >
                  <Send size={18} color={editInviteReleaseOption === 'now' ? '#22c55e' : '#64748b'} />
                  <View className="ml-3 flex-1">
                    <Text className={cn(
                      'font-medium',
                      editInviteReleaseOption === 'now' ? 'text-green-400' : 'text-slate-400'
                    )}>
                      Release invites now
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      Players will be notified immediately
                    </Text>
                  </View>
                  {editInviteReleaseOption === 'now' && <Check size={18} color="#22c55e" />}
                </Pressable>

                {/* Schedule Release Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditInviteReleaseOption('scheduled');
                    setShowEditInviteReleaseDatePicker(true);
                  }}
                  className={cn(
                    'flex-row items-center p-3 rounded-xl mb-2 border',
                    editInviteReleaseOption === 'scheduled'
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : 'bg-slate-700/50 border-slate-600'
                  )}
                >
                  <Bell size={18} color={editInviteReleaseOption === 'scheduled' ? '#22d3ee' : '#64748b'} />
                  <View className="ml-3 flex-1">
                    <Text className={cn(
                      'font-medium',
                      editInviteReleaseOption === 'scheduled' ? 'text-cyan-400' : 'text-slate-400'
                    )}>
                      Schedule release
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      Choose when to notify players
                    </Text>
                  </View>
                  {editInviteReleaseOption === 'scheduled' && <Check size={18} color="#22d3ee" />}
                </Pressable>

                {/* Schedule Date/Time Picker */}
                {editInviteReleaseOption === 'scheduled' && (
                  <View className="mt-2 mb-2">
                    <Pressable
                      onPress={() => setShowEditInviteReleaseDatePicker(!showEditInviteReleaseDatePicker)}
                      className="bg-slate-700/80 rounded-xl px-4 py-3"
                    >
                      <Text className="text-cyan-400 text-base">
                        {format(editInviteReleaseDate, 'EEE, MMM d, yyyy h:mm a')}
                      </Text>
                    </Pressable>
                    {showEditInviteReleaseDatePicker && (
                      <View className="bg-slate-700/80 rounded-xl mt-2 overflow-hidden items-center">
                        <DateTimePicker
                          value={editInviteReleaseDate}
                          mode="datetime"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={(evt, date) => {
                            if (date) setEditInviteReleaseDate(date);
                            if (Platform.OS === 'android') setShowEditInviteReleaseDatePicker(false);
                          }}
                          minimumDate={new Date()}
                          themeVariant="dark"
                          accentColor="#22d3ee"
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Don't Send Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditInviteReleaseOption('none');
                    setShowEditInviteReleaseDatePicker(false);
                  }}
                  className={cn(
                    'flex-row items-center p-3 rounded-xl border',
                    editInviteReleaseOption === 'none'
                      ? 'bg-slate-600/50 border-slate-500'
                      : 'bg-slate-700/50 border-slate-600'
                  )}
                >
                  <BellOff size={18} color={editInviteReleaseOption === 'none' ? '#94a3b8' : '#64748b'} />
                  <View className="ml-3 flex-1">
                    <Text className={cn(
                      'font-medium',
                      editInviteReleaseOption === 'none' ? 'text-slate-300' : 'text-slate-400'
                    )}>
                      Don't send invites
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      Send manually later
                    </Text>
                  </View>
                  {editInviteReleaseOption === 'none' && <Check size={18} color="#94a3b8" />}
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Invite More Players Modal */}
      <Modal
        visible={isInviteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsInviteModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsInviteModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Invite Players</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              {uninvitedPlayers.length === 0 ? (
                <View className="items-center py-8">
                  <Users size={48} color="#64748b" />
                  <Text className="text-slate-400 text-center mt-4">
                    All players have been invited
                  </Text>
                </View>
              ) : (
                <>
                  {/* Quick Actions */}
                  <View className="flex-row mb-4">
                    {uninvitedActive.length > 0 && (
                      <Pressable
                        onPress={() => handleInviteMultiplePlayers(uninvitedActive.map((p) => p.id))}
                        className="flex-1 py-3 rounded-xl mr-2 bg-green-500/20 border border-green-500/50 items-center"
                      >
                        <Text className="text-green-400 font-medium">
                          Invite All Active ({uninvitedActive.length})
                        </Text>
                      </Pressable>
                    )}
                    {uninvitedReserve.length > 0 && (
                      <Pressable
                        onPress={() => handleInviteMultiplePlayers(uninvitedReserve.map((p) => p.id))}
                        className="flex-1 py-3 rounded-xl bg-amber-500/20 border border-amber-500/50 items-center"
                      >
                        <Text className="text-amber-400 font-medium">
                          Invite All Reserve ({uninvitedReserve.length})
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Uninvited Active Players */}
                  {uninvitedActive.length > 0 && (
                    <>
                      <Text className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">
                        Active Players
                      </Text>
                      {uninvitedActive.map((player) => (
                        <Pressable
                          key={player.id}
                          onPress={() => handleInvitePlayer(player.id)}
                          className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50 active:bg-slate-700/80"
                        >
                          <PlayerAvatar player={player} size={44} />
                          <View className="flex-1 ml-3">
                            <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                            <Text className="text-slate-400 text-sm">#{player.number}</Text>
                          </View>
                          <View className="bg-cyan-500 rounded-lg px-3 py-1.5">
                            <Text className="text-white font-medium text-sm">Invite</Text>
                          </View>
                        </Pressable>
                      ))}
                    </>
                  )}

                  {/* Uninvited Reserve Players */}
                  {uninvitedReserve.length > 0 && (
                    <>
                      <Text className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-4">
                        Reserve Players
                      </Text>
                      {uninvitedReserve.map((player) => (
                        <Pressable
                          key={player.id}
                          onPress={() => handleInvitePlayer(player.id)}
                          className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50 active:bg-slate-700/80"
                        >
                          <PlayerAvatar player={player} size={44} />
                          <View className="flex-1 ml-3">
                            <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                            <Text className="text-slate-400 text-sm">#{player.number}</Text>
                          </View>
                          <View className="bg-cyan-500 rounded-lg px-3 py-1.5">
                            <Text className="text-white font-medium text-sm">Invite</Text>
                          </View>
                        </Pressable>
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Lineup Editor Modal */}
      <LineupEditor
        visible={isLineupModalVisible}
        onClose={() => setIsLineupModalVisible(false)}
        onSave={handleSaveLineup}
        initialLineup={game.lineup}
        availablePlayers={checkedInPlayers}
      />

      {/* Basketball Lineup Editor Modal */}
      <BasketballLineupEditor
        visible={isBasketballLineupModalVisible}
        onClose={() => setIsBasketballLineupModalVisible(false)}
        onSave={handleSaveBasketballLineup}
        initialLineup={game.basketballLineup}
        availablePlayers={checkedInPlayers}
      />

      {/* Baseball Lineup Editor Modal */}
      <BaseballLineupEditor
        visible={isBaseballLineupModalVisible}
        onClose={() => setIsBaseballLineupModalVisible(false)}
        onSave={handleSaveBaseballLineup}
        initialLineup={game.baseballLineup}
        players={checkedInPlayers}
        isSoftball={teamSettings.isSoftball}
      />

      {/* Soccer Lineup Editor Modal */}
      <SoccerLineupEditor
        visible={isSoccerLineupModalVisible}
        onClose={() => setIsSoccerLineupModalVisible(false)}
        onSave={handleSaveSoccerLineup}
        initialLineup={game.soccerLineup}
        players={checkedInPlayers}
      />

      {/* Soccer Diamond Lineup Editor Modal */}
      <SoccerDiamondLineupEditor
        visible={isSoccerDiamondLineupModalVisible}
        onClose={() => setIsSoccerDiamondLineupModalVisible(false)}
        onSave={handleSaveSoccerDiamondLineup}
        initialLineup={game.soccerDiamondLineup}
        players={checkedInPlayers}
      />

      {/* Lacrosse Lineup Editor Modal */}
      <LacrosseLineupEditor
        visible={isLacrosseLineupModalVisible}
        onClose={() => setIsLacrosseLineupModalVisible(false)}
        onSave={handleSaveLacrosseLineup}
        initialLineup={game.lacrosseLineup}
        availablePlayers={checkedInPlayers}
      />

      {/* Batting Order Lineup Editor Modal */}
      {(teamSettings.sport === 'baseball' || teamSettings.sport === 'softball') && (
        <BattingOrderLineupEditor
          visible={isBattingOrderModalVisible}
          onClose={() => setIsBattingOrderModalVisible(false)}
          onSave={handleSaveBattingOrderLineup}
          initialLineup={game.battingOrderLineup}
          availablePlayers={checkedInPlayers}
          sport={teamSettings.sport}
        />
      )}

      {/* Soccer Formation Selector Modal */}
      <Modal
        visible={isSoccerFormationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSoccerFormationModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsSoccerFormationModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Choose Formation</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              {/* 4-4-2 Formation */}
              <Pressable
                onPress={() => handleSelectSoccerFormation('442')}
                className={cn(
                  'rounded-2xl p-5 mb-4 border',
                  hasAssignedSoccerPlayers(game.soccerLineup)
                    ? 'bg-emerald-500/20 border-emerald-500/50'
                    : 'bg-slate-800/60 border-slate-700/50'
                )}
              >
                <Text className="text-white text-lg font-semibold mb-2">4-4-2</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Classic formation with 4 defenders, 4 midfielders, and 2 strikers
                </Text>
                {/* Visual representation */}
                <View className="bg-slate-700/30 rounded-xl p-4">
                  {/* Strikers */}
                  <View className="flex-row justify-center gap-6 mb-3">
                    <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                      <Text className="text-emerald-400 text-[10px]">ST</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                      <Text className="text-emerald-400 text-[10px]">ST</Text>
                    </View>
                  </View>
                  {/* Midfield */}
                  <View className="flex-row justify-around mb-3">
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[10px]">LM</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[10px]">CM</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[10px]">CM</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[10px]">RM</Text>
                    </View>
                  </View>
                  {/* Defense */}
                  <View className="flex-row justify-around mb-3">
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">LB</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">CB</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">CB</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">RB</Text>
                    </View>
                  </View>
                  {/* GK */}
                  <View className="items-center">
                    <View className="w-10 h-10 rounded-full bg-purple-500/40 items-center justify-center">
                      <Text className="text-purple-400 text-[10px]">GK</Text>
                    </View>
                  </View>
                </View>
                {hasAssignedSoccerPlayers(game.soccerLineup) && (
                  <Text className="text-emerald-400 text-sm mt-3 text-center">Currently configured</Text>
                )}
              </Pressable>

              {/* Diamond 4-1-2-1-2 Formation */}
              <Pressable
                onPress={() => handleSelectSoccerFormation('diamond')}
                className={cn(
                  'rounded-2xl p-5 mb-4 border',
                  hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup)
                    ? 'bg-emerald-500/20 border-emerald-500/50'
                    : 'bg-slate-800/60 border-slate-700/50'
                )}
              >
                <Text className="text-white text-lg font-semibold mb-2">Diamond 4-1-2-1-2</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Diamond midfield with CDM, LM, RM, and CAM
                </Text>
                {/* Visual representation */}
                <View className="bg-slate-700/30 rounded-xl p-4">
                  {/* Strikers */}
                  <View className="flex-row justify-center gap-6 mb-3">
                    <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                      <Text className="text-emerald-400 text-[10px]">ST</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                      <Text className="text-emerald-400 text-[10px]">ST</Text>
                    </View>
                  </View>
                  {/* CAM */}
                  <View className="items-center mb-3">
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[8px]">CAM</Text>
                    </View>
                  </View>
                  {/* LM / RM */}
                  <View className="flex-row justify-around mb-3">
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[10px]">LM</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[10px]">RM</Text>
                    </View>
                  </View>
                  {/* CDM */}
                  <View className="items-center mb-3">
                    <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                      <Text className="text-cyan-400 text-[8px]">CDM</Text>
                    </View>
                  </View>
                  {/* Defense */}
                  <View className="flex-row justify-around mb-3">
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">LB</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">CB</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">CB</Text>
                    </View>
                    <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                      <Text className="text-amber-400 text-[10px]">RB</Text>
                    </View>
                  </View>
                  {/* GK */}
                  <View className="items-center">
                    <View className="w-10 h-10 rounded-full bg-purple-500/40 items-center justify-center">
                      <Text className="text-purple-400 text-[10px]">GK</Text>
                    </View>
                  </View>
                </View>
                {hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup) && (
                  <Text className="text-emerald-400 text-sm mt-3 text-center">Currently configured</Text>
                )}
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Opponent Modal */}
      <Modal
        visible={isEditOpponentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditOpponentModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditOpponentModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Opponent</Text>
              <Pressable onPress={handleSaveOpponent}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6">
              <Text className="text-slate-400 text-sm mb-2">Opponent Name</Text>
              <TextInput
                value={editOpponent}
                onChangeText={setEditOpponent}
                placeholder="e.g., Ice Wolves"
                placeholderTextColor="#64748b"
                autoCapitalize="words"
                autoFocus
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Date Modal */}
      <Modal
        visible={isEditDateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditDateModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditDateModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Date</Text>
              <Pressable onPress={handleSaveDate}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6 items-center">
              <DateTimePicker
                value={editDate}
                mode="date"
                display="inline"
                onChange={(event, date) => {
                  if (date) setEditDate(date);
                }}
                themeVariant="dark"
                accentColor="#67e8f9"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Time Modal */}
      <Modal
        visible={isEditTimeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditTimeModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditTimeModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Time</Text>
              <Pressable onPress={handleSaveTime}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6 items-center">
              <DateTimePicker
                value={editTime}
                mode="time"
                display="spinner"
                onChange={(event, time) => {
                  if (time) setEditTime(time);
                }}
                themeVariant="dark"
                accentColor="#67e8f9"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Jersey Modal */}
      <Modal
        visible={isEditJerseyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditJerseyModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditJerseyModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Select Jersey</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView className="flex-1 px-5 pt-4">
              {teamSettings.jerseyColors.map((color) => (
                <Pressable
                  key={color.name}
                  onPress={() => handleSaveJersey(color.name)}
                  className={cn(
                    'flex-row items-center p-4 rounded-xl mb-2 border',
                    game.jerseyColor === color.name
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : 'bg-slate-800/60 border-slate-700/50'
                  )}
                >
                  <View
                    className="w-10 h-10 rounded-full mr-3 border-2 border-white/30"
                    style={{ backgroundColor: color.color }}
                  />
                  <Text
                    className={cn(
                      'font-semibold flex-1',
                      game.jerseyColor === color.name ? 'text-cyan-400' : 'text-white'
                    )}
                  >
                    {color.name}
                  </Text>
                  {game.jerseyColor === color.name && (
                    <CheckCircle2 size={24} color="#67e8f9" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Location Modal */}
      <Modal
        visible={isEditLocationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditLocationModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditLocationModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Location</Text>
              <Pressable onPress={handleSaveLocation}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6" style={{ zIndex: 50 }}>
              <Text className="text-slate-400 text-sm mb-2">Venue or Address</Text>
              <AddressSearch
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Search for a venue or address..."
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Notes Modal */}
      <Modal
        visible={isEditNotesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditNotesModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditNotesModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Notes</Text>
              <Pressable onPress={() => {
                updateGameAndSync(game.id, { notes: editNotes.trim() });
                setIsEditNotesModalVisible(false);
              }}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-slate-400 text-sm">Notes</Text>
                <Text className={cn(
                  "text-sm",
                  editNotes.length > 30 ? "text-red-500" : "text-slate-500"
                )}>{editNotes.length}/30</Text>
              </View>
              <TextInput
                value={editNotes}
                onChangeText={(text) => {
                  if (text.length <= 30) {
                    setEditNotes(text);
                  }
                }}
                placeholder="Add a short note..."
                placeholderTextColor="#64748b"
                maxLength={30}
                className="bg-slate-800 rounded-xl p-4 text-white text-base"
                autoFocus
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Game Stats Modal */}
      <Modal
        visible={isGameStatsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsGameStatsModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable
                onPress={() => setIsGameStatsModalVisible(false)}
                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Game Stats</Text>
              <Pressable
                onPress={saveGameStats}
                className="w-10 h-10 rounded-full bg-violet-500 items-center justify-center"
              >
                <Check size={24} color="#fff" />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
              {/* Player Info */}
              {selectedStatsPlayer && (
                <View className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-4">
                  <PlayerAvatar player={selectedStatsPlayer} size={48} borderWidth={2} borderColor="#8b5cf6" />
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-base font-semibold">
                      {selectedStatsPlayer.firstName} {selectedStatsPlayer.lastName}
                    </Text>
                    <Text className="text-slate-400 text-sm">#{selectedStatsPlayer.number}</Text>
                  </View>
                  <View className="bg-violet-500/20 px-3 py-1.5 rounded-lg">
                    <Text className="text-violet-400 text-xs font-medium">
                      {gameStatsEditMode === 'skater'
                        ? (teamSettings.sport === 'hockey' ? 'Skater' : 'Player')
                        : gameStatsEditMode === 'lacrosse_goalie'
                          ? 'Goalie'
                          : gameStatsEditMode === 'lacrosse'
                            ? 'Player'
                            : gameStatsEditMode === 'batter'
                              ? (teamSettings.sport === 'basketball' ? 'Player' : 'Batter')
                              : gameStatsEditMode.charAt(0).toUpperCase() + gameStatsEditMode.slice(1)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Game Info */}
              <View className="bg-slate-800/40 rounded-xl p-3 mb-4">
                <View className="flex-row items-center">
                  <Calendar size={16} color="#64748b" />
                  <Text className="text-slate-400 text-sm ml-2">
                    vs {game.opponent} • {format(parseISO(game.date), 'MMM d, yyyy')}
                  </Text>
                </View>
              </View>

              {/* Stat Fields */}
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Enter Stats
              </Text>

              {currentGameStatFields.map((field) => (
                <View key={field.key} className="mb-3">
                  <Text className="text-slate-400 text-xs mb-1.5">{field.label}</Text>
                  {field.key === 'plusMinus' ? (
                    // Special +/- control with increment/decrement buttons
                    <View className="flex-row items-center">
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const current = parseInt(editGameStats[field.key] || '0', 10) || 0;
                          setEditGameStats({ ...editGameStats, [field.key]: String(current - 1) });
                        }}
                        className="bg-red-500/20 border border-red-500/50 rounded-lg w-14 h-11 items-center justify-center active:bg-red-500/40"
                      >
                        <Text className="text-red-400 text-xl font-bold">−</Text>
                      </Pressable>
                      <View className="flex-1 mx-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700 items-center">
                        <Text className="text-white text-lg font-semibold">
                          {(() => {
                            const val = parseInt(editGameStats[field.key] || '0', 10) || 0;
                            return val > 0 ? `+${val}` : String(val);
                          })()}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const current = parseInt(editGameStats[field.key] || '0', 10) || 0;
                          setEditGameStats({ ...editGameStats, [field.key]: String(current + 1) });
                        }}
                        className="bg-green-500/20 border border-green-500/50 rounded-lg w-14 h-11 items-center justify-center active:bg-green-500/40"
                      >
                        <Text className="text-green-400 text-xl font-bold">+</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <TextInput
                      className="bg-slate-800 rounded-lg px-3 py-2.5 text-white text-base border border-slate-700"
                      value={editGameStats[field.key] === '0' ? '' : editGameStats[field.key]}
                      onChangeText={(text) => setEditGameStats({ ...editGameStats, [field.key]: text.replace(/[^0-9-]/g, '') || '0' })}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#64748b"
                    />
                  )}
                </View>
              ))}

              {/* Save Button */}
              <Pressable
                onPress={saveGameStats}
                className="bg-violet-500 rounded-xl py-3.5 items-center mt-4 mb-8 active:bg-violet-600"
              >
                <Text className="text-white text-base font-semibold">Save Stats</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
