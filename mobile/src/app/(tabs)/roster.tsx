import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Users,
  X,
  Shield,
  Phone,
  Mail,
  MessageSquare,
  Send,
  Check,
  Cross,
  UserPlus,
  UserCog,
  User,
  UserMinus,
  Heart,
  Calendar,
  ChevronDown,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { useTeamStore, Player, SPORT_POSITIONS, SPORT_POSITION_NAMES, PlayerRole, PlayerStatus, Sport, HockeyStats, HockeyGoalieStats, BaseballStats, BaseballPitcherStats, BasketballStats, SoccerStats, SoccerGoalieStats, LacrosseStats, LacrosseGoalieStats, PlayerStats, getPlayerPositions, getPrimaryPosition, getPlayerName, StatusDuration, DurationUnit } from '@/lib/store';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { cn } from '@/lib/cn';
import { createTeamInvitation } from '@/lib/team-invitations';
import { useResponsive } from '@/lib/useResponsive';
import { formatPhoneInput, formatPhoneNumber, unformatPhone } from '@/lib/phone';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ParentChildIcon } from '@/components/ParentChildIcon';

// Format status duration for display
function formatStatusDuration(duration: StatusDuration | undefined): string {
  if (!duration) return '';
  if (duration.unit === 'remainder_of_season') {
    return 'Rest of season';
  }
  const value = duration.value || 0;
  if (duration.unit === 'days') {
    return `${value} ${value === 1 ? 'day' : 'days'}`;
  }
  if (duration.unit === 'weeks') {
    return `${value} ${value === 1 ? 'week' : 'weeks'}`;
  }
  if (duration.unit === 'games') {
    return `${value} ${value === 1 ? 'game' : 'games'}`;
  }
  return '';
}

// Check if player is a goalie
function isGoalie(position: string): boolean {
  return position === 'G' || position === 'GK';
}

// Check if player is a pitcher
function isPitcher(position: string): boolean {
  return position === 'P';
}

// Format name as "F. LastName"
function formatName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return `${firstName.charAt(0)}. ${lastName}`;
}

// Get stat column headers based on sport
function getStatHeaders(sport: Sport): string[] {
  switch (sport) {
    case 'hockey':
      return ['GP', 'G', 'A', 'P', 'PIM', '+/-'];
    case 'baseball':
    case 'softball':
      return ['AB', 'H', 'BB', 'K', 'RBI', 'R', 'HR'];
    case 'basketball':
      return ['GP', 'PTS', 'PPG', 'REB', 'AST', 'STL', 'BLK'];
    case 'soccer':
      return ['GP', 'G', 'A', 'YC'];
    case 'lacrosse':
      return ['GP', 'G', 'A', 'P', 'GB', 'CT'];
    default:
      return ['GP', 'G', 'A', 'P', 'PIM', '+/-'];
  }
}

// Get goalie stat headers (includes GAA for both hockey and soccer)
function getGoalieHeaders(sport: Sport): string[] {
  // Soccer uses W-L-D (Draws), hockey uses W-L-T (Ties)
  if (sport === 'lacrosse') {
    return ['GP', 'W-L', 'GAA', 'SA', 'SV', 'SV%', 'GB'];
  }
  const recordHeader = sport === 'soccer' ? 'W-L-D' : 'W-L-T';
  return ['GP', recordHeader, 'MP', 'GAA', 'SA', 'SV', 'SV%'];
}

// Get pitcher stat headers
function getPitcherHeaders(): string[] {
  return ['GS', 'W-L', 'IP', 'CG', 'SO', 'K', 'BB', 'HR', 'ERA'];
}

// Get stat values based on sport
// Pass 'batter' as position to force batting stats for a pitcher who also plays field positions
function getStatValues(sport: Sport, stats: PlayerStats | undefined, position: string): (number | string)[] {
  const playerIsGoalie = isGoalie(position);
  const playerIsPitcher = isPitcher(position);
  const forceBatterStats = position === 'batter'; // Special case for pitcher/position players

  if (!stats) {
    if (playerIsGoalie && sport === 'lacrosse') {
      return [0, '0-0', '0.00', 0, 0, '.000', 0];
    }
    if (playerIsGoalie && (sport === 'hockey' || sport === 'soccer')) {
      return [0, '0-0-0', 0, '0.00', 0, 0, '.000'];
    }
    if (playerIsPitcher && (sport === 'baseball' || sport === 'softball')) {
      return [0, '0-0', 0, 0, 0, 0, 0, 0, '0.00'];
    }
    if (sport === 'hockey') return [0, 0, 0, 0, 0, 0];
    if (sport === 'baseball' || sport === 'softball') return [0, 0, 0, 0, 0, 0, 0];
    if (sport === 'basketball') return [0, 0, '0.0', 0, 0, 0, 0];
    if (sport === 'soccer') return [0, 0, 0, 0];
    if (sport === 'lacrosse') return [0, 0, 0, 0, 0, 0];
    return [0, 0, 0];
  }

  // Handle lacrosse goalie stats
  if (playerIsGoalie && sport === 'lacrosse') {
    const s = stats as LacrosseGoalieStats;
    const record = `${s.wins ?? 0}-${s.losses ?? 0}`;
    const savePercentage = s.shotsAgainst > 0
      ? (s.saves / s.shotsAgainst).toFixed(3)
      : '.000';
    const mp = s.minutesPlayed ?? 0;
    // Lacrosse GAA = (Goals Against / Minutes Played) x 60
    const gaa = mp > 0 ? ((s.goalsAgainst ?? 0) / mp * 60).toFixed(2) : '0.00';
    return [s.games ?? 0, record, gaa, s.shotsAgainst ?? 0, s.saves ?? 0, savePercentage, s.groundBalls ?? 0];
  }

  // Handle goalie stats for hockey/soccer
  if (playerIsGoalie && (sport === 'hockey' || sport === 'soccer')) {
    const s = stats as HockeyGoalieStats | SoccerGoalieStats;
    const record = `${s.wins ?? 0}-${s.losses ?? 0}-${s.ties ?? 0}`;
    const savePercentage = s.shotsAgainst > 0
      ? (s.saves / s.shotsAgainst).toFixed(3)
      : '.000';
    const mp = s.minutesPlayed ?? 0;

    // Hockey GAA = (Goals Against x 60) / Minutes Played
    // Soccer GAA = (Goals Against / Minutes Played) x 90
    let gaa: string;
    if (sport === 'hockey') {
      gaa = mp > 0 ? ((s.goalsAgainst ?? 0) * 60 / mp).toFixed(2) : '0.00';
    } else {
      gaa = mp > 0 ? ((s.goalsAgainst ?? 0) / mp * 90).toFixed(2) : '0.00';
    }

    return [s.games ?? 0, record, mp, gaa, s.shotsAgainst ?? 0, s.saves ?? 0, savePercentage];
  }

  // Handle pitcher stats for baseball/softball (but not if we're forcing batter stats)
  if (playerIsPitcher && (sport === 'baseball' || sport === 'softball') && !forceBatterStats) {
    const s = stats as BaseballPitcherStats;
    const record = `${s.wins ?? 0}-${s.losses ?? 0}`;
    const ip = s.innings ?? 0;
    // ERA = (Earned Runs / Innings Pitched) x 9
    const era = ip > 0 ? ((s.earnedRuns ?? 0) / ip * 9).toFixed(2) : '0.00';
    return [s.starts ?? 0, record, ip, s.completeGames ?? 0, s.shutouts ?? 0, s.strikeouts ?? 0, s.walks ?? 0, s.homeRuns ?? 0, era];
  }

  switch (sport) {
    case 'hockey': {
      const s = stats as HockeyStats;
      const points = (s.goals ?? 0) + (s.assists ?? 0);
      const plusMinus = s.plusMinus ?? 0;
      const plusMinusStr = plusMinus > 0 ? `+${plusMinus}` : `${plusMinus}`;
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, points, s.pim ?? 0, plusMinusStr];
    }
    case 'baseball':
    case 'softball': {
      // For pitcher/position players, stats object may be BaseballPitcherStats
      // but we need to read the batting fields which are stored separately
      const s = stats as BaseballStats;
      return [s.atBats ?? 0, s.hits ?? 0, s.walks ?? 0, s.strikeouts ?? 0, s.rbi ?? 0, s.runs ?? 0, s.homeRuns ?? 0];
    }
    case 'basketball': {
      const s = stats as BasketballStats;
      const gp = s.gamesPlayed ?? 0;
      const ppg = gp > 0 ? ((s.points ?? 0) / gp).toFixed(1) : '0.0';
      return [gp, s.points ?? 0, ppg, s.rebounds ?? 0, s.assists ?? 0, s.steals ?? 0, s.blocks ?? 0];
    }
    case 'soccer': {
      const s = stats as SoccerStats;
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, s.yellowCards ?? 0];
    }
    case 'lacrosse': {
      const s = stats as LacrosseStats;
      const points = (s.goals ?? 0) + (s.assists ?? 0);
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, points, s.groundBalls ?? 0, s.causedTurnovers ?? 0];
    }
    default:
      return [0, 0, 0];
  }
}

interface PlayerCardProps {
  player: Player;
  index: number;
  onPress: () => void;
  showStats?: boolean;
  isCurrentUser?: boolean;
  canEditOwnStats?: boolean;
  associatedPlayerName?: string;
}

function PlayerCard({ player, index, onPress, showStats = true, isCurrentUser = false, canEditOwnStats = false, associatedPlayerName }: PlayerCardProps) {
  const sport = useTeamStore((s) => s.teamSettings.sport);
  const playerPositions = getPlayerPositions(player);
  const primaryPosition = getPrimaryPosition(player);

  // Coaches and parents never show stats
  const isCoachOrParent = player.position === 'Coach' || player.position === 'Parent' ||
    player.roles?.includes('coach') || player.roles?.includes('parent');
  const effectiveShowStats = showStats && !isCoachOrParent;

  // Format position display - show all positions joined by "/"
  const positionDisplay = playerPositions.length > 1
    ? playerPositions.join('/')
    : SPORT_POSITION_NAMES[sport][primaryPosition] || primaryPosition;

  // Check if player has both pitcher and non-pitcher positions (baseball only)
  const hasPitcherPosition = sport === 'baseball' && playerPositions.some(pos => isPitcher(pos));
  const hasNonPitcherPosition = sport === 'baseball' && playerPositions.some(pos => !isPitcher(pos));
  const showBothBaseballStats = hasPitcherPosition && hasNonPitcherPosition;

  // Check if player has both goalie and non-goalie positions (hockey/soccer)
  const hasGoaliePosition = (sport === 'hockey' || sport === 'soccer') && playerPositions.some(pos => isGoalie(pos));
  const hasNonGoaliePosition = (sport === 'hockey' || sport === 'soccer') && playerPositions.some(pos => !isGoalie(pos));
  const showBothGoalieStats = hasGoaliePosition && hasNonGoaliePosition;

  // Get stat headers and values for this player (based on primary position)
  const playerIsGoalieOnly = isGoalie(primaryPosition) && !hasNonGoaliePosition;
  const playerIsPitcherOnly = isPitcher(primaryPosition) && !hasNonPitcherPosition;

  // For players with both positions, always show skater/batter stats first
  let headers: string[];
  let statValues: (number | string)[];

  if (showBothGoalieStats) {
    // Show skater stats as primary for dual position players
    headers = getStatHeaders(sport);
    statValues = getStatValues(sport, player.stats, 'C'); // Use non-goalie position
  } else if (showBothBaseballStats) {
    // Show batting stats as primary for dual position players
    headers = getStatHeaders(sport);
    statValues = getStatValues(sport, player.stats, 'batter');
  } else if (playerIsGoalieOnly && (sport === 'hockey' || sport === 'soccer')) {
    headers = getGoalieHeaders(sport);
    statValues = getStatValues(sport, player.goalieStats, primaryPosition);
  } else if (playerIsPitcherOnly && sport === 'baseball') {
    headers = getPitcherHeaders();
    statValues = getStatValues(sport, player.pitcherStats, primaryPosition);
  } else {
    headers = getStatHeaders(sport);
    statValues = getStatValues(sport, player.stats, primaryPosition);
  }

  // Get goalie stats if player has both goalie and non-goalie positions
  const goalieHeaders = showBothGoalieStats ? getGoalieHeaders(sport) : [];
  const goalieStatValues = showBothGoalieStats ? getStatValues(sport, player.goalieStats, sport === 'hockey' ? 'G' : 'GK') : [];

  // Get pitching stats if player has both pitcher and non-pitcher positions
  const pitchingHeaders = showBothBaseballStats ? getPitcherHeaders() : [];
  const pitchingStatValues = showBothBaseballStats ? getStatValues(sport, player.pitcherStats, 'P') : [];

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable
        onPress={onPress}
        className="bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/40 active:bg-slate-700/80"
      >
        <View className="flex-row items-center">
          <View className="relative">
            <PlayerAvatar player={player} size={44} />
            <View className="absolute -bottom-0.5 -right-0.5 bg-slate-700 rounded-full px-1.5 py-0">
              <Text className="text-white text-[10px] font-bold">#{player.number}</Text>
            </View>
          </View>

          <View className="flex-1 ml-3">
            <View className="flex-row items-center">
              <Text className="text-white text-base font-semibold">{getPlayerName(player)}</Text>
              {isCurrentUser && (
                <View className="ml-1 bg-cyan-500/20 rounded-full px-1.5 py-0.5">
                  <Text className="text-cyan-400 text-[9px] font-semibold">You</Text>
                </View>
              )}
              {player.roles?.includes('captain') && (
                <View className="ml-1 bg-amber-500/20 rounded-full w-4 h-4 items-center justify-center">
                  <Text className="text-amber-500 text-[10px] font-black">C</Text>
                </View>
              )}
              {player.roles?.includes('admin') && (
                <View className="ml-1 bg-purple-500/20 rounded-full w-4 h-4 items-center justify-center">
                  <Shield size={10} color="#a78bfa" strokeWidth={2.5} />
                </View>
              )}
            </View>
            <View className="flex-row items-center">
              <Text className="text-slate-400 text-xs">{positionDisplay}</Text>
              {/* Injured indicator with end date */}
              {player.isInjured && (
                <View className="flex-row items-center ml-1.5">
                  <Text className="text-red-400 font-black text-xs">+</Text>
                  {player.statusEndDate && player.statusEndDate.length >= 10 ? (
                    <Text className="text-red-400/80 text-[10px] ml-0.5">
                      (until {format(parseISO(player.statusEndDate), 'MMM d')})
                    </Text>
                  ) : player.injuryDuration ? (
                    <Text className="text-red-400/80 text-[10px] ml-0.5">
                      ({formatStatusDuration(player.injuryDuration)})
                    </Text>
                  ) : null}
                </View>
              )}
              {/* Suspended indicator with end date */}
              {player.isSuspended && (
                <View className="flex-row items-center ml-1.5">
                  <Text className="text-red-400 font-bold text-[10px]">SUS</Text>
                  {player.statusEndDate && player.statusEndDate.length >= 10 ? (
                    <Text className="text-red-400/80 text-[10px] ml-0.5">
                      (until {format(parseISO(player.statusEndDate), 'MMM d')})
                    </Text>
                  ) : player.suspensionDuration ? (
                    <Text className="text-red-400/80 text-[10px] ml-0.5">
                      ({formatStatusDuration(player.suspensionDuration)})
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
            {/* Show hint for self-stats editing */}
            {isCurrentUser && canEditOwnStats && effectiveShowStats && (
              <Text className="text-cyan-400/70 text-[10px] mt-0.5">Tap to edit your stats</Text>
            )}
            {/* Associated player for parents */}
            {associatedPlayerName && (
              <Text className="text-pink-400/80 text-[10px] mt-0.5">Child: {associatedPlayerName}</Text>
            )}
          </View>

          {/* Status Badge */}
          <View className={cn(
            'px-2 py-0.5 rounded-full',
            player.status === 'active' ? 'bg-green-500/15' : 'bg-slate-600/50'
          )}>
            <Text className={cn(
              'text-[10px] font-semibold',
              player.status === 'active' ? 'text-green-400' : 'text-slate-400'
            )}>
              {player.status === 'active' ? 'Active' : 'Reserve'}
            </Text>
          </View>
        </View>

        {/* Player Stats */}
        {effectiveShowStats && (
          <View className="mt-2 pt-2 border-t border-slate-700/40">
            {/* Label for skater/player stats when showing both */}
            {showBothGoalieStats && (
              <Text className="text-cyan-400 text-[10px] font-medium mb-1">{sport === 'hockey' ? 'Skater' : 'Player'}</Text>
            )}
            {/* Label for batting stats when showing both */}
            {showBothBaseballStats && (
              <Text className="text-cyan-400 text-[10px] font-medium mb-1">Batting</Text>
            )}
            <View className="flex-row justify-between">
              {headers.map((header, i) => (
                <View key={header} className="items-center flex-1">
                  <Text className="text-slate-500 text-[10px] mb-0.5">{header}</Text>
                  <Text className="text-white text-xs font-medium">{statValues[i]}</Text>
                </View>
              ))}
            </View>

            {/* Goalie stats row for goalie/skater players */}
            {showBothGoalieStats && (
              <View className="mt-2 pt-2 border-t border-slate-700/30">
                <Text className="text-cyan-400 text-[10px] font-medium mb-1">Goalie</Text>
                <View className="flex-row justify-between">
                  {goalieHeaders.map((header, i) => (
                    <View key={`goalie-${header}`} className="items-center flex-1">
                      <Text className="text-slate-500 text-[10px] mb-0.5">{header}</Text>
                      <Text className="text-white text-xs font-medium">{goalieStatValues[i]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Pitching stats row for pitcher/position players */}
            {showBothBaseballStats && (
              <View className="mt-2 pt-2 border-t border-slate-700/30">
                <Text className="text-cyan-400 text-[10px] font-medium mb-1">Pitching</Text>
                <View className="flex-row justify-between">
                  {pitchingHeaders.map((header, i) => (
                    <View key={`pitching-${header}`} className="items-center flex-1">
                      <Text className="text-slate-500 text-[10px] mb-0.5">{header}</Text>
                      <Text className="text-white text-xs font-medium">{pitchingStatValues[i]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function RosterScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const canManageTeam = useTeamStore((s) => s.canManageTeam);
  const canEditPlayers = useTeamStore((s) => s.canEditPlayers);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const userEmail = useTeamStore((s) => s.userEmail);
  const showTeamStats = teamSettings.showTeamStats !== false;
  const allowPlayerSelfStats = teamSettings.allowPlayerSelfStats === true;

  // Responsive layout for iPad
  const { isTablet, columns, containerPadding } = useResponsive();

  // Count how many admins exist
  const adminCount = players.filter((p) => p.roles?.includes('admin')).length;

  const positions = SPORT_POSITIONS[teamSettings.sport];

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [playerRoles, setPlayerRoles] = useState<PlayerRole[]>([]);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('active');
  const [memberRole, setMemberRole] = useState<'player' | 'reserve' | 'coach' | 'parent'>('player');
  const [isInjured, setIsInjured] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [injuryDuration, setInjuryDuration] = useState<StatusDuration | undefined>(undefined);
  const [suspensionDuration, setSuspensionDuration] = useState<StatusDuration | undefined>(undefined);
  const [statusEndDate, setStatusEndDate] = useState<string>(''); // YYYY-MM-DD format
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [associatedPlayerId, setAssociatedPlayerId] = useState<string>('');
  const [showAssociatedPlayerPicker, setShowAssociatedPlayerPicker] = useState(false);

  // Invite modal state
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [newlyCreatedPlayer, setNewlyCreatedPlayer] = useState<Player | null>(null);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setNumber('');
    setSelectedPositions([]);
    setPhone('');
    setEmail('');
    setPlayerRoles([]);
    setPlayerStatus('active');
    setMemberRole('player');
    setIsInjured(false);
    setIsSuspended(false);
    setInjuryDuration(undefined);
    setSuspensionDuration(undefined);
    setStatusEndDate('');
    setAssociatedPlayerId('');
    setEditingPlayer(null);
  };

  const openAddModal = () => {
    if (!canEditPlayers()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    resetForm();
    setIsModalVisible(true);
  };

  const openEditModal = (player: Player) => {
    if (!canEditPlayers()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setEditingPlayer(player);
    setFirstName(player.firstName);
    setLastName(player.lastName);
    setNumber(player.number);
    // Filter out 'Coach' from positions - keep empty if coach
    const playerPositions = getPlayerPositions(player).filter(p => p && p !== 'Coach');
    setSelectedPositions(playerPositions);
    setPhone(formatPhoneNumber(player.phone));
    setEmail(player.email || '');
    setPlayerRoles(player.roles || []);
    setPlayerStatus(player.status || 'active');
    setIsInjured(player.isInjured || false);
    setIsSuspended(player.isSuspended || false);
    setInjuryDuration(player.injuryDuration);
    setSuspensionDuration(player.suspensionDuration);
    setStatusEndDate(player.statusEndDate || '');
    setAssociatedPlayerId(player.associatedPlayerId || '');
    // Determine member role from player data
    if (player.roles?.includes('coach') || player.position === 'Coach') {
      setMemberRole('coach');
    } else if (player.roles?.includes('parent')) {
      setMemberRole('parent');
    } else if (player.status === 'reserve') {
      setMemberRole('reserve');
    } else {
      setMemberRole('player');
    }
    setIsModalVisible(true);
  };

  // Handle player card press - either edit player or go to stats
  const handlePlayerPress = (player: Player) => {
    const isOwnProfile = player.id === currentPlayerId;
    const canEdit = canEditPlayers();

    // If admin/coach, open edit modal
    if (canEdit) {
      openEditModal(player);
      return;
    }

    // If it's their own profile and self-stats is enabled, go to team stats
    if (isOwnProfile && allowPlayerSelfStats && showTeamStats) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/team-stats');
      return;
    }

    // Otherwise, no action (or could show a read-only profile in the future)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    const isCoachRole = memberRole === 'coach';
    const isParentRole = memberRole === 'parent';

    // Only require jersey number if not a coach or parent
    if (!firstName.trim() || !lastName.trim() || (!isCoachRole && !isParentRole && !number.trim())) return;

    // Require at least one position if not a coach or parent
    if (!isCoachRole && !isParentRole && selectedPositions.length === 0) {
      Alert.alert('Missing Info', 'Please select at least one position.');
      return;
    }

    // Require phone and email for players (not coaches or parents)
    const rawPhoneCheck = unformatPhone(phone);
    const rawEmailCheck = email.trim();
    if (!isCoachRole && !isParentRole) {
      if (!rawPhoneCheck) {
        Alert.alert('Phone Required', 'Please enter a phone number so the player can log in.');
        return;
      }
      if (!rawEmailCheck) {
        Alert.alert('Email Required', 'Please enter an email address so the player can log in.');
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Store raw phone digits and email before any state changes
    const rawPhone = rawPhoneCheck;
    const rawEmail = rawEmailCheck;

    // Build roles array based on memberRole
    const roles: PlayerRole[] = playerRoles.filter(r => r !== 'coach' && r !== 'parent');
    if (isCoachRole) {
      roles.push('coach');
    }
    if (isParentRole) {
      roles.push('parent');
    }

    // Determine status based on memberRole
    const effectiveStatus: PlayerStatus = memberRole === 'reserve' ? 'reserve' : 'active';

    if (editingPlayer) {
      const updates: Partial<Player> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: (isCoachRole || isParentRole) ? '' : number.trim(),
        position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : (selectedPositions[0] || '')),
        positions: isCoachRole ? ['Coach'] : (isParentRole ? ['Parent'] : [...selectedPositions]),
        phone: rawPhone || undefined,
        email: rawEmail || undefined,
        associatedPlayerId: isParentRole ? (associatedPlayerId || undefined) : undefined,
      };

      // Only admins can change roles and status
      if (isAdmin()) {
        updates.roles = roles;
        updates.status = effectiveStatus;
        updates.isInjured = isInjured;
        updates.isSuspended = isSuspended;
        updates.injuryDuration = isInjured ? injuryDuration : undefined;
        updates.suspensionDuration = isSuspended ? suspensionDuration : undefined;
        // Only save end date if injured or suspended
        updates.statusEndDate = (isInjured || isSuspended) ? (statusEndDate || undefined) : undefined;
      }

      updatePlayer(editingPlayer.id, updates);
      // Sync to Supabase so changes appear on all devices
      if (activeTeamId) {
        const updated = { ...useTeamStore.getState().players.find(p => p.id === editingPlayer.id), ...updates };
        pushPlayerToSupabase(updated as Player, activeTeamId).catch(console.error);
      }
      setIsModalVisible(false);
      resetForm();
    } else {
      const newPlayer: Player = {
        id: Date.now().toString(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: (isCoachRole || isParentRole) ? '' : number.trim(),
        position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : selectedPositions[0]),
        positions: isCoachRole ? ['Coach'] : (isParentRole ? ['Parent'] : selectedPositions),
        phone: rawPhone || undefined,
        email: rawEmail || undefined,
        roles: isAdmin() ? roles : [],
        status: isAdmin() ? effectiveStatus : 'active',
        isInjured: isAdmin() ? isInjured : false,
        isSuspended: isAdmin() ? isSuspended : false,
        statusEndDate: isAdmin() && (isInjured || isSuspended) ? (statusEndDate || undefined) : undefined,
        associatedPlayerId: isParentRole ? (associatedPlayerId || undefined) : undefined,
      };
      addPlayer(newPlayer);

      // Persist new player to Supabase immediately
      if (activeTeamId) {
        pushPlayerToSupabase(newPlayer, activeTeamId).catch(console.error);
      }

      // Also create a Supabase invitation for cross-device joining
      if (rawPhone || rawEmail) {
        // Generate a consistent team ID
        const teamId = activeTeamId || `team-${Date.now()}`;

        // Use a small timeout to ensure state is updated with new player
        setTimeout(async () => {
          // Get the current team data to include in the invitation
          const state = useTeamStore.getState();

          // Try to get team from multi-team structure first
          let currentTeam = state.teams.find(t => t.id === activeTeamId);

          // If no team found in teams array, construct team from root state (legacy mode)
          if (!currentTeam && state.teamName) {
            console.log('ROSTER: Using legacy single-team mode');
            currentTeam = {
              id: teamId,
              teamName: state.teamName,
              teamSettings: state.teamSettings,
              players: state.players,
              games: state.games,
              events: state.events,
              photos: state.photos || [],
              notifications: state.notifications || [],
              chatMessages: state.chatMessages || [],
              chatLastReadAt: state.chatLastReadAt || {},
              paymentPeriods: state.paymentPeriods || [],
              polls: state.polls || [],
              teamLinks: state.teamLinks || [],
            };
          }

          // Create the invitation with the team data embedded
          console.log('ROSTER: Creating invitation for team ID:', teamId, 'with team data:', !!currentTeam);
          try {
            const result = await createTeamInvitation({
              team_id: teamId,
              team_name: teamName,
              email: rawEmail || undefined,
              phone: rawPhone || undefined,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              jersey_number: number.trim() || undefined,
              position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : selectedPositions[0]),
              roles: isAdmin() ? roles : [],
              invited_by_email: userEmail || undefined,
              team_data: currentTeam, // Include full team data
            });
            console.log('ROSTER: Supabase invitation created:', result);
          } catch (err) {
            console.error('ROSTER: Failed to create Supabase invitation:', err);
          }
        }, 100);
      }

      setIsModalVisible(false);
      resetForm();

      // Show invite modal if player has phone or email
      console.log('Player created - rawPhone:', rawPhone, 'rawEmail:', rawEmail);
      if (rawPhone || rawEmail) {
        setNewlyCreatedPlayer({ ...newPlayer, phone: rawPhone || undefined, email: rawEmail || undefined });
        setIsInviteModalVisible(true);
      }
    }
  };

  // Placeholder for App Store URL - will be updated once app is published
  const APP_STORE_URL = 'https://apps.apple.com/app/your-app-id';

  const getInviteMessage = (method: 'sms' | 'email') => {
    const playerName = newlyCreatedPlayer ? getPlayerName(newlyCreatedPlayer) : '';
    const contactInfo = method === 'sms'
      ? newlyCreatedPlayer?.phone
        ? `\n\nLog in with your phone number: ${formatPhoneNumber(newlyCreatedPlayer.phone)}`
        : ''
      : newlyCreatedPlayer?.email
        ? `\n\nLog in with your email: ${newlyCreatedPlayer.email}`
        : '';

    return `Hey ${playerName}!\n\nYou've been added to ${teamName}! Download the app and log in using your info to view the schedule, check in for games, and stay connected with the team.\n\nDownload here: ${APP_STORE_URL}${contactInfo}\n\nYour jersey number is #${newlyCreatedPlayer?.number}\n\nSee you at the next game!`;
  };

  const handleSendTextInvite = () => {
    if (!newlyCreatedPlayer?.phone) {
      Alert.alert('No Phone Number', 'This player does not have a phone number.');
      return;
    }

    const message = encodeURIComponent(getInviteMessage('sms'));
    const phoneNumber = newlyCreatedPlayer.phone;

    const smsUrl = Platform.select({
      ios: `sms:${phoneNumber}&body=${message}`,
      android: `sms:${phoneNumber}?body=${message}`,
      default: `sms:${phoneNumber}?body=${message}`,
    });

    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('Error', 'Could not open messaging app');
    });

    setIsInviteModalVisible(false);
    setNewlyCreatedPlayer(null);
  };

  const handleSendEmailInvite = async () => {
    if (!newlyCreatedPlayer?.email) {
      Alert.alert('No Email', 'This player does not have an email address.');
      return;
    }

    try {
      // Call Supabase Edge Function to send invitation email
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-invitation-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            to: newlyCreatedPlayer.email,
            teamName: teamName,
            firstName: newlyCreatedPlayer.firstName,
            userEmail: newlyCreatedPlayer.email,
            jerseyNumber: newlyCreatedPlayer.number || '00',
            appLink: 'https://apps.apple.com/app/id6740043565',
          }),
        }
      );

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Email Sent', `Invite email sent to ${getPlayerName(newlyCreatedPlayer)}!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send email');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send email. Please try again later.');
      console.error('Email invite send error:', error);
    }

    setIsInviteModalVisible(false);
    setNewlyCreatedPlayer(null);
  };

  const handleSkipInvite = () => {
    setIsInviteModalVisible(false);
    setNewlyCreatedPlayer(null);
  };

  // Group players by position type based on sport
  const getPositionGroups = () => {
    const sport = teamSettings.sport;

    // Players whose position doesn't match the current sport get shown in a catch-all group
    const allMatchedIds = new Set<string>();

    let groups: { title: string; players: Player[] }[] = [];

    if (sport === 'hockey') {
      groups = [
        { title: 'Forwards', players: players.filter((p) => ['C', 'LW', 'RW'].includes(p.position)) },
        { title: 'Defense', players: players.filter((p) => ['LD', 'RD'].includes(p.position)) },
        { title: 'Goalies', players: players.filter((p) => p.position === 'G') },
      ];
    } else if (sport === 'baseball' || sport === 'softball') {
      groups = [
        { title: 'Battery', players: players.filter((p) => ['P', 'C'].includes(p.position)) },
        { title: 'Infield', players: players.filter((p) => ['1B', '2B', '3B', 'SS'].includes(p.position)) },
        { title: 'Outfield', players: players.filter((p) => ['LF', 'RF', 'CF'].includes(p.position)) },
      ];
    } else if (sport === 'basketball') {
      groups = [
        { title: 'Guards', players: players.filter((p) => ['PG', 'SG'].includes(p.position)) },
        { title: 'Forwards', players: players.filter((p) => ['SF', 'PF'].includes(p.position)) },
        { title: 'Centers', players: players.filter((p) => p.position === 'C') },
      ];
    } else if (sport === 'lacrosse') {
      groups = [
        { title: 'Attack', players: players.filter((p) => p.position === 'A') },
        { title: 'Midfield', players: players.filter((p) => p.position === 'M') },
        { title: 'Defense', players: players.filter((p) => p.position === 'D') },
        { title: 'Goalies', players: players.filter((p) => p.position === 'G') },
      ];
    } else if (sport === 'soccer') {
      groups = [
        { title: 'Goalkeepers', players: players.filter((p) => p.position === 'GK') },
        { title: 'Defenders', players: players.filter((p) => p.position === 'DEF') },
        { title: 'Midfielders', players: players.filter((p) => p.position === 'MID') },
        { title: 'Forwards', players: players.filter((p) => p.position === 'FWD') },
      ];
    } else {
      return [{ title: 'Players', players: players }];
    }

    // Collect all player IDs that were matched into a group
    for (const group of groups) {
      for (const p of group.players) allMatchedIds.add(p.id);
    }

    // Also exclude coaches and parents from the unmatched group
    const unmatched = players.filter(
      (p) => !allMatchedIds.has(p.id) && p.position !== 'Coach' && p.position !== 'Parent'
    );
    if (unmatched.length > 0) {
      groups.push({ title: 'Players', players: unmatched });
    }

    // Coaches and parents always shown at the bottom
    const coaches = players.filter((p) => p.position === 'Coach' || p.roles?.includes('coach'));
    const parents = players.filter((p) => p.position === 'Parent' || p.roles?.includes('parent'));

    const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
    const coachRoleEnabled = enabledRoles.includes('coach');
    const parentRoleEnabled = enabledRoles.includes('parent');

    if (coachRoleEnabled && coaches.length > 0) groups.push({ title: 'Coaches', players: coaches });
    if (parentRoleEnabled && parents.length > 0) groups.push({ title: 'Parents/Guardians', players: parents });

    return groups;
  };

  const positionGroups = getPositionGroups();

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
          <View className="flex-row items-center">
            <Users size={20} color="#67e8f9" />
            <Text className="text-cyan-400 text-sm font-medium ml-2">Roster</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{teamName} Roster</Text>
            {canEditPlayers() && (
              <Pressable
                onPress={openAddModal}
              >
                <UserPlus size={24} color="#22c55e" />
              </Pressable>
            )}
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
          {positionGroups.map((group) => {
            if (group.players.length === 0) return null;

            return (
              <View key={group.title} className="mb-3">
                <View className="flex-row items-center mb-1.5">
                  <Text className="text-cyan-300 font-bold text-base">
                    {group.title} ({group.players.length})
                  </Text>
                </View>
                {/* Use grid layout on iPad */}
                <View className={isTablet && columns >= 2 ? 'flex-row flex-wrap' : ''} style={isTablet && columns >= 2 ? { marginHorizontal: -6 } : undefined}>
                  {group.players.map((player, index) => (
                    <View
                      key={player.id}
                      style={isTablet && columns >= 2 ? {
                        width: columns >= 3 ? '33.33%' : '50%',
                        paddingHorizontal: 6
                      } : undefined}
                    >
                      <PlayerCard
                        player={player}
                        index={index}
                        onPress={() => handlePlayerPress(player)}
                        showStats={showTeamStats}
                        isCurrentUser={player.id === currentPlayerId}
                        canEditOwnStats={allowPlayerSelfStats && !canEditPlayers()}
                        associatedPlayerName={
                          player.associatedPlayerId
                            ? (() => {
                                const linked = players.find((p) => p.id === player.associatedPlayerId);
                                return linked ? getPlayerName(linked) : undefined;
                              })()
                            : undefined
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Add/Edit Player Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">
                {editingPlayer ? 'Edit Player' : 'Add Player'}
              </Text>
              <Pressable onPress={handleSave}>
                <Text className="text-cyan-400 font-bold text-base">Save</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
              {/* First Name and Last Name Row */}
              <View className="flex-row mb-3">
                {/* First Name Input */}
                <View className="flex-1 mr-2">
                  <Text className="text-slate-400 text-sm mb-1">First Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>

                {/* Last Name Input */}
                <View className="flex-1 ml-2">
                  <Text className="text-slate-400 text-sm mb-1">Last Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>
              </View>

              {/* Jersey Number Row - hidden for coaches and parents */}
              {memberRole !== 'coach' && memberRole !== 'parent' && (
              <View className="mb-3">
                <Text className="text-slate-400 text-sm mb-1">Jersey Number<Text className="text-red-400">*</Text></Text>
                <TextInput
                  value={number}
                  onChangeText={setNumber}
                  placeholder="00"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={2}
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  style={{ width: 100 }}
                />
              </View>
              )}

              {/* Phone Input - Admin Only */}
              {isAdmin() && (
                <View className="mb-3">
                  <View className="flex-row items-center mb-1">
                    <Phone size={14} color="#a78bfa" />
                    <Text className="text-slate-400 text-sm ml-2">Phone{memberRole !== 'coach' && memberRole !== 'parent' && <Text className="text-red-400">*</Text>}</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(text) => setPhone(formatPhoneInput(text))}
                    placeholder="(555)123-4567"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>
              )}

              {/* Email Input - Admin Only */}
              {isAdmin() && (
                <View className="mb-3">
                  <View className="flex-row items-center mb-1">
                    <Mail size={14} color="#a78bfa" />
                    <Text className="text-slate-400 text-sm ml-2">Email{memberRole !== 'coach' && memberRole !== 'parent' && <Text className="text-red-400">*</Text>}</Text>
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="player@example.com"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>
              )}

              {/* Position Selector - Multiple Selection - Hidden for coaches and parents */}
              {memberRole !== 'coach' && memberRole !== 'parent' && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-0.5">Positions<Text className="text-red-400">*</Text></Text>
                  <Text className="text-slate-500 text-xs mb-1.5">Tap to select multiple positions</Text>
                  {/* Split positions into rows for better layout */}
                  {(() => {
                    const posCount = positions.length;
                    // For 10+ positions, split into two rows
                    const splitAt = posCount <= 6 ? posCount : Math.ceil(posCount / 2);
                    const row1 = positions.slice(0, splitAt);
                    const row2 = positions.slice(splitAt);

                    const renderRow = (rowPositions: string[], isLastRow: boolean) => (
                      <View className={cn("flex-row", !isLastRow && "mb-2")} style={{ gap: 6 }}>
                        {rowPositions.map((pos) => {
                          const isSelected = selectedPositions.includes(pos);
                          return (
                            <Pressable
                              key={pos}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (isSelected) {
                                  setSelectedPositions(selectedPositions.filter(p => p !== pos));
                                } else {
                                  setSelectedPositions([...selectedPositions, pos]);
                                }
                              }}
                              className={cn(
                                'flex-1 py-3 rounded-xl items-center border',
                                isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-slate-800 border-slate-700'
                              )}
                            >
                              <Text
                                className={cn(
                                  'font-semibold',
                                  isSelected ? 'text-white' : 'text-slate-400'
                                )}
                              >
                                {pos}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    );

                    return (
                      <>
                        {renderRow(row1, row2.length === 0)}
                        {row2.length > 0 && renderRow(row2, true)}
                      </>
                    );
                  })()}
                  {selectedPositions.length === 0 && (
                    <Text className="text-red-400 text-xs mt-1">Please select at least one position</Text>
                  )}
                </View>
              )}

              {/* Player Status - Admin Only */}
              {isAdmin() && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-1.5">Player Status</Text>
                  <View className="flex-row mb-2">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPlayerStatus('active');
                        setMemberRole('player');
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                        playerStatus === 'active' && memberRole !== 'reserve' ? 'bg-green-500' : 'bg-slate-800'
                      )}
                    >
                      {playerStatus === 'active' && memberRole !== 'reserve' && <Check size={16} color="white" />}
                      <Text
                        className={cn(
                          'font-semibold ml-1',
                          playerStatus === 'active' && memberRole !== 'reserve' ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Active
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPlayerStatus('reserve');
                        setMemberRole('reserve');
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                        memberRole === 'reserve' ? 'bg-slate-600' : 'bg-slate-800'
                      )}
                    >
                      {memberRole === 'reserve' && <Check size={16} color="white" />}
                      <Text
                        className={cn(
                          'font-semibold ml-1',
                          memberRole === 'reserve' ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Reserve
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setIsInjured(!isInjured);
                        if (isInjured) {
                          setInjuryDuration(undefined);
                        }
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                        isInjured ? 'bg-red-500' : 'bg-slate-800'
                      )}
                    >
                      <Text className={cn(
                        'text-lg font-black mr-1',
                        isInjured ? 'text-white' : 'text-red-500'
                      )}>+</Text>
                      <Text
                        className={cn(
                          'font-semibold',
                          isInjured ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Injured
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setIsSuspended(!isSuspended);
                        if (isSuspended) {
                          setSuspensionDuration(undefined);
                        }
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                        isSuspended ? 'bg-red-600' : 'bg-slate-800'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-bold mr-1',
                          isSuspended ? 'text-white' : 'text-red-500'
                        )}
                        style={{ fontSize: 12 }}
                      >
                        SUS
                      </Text>
                      <Text
                        className={cn(
                          'font-semibold',
                          isSuspended ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Suspended
                      </Text>
                    </Pressable>
                  </View>

                  {/* End Date Picker - shown when injured or suspended */}
                  {(isInjured || isSuspended) && (
                    <View className="mt-3 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                      <Text className="text-amber-400 text-sm font-medium mb-2">
                        End Date (Auto-mark OUT for games)
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowEndDatePicker(true);
                        }}
                        className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3"
                      >
                        <Calendar size={18} color="#f59e0b" />
                        <Text className="text-white ml-3 flex-1">
                          {statusEndDate && statusEndDate.length >= 10
                            ? format(parseISO(statusEndDate), 'MMM d, yyyy')
                            : 'Select end date'}
                        </Text>
                        {statusEndDate && (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setStatusEndDate('');
                            }}
                            hitSlop={8}
                          >
                            <X size={16} color="#94a3b8" />
                          </Pressable>
                        )}
                      </Pressable>
                      <Text className="text-slate-500 text-xs mt-2">
                        Games on or before this date will have this player auto-marked as OUT
                      </Text>
                      {showEndDatePicker && (
                        <View className="mt-3">
                          <DateTimePicker
                            value={statusEndDate && statusEndDate.length >= 10 ? parseISO(statusEndDate) : new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowEndDatePicker(false);
                              }
                              if (selectedDate) {
                                setStatusEndDate(format(selectedDate, 'yyyy-MM-dd'));
                              }
                            }}
                            minimumDate={new Date()}
                            themeVariant="dark"
                          />
                          {Platform.OS === 'ios' && (
                            <Pressable
                              onPress={() => setShowEndDatePicker(false)}
                              className="mt-2 bg-cyan-500 rounded-xl py-2"
                            >
                              <Text className="text-white text-center font-semibold">Done</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Roles - Admin Only */}
              {isAdmin() && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-1.5">Roles</Text>
                  {(() => {
                    const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                    const showCoach = enabledRoles.includes('coach');
                    const showParent = enabledRoles.includes('parent');

                    return (
                      <View className="flex-row flex-wrap">
                        {/* Captain */}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (playerRoles.includes('captain')) {
                              setPlayerRoles(playerRoles.filter((r) => r !== 'captain'));
                            } else {
                              setPlayerRoles([...playerRoles, 'captain']);
                            }
                          }}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                            playerRoles.includes('captain') ? 'bg-amber-500' : 'bg-slate-800'
                          )}
                        >
                          <View className="w-5 h-5 rounded-full bg-amber-500/30 items-center justify-center mb-1">
                            <Text className={cn(
                              'text-xs font-black',
                              playerRoles.includes('captain') ? 'text-white' : 'text-amber-500'
                            )}>C</Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                            className={cn(
                              'font-semibold text-xs',
                              playerRoles.includes('captain') ? 'text-white' : 'text-slate-400'
                            )}
                          >
                            Captain
                          </Text>
                        </Pressable>
                        {/* Admin */}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (playerRoles.includes('admin')) {
                              setPlayerRoles(playerRoles.filter((r) => r !== 'admin'));
                            } else {
                              setPlayerRoles([...playerRoles, 'admin']);
                            }
                          }}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                            playerRoles.includes('admin') ? 'bg-purple-500' : 'bg-slate-800'
                          )}
                        >
                          <Shield size={16} color={playerRoles.includes('admin') ? 'white' : '#a78bfa'} />
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                            className={cn(
                              'font-semibold text-xs mt-1',
                              playerRoles.includes('admin') ? 'text-white' : 'text-slate-400'
                            )}
                          >
                            Admin
                          </Text>
                        </Pressable>
                        {/* Coach */}
                        {showCoach && (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              if (memberRole === 'coach') {
                                setMemberRole('player');
                              } else {
                                setMemberRole('coach');
                              }
                            }}
                            className={cn(
                              'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                              showParent && 'mr-2',
                              memberRole === 'coach' ? 'bg-cyan-500' : 'bg-slate-800'
                            )}
                          >
                            <UserCog size={16} color={memberRole === 'coach' ? 'white' : '#67e8f9'} />
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}
                              className={cn(
                                'font-semibold text-xs mt-1',
                                memberRole === 'coach' ? 'text-white' : 'text-slate-400'
                              )}
                            >
                              Coach
                            </Text>
                          </Pressable>
                        )}
                        {/* Parent */}
                        {showParent && (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              if (memberRole === 'parent') {
                                setMemberRole('player');
                              } else {
                                setMemberRole('parent');
                              }
                            }}
                            className={cn(
                              'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                              memberRole === 'parent' ? 'bg-pink-500' : 'bg-slate-800'
                            )}
                          >
                            <ParentChildIcon size={16} color={memberRole === 'parent' ? 'white' : '#ec4899'} />
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}
                              className={cn(
                                'font-semibold text-xs mt-1',
                                memberRole === 'parent' ? 'text-white' : 'text-slate-400'
                              )}
                            >
                              Parent/Guardian
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })()}
                  <Text className="text-slate-500 text-xs mt-2">
                    {memberRole === 'coach' || memberRole === 'parent'
                      ? `${memberRole === 'coach' ? 'Coaches' : 'Parents/Guardians'} don't need jersey numbers or positions`
                      : 'Tap to toggle roles. Members can have multiple roles.'}
                  </Text>
                </View>
              )}

              {/* Associated Player dropdown - for parents only */}
              {memberRole === 'parent' && isAdmin() && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-1">Associated Player</Text>
                  <Text className="text-slate-500 text-xs mb-2">Child must be added first</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowAssociatedPlayerPicker(!showAssociatedPlayerPicker);
                    }}
                    className="bg-slate-800 rounded-xl px-4 py-3 border border-slate-700 flex-row items-center justify-between"
                  >
                    <Text className={associatedPlayerId ? 'text-white' : 'text-slate-500'}>
                      {associatedPlayerId
                        ? (() => {
                            const p = players.find((pl) => pl.id === associatedPlayerId && pl.position !== 'Coach' && pl.position !== 'Parent' && !pl.roles?.includes('coach') && !pl.roles?.includes('parent'));
                            return p ? getPlayerName(p) : 'Unknown Player';
                          })()
                        : 'Select associated player (optional)'}
                    </Text>
                    <ChevronDown size={16} color="#64748b" />
                  </Pressable>
                  {showAssociatedPlayerPicker && (
                    <View className="mt-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                      <Pressable
                        onPress={() => {
                          setAssociatedPlayerId('');
                          setShowAssociatedPlayerPicker(false);
                        }}
                        className="px-4 py-3 border-b border-slate-700/50"
                      >
                        <Text className="text-slate-400 text-sm">None</Text>
                      </Pressable>
                      {players
                        .filter((p) =>
                          p.position !== 'Coach' &&
                          p.position !== 'Parent' &&
                          !p.roles?.includes('coach') &&
                          !p.roles?.includes('parent') &&
                          p.id !== editingPlayer?.id
                        )
                        .map((p) => (
                          <Pressable
                            key={p.id}
                            onPress={() => {
                              setAssociatedPlayerId(p.id);
                              setShowAssociatedPlayerPicker(false);
                            }}
                            className={cn(
                              'px-4 py-3 border-b border-slate-700/30',
                              associatedPlayerId === p.id && 'bg-pink-500/20'
                            )}
                          >
                            <Text className={cn('text-sm', associatedPlayerId === p.id ? 'text-pink-400 font-semibold' : 'text-white')}>
                              {getPlayerName(p)} {p.number ? `#${p.number}` : ''}
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>
              )}

              {/* Admin Note for Stats */}
              {editingPlayer && isAdmin() && showTeamStats && (
                <View className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mt-5 mb-5">
                  <Text className="text-purple-400 text-sm">
                    To update player stats, go to Team Stats in the Admin panel.
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Send Invite Modal */}
      <Modal
        visible={isInviteModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleSkipInvite}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center mb-4">
                <Send size={32} color="#22c55e" />
              </View>
              <Text className="text-white text-xl font-bold text-center">
                Player Added!
              </Text>
              <Text className="text-slate-400 text-center mt-2">
                Send {newlyCreatedPlayer ? getPlayerName(newlyCreatedPlayer) : ''} an invite to register and join the team?
              </Text>
            </View>

            {/* Invite Options */}
            <View className="space-y-3">
              {newlyCreatedPlayer?.phone && (
                <Pressable
                  onPress={handleSendTextInvite}
                  className="flex-row items-center justify-center bg-cyan-500 rounded-xl py-4 mb-3 active:bg-cyan-600"
                >
                  <MessageSquare size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Send Text Message</Text>
                </Pressable>
              )}

              {newlyCreatedPlayer?.email && (
                <Pressable
                  onPress={handleSendEmailInvite}
                  className="flex-row items-center justify-center bg-purple-500 rounded-xl py-4 mb-3 active:bg-purple-600"
                >
                  <Mail size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Send Email</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleSkipInvite}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Skip for Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
