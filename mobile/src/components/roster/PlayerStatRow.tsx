import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import { Shield } from 'lucide-react-native';
import {
  useTeamStore,
  Player,
  SPORT_POSITION_NAMES,
  Sport,
  HockeyStats,
  HockeyGoalieStats,
  BaseballStats,
  BaseballPitcherStats,
  BasketballStats,
  SoccerStats,
  SoccerGoalieStats,
  LacrosseStats,
  LacrosseGoalieStats,
  PlayerStats,
  getPlayerPositions,
  getPrimaryPosition,
  getPlayerName,
  StatusDuration,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { PlayerAvatar } from '@/components/PlayerAvatar';

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

export interface PlayerStatRowProps {
  player: Player;
  index: number;
  onPress: () => void;
  showStats?: boolean;
  isCurrentUser?: boolean;
  canEditOwnStats?: boolean;
  associatedPlayerName?: string;
}

export function PlayerStatRow({ player, index, onPress, showStats = true, isCurrentUser = false, canEditOwnStats = false, associatedPlayerName }: PlayerStatRowProps) {
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
