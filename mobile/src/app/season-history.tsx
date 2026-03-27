import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Calendar, Trophy, ChevronDown, ChevronUp, Users, RotateCcw } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTeamStore, ArchivedSeason, ArchivedPlayerStats, SPORT_NAMES, getSportName, Sport, getPlayerPositions } from '@/lib/store';
import { format, parseISO } from 'date-fns';

// Get stat headers based on sport
const getStatHeaders = (sport: Sport): string[] => {
  switch (sport) {
    case 'hockey':
      return ['GP', 'G', 'A', 'P', 'PIM'];
    case 'soccer':
      return ['GP', 'G', 'A', 'YC'];
    case 'basketball':
      return ['GP', 'PTS', 'REB', 'AST'];
    case 'baseball':
    case 'softball':
      return ['GP', 'AB', 'H', 'HR', 'RBI'];
    case 'lacrosse':
      return ['GP', 'G', 'A', 'GB'];
    default:
      return ['GP'];
  }
};

// Get goalie stat headers based on sport
const getGoalieHeaders = (sport: Sport): string[] => {
  switch (sport) {
    case 'hockey':
    case 'soccer':
    case 'lacrosse':
      return ['GP', 'W', 'L', 'MP', 'GAA', 'SV%'];
    default:
      return [];
  }
};

// Get stat values from archived player stats
const getStatValues = (sport: Sport, player: ArchivedPlayerStats): string[] => {
  const stats = player.stats as Record<string, number> | undefined;
  if (!stats) return getStatHeaders(sport).map(() => '0');

  switch (sport) {
    case 'hockey': {
      const gp = stats.gamesPlayed ?? 0;
      const g = stats.goals ?? 0;
      const a = stats.assists ?? 0;
      const p = g + a;
      const pim = stats.pim ?? 0;
      return [gp.toString(), g.toString(), a.toString(), p.toString(), pim.toString()];
    }
    case 'soccer': {
      const gp = stats.gamesPlayed ?? 0;
      const g = stats.goals ?? 0;
      const a = stats.assists ?? 0;
      const yc = stats.yellowCards ?? 0;
      return [gp.toString(), g.toString(), a.toString(), yc.toString()];
    }
    case 'basketball': {
      const gp = stats.gamesPlayed ?? 0;
      const pts = stats.points ?? 0;
      const reb = stats.rebounds ?? 0;
      const ast = stats.assists ?? 0;
      return [gp.toString(), pts.toString(), reb.toString(), ast.toString()];
    }
    case 'baseball':
    case 'softball': {
      const gp = stats.gamesPlayed ?? 0;
      const ab = stats.atBats ?? 0;
      const h = stats.hits ?? 0;
      const hr = stats.homeRuns ?? 0;
      const rbi = stats.rbi ?? 0;
      return [gp.toString(), ab.toString(), h.toString(), hr.toString(), rbi.toString()];
    }
    case 'lacrosse': {
      const gp = stats.gamesPlayed ?? 0;
      const g = stats.goals ?? 0;
      const a = stats.assists ?? 0;
      const gb = stats.groundBalls ?? 0;
      return [gp.toString(), g.toString(), a.toString(), gb.toString()];
    }
    default:
      return ['0'];
  }
};

// Get goalie stat values
const getGoalieStatValues = (sport: Sport, player: ArchivedPlayerStats): string[] => {
  const gs = player.goalieStats as Record<string, number> | undefined;
  if (!gs) return getGoalieHeaders(sport).map(() => '0');

  const gp = gs.games ?? 0;
  const w = gs.wins ?? 0;
  const l = gs.losses ?? 0;
  const mp = gs.minutesPlayed ?? 0;
  const saves = gs.saves ?? 0;
  const ga = gs.goalsAgainst ?? 0;
  const svPct = saves + ga > 0 ? ((saves / (saves + ga)) * 100).toFixed(1) : '0.0';

  // Calculate GAA: (Goals Against / Minutes Played) * 60 for hockey/lacrosse, * 90 for soccer
  let gaa: string;
  if (sport === 'soccer') {
    gaa = mp > 0 ? ((ga / mp) * 90).toFixed(2) : '0.00';
  } else {
    gaa = mp > 0 ? ((ga * 60) / mp).toFixed(2) : '0.00';
  }

  return [gp.toString(), w.toString(), l.toString(), mp.toString(), gaa, svPct];
};

// Check if player is a goalie
const isGoalie = (player: ArchivedPlayerStats): boolean => {
  return !!player.goalieStats || player.position === 'G' || player.position === 'GK';
};

export default function SeasonHistoryScreen() {
  const router = useRouter();
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const currentPlayers = useTeamStore((s) => s.players);
  const unarchiveSeason = useTeamStore((s) => s.unarchiveSeason);
  const isAdminFn = useTeamStore((s) => s.isAdmin);
  const isAdmin = isAdminFn();
  const seasonHistory = teamSettings.seasonHistory || [];

  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);

  const toggleExpanded = (seasonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSeasonId(expandedSeasonId === seasonId ? null : seasonId);
  };

  const handleUnarchive = (season: ArchivedSeason) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Restore Season',
      `Are you sure you want to restore "${season.seasonName}"? This will:\n\n• Remove it from season history\n• Restore all player stats from that season\n• Restore the team record\n\nIf the current season has data, it will be discarded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: () => {
            const result = unarchiveSeason(season.id);
            if (result.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Season Restored', result.message);
            } else if (result.hasConflict) {
              // Show force restore option
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(
                'Current Season Has Data',
                'The current season has games or stats recorded. Restoring this archived season will discard all current season data.\n\nDo you want to proceed?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Discard & Restore',
                    style: 'destructive',
                    onPress: () => {
                      const forceResult = unarchiveSeason(season.id, true);
                      if (forceResult.success) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Season Restored', forceResult.message);
                      } else {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        Alert.alert('Cannot Restore', forceResult.message);
                      }
                    },
                  },
                ]
              );
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Cannot Restore', result.message);
            }
          },
        },
      ]
    );
  };

  const formatRecord = (season: ArchivedSeason): string => {
    const { wins, losses, ties, otLosses } = season.teamRecord;
    if (season.sport === 'hockey' && otLosses !== undefined) {
      return `${wins}-${losses}-${ties ?? 0}-${otLosses}`;
    }
    if (ties !== undefined && ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }
    return `${wins}-${losses}`;
  };

  // Get display positions for a player - check current roster for positions if not in archived data
  const getDisplayPositions = (player: ArchivedPlayerStats): string => {
    // First try archived positions array
    if (player.positions && player.positions.length > 0) {
      return player.positions.join('/');
    }

    // Look up current player to get their positions (for old archived data)
    const currentPlayer = currentPlayers.find(p => p.id === player.playerId);
    if (currentPlayer) {
      const positions = getPlayerPositions(currentPlayer);
      return positions.join('/');
    }

    // Fall back to single position
    return player.position;
  };

  // Sort seasons by archived date, most recent first
  const sortedSeasons = [...seasonHistory].sort((a, b) =>
    new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
  );

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="flex-row items-center px-5 pt-2 pb-3"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center mr-3"
          >
            <ArrowLeft size={20} color="#67e8f9" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-slate-400 text-sm font-medium">Stats and Analytics</Text>
            <Text className="text-white text-2xl font-bold">Season History</Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center">
            <Calendar size={20} color="#a78bfa" />
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {sortedSeasons.length === 0 ? (
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              className="bg-slate-800/60 rounded-xl p-6 items-center"
            >
              <Calendar size={40} color="#64748b" />
              <Text className="text-slate-400 text-center mt-3">
                No archived seasons yet.
              </Text>
              <Text className="text-slate-500 text-sm text-center mt-1">
                Use "End Season" in Admin to archive your first season.
              </Text>
            </Animated.View>
          ) : (
            sortedSeasons.map((season, index) => {
              const statHeaders = getStatHeaders(season.sport);
              const goalieHeaders = getGoalieHeaders(season.sport);
              const nonGoalies = season.playerStats.filter(p => !isGoalie(p));
              const goalies = season.playerStats.filter(p => isGoalie(p));

              return (
                <Animated.View
                  key={season.id}
                  entering={FadeInDown.delay(100 + index * 50).springify()}
                  className="mb-3"
                >
                  <Pressable
                    onPress={() => toggleExpanded(season.id)}
                    className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden"
                  >
                    {/* Season Header */}
                    <View className="flex-row items-center px-4 py-3">
                      <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center mr-3">
                        <Trophy size={20} color="#a78bfa" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-semibold text-base">{season.seasonName}</Text>
                        <Text className="text-slate-400 text-sm">
                          {formatRecord(season)} • {getSportName(season.sport)}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Text className="text-slate-500 text-xs mr-2">
                          {format(parseISO(season.archivedAt), 'MMM yyyy')}
                        </Text>
                        {expandedSeasonId === season.id ? (
                          <ChevronUp size={20} color="#64748b" />
                        ) : (
                          <ChevronDown size={20} color="#64748b" />
                        )}
                      </View>
                    </View>

                    {/* Expanded Content */}
                    {expandedSeasonId === season.id && (
                      <View className="border-t border-slate-700/50">
                        {/* Win/Loss/Ties/OTL Row - Colored numbers */}
                        <View className="flex-row justify-around py-4 px-4 border-b border-slate-700/50">
                          <View className="items-center">
                            <Text className="text-green-400 text-3xl font-bold">{season.teamRecord.wins}</Text>
                            <Text className="text-slate-400 text-xs">Wins</Text>
                          </View>
                          <View className="items-center">
                            <Text className="text-red-400 text-3xl font-bold">{season.teamRecord.losses}</Text>
                            <Text className="text-slate-400 text-xs">Losses</Text>
                          </View>
                          <View className="items-center">
                            <Text className="text-amber-400 text-3xl font-bold">{season.teamRecord.ties ?? 0}</Text>
                            <Text className="text-slate-400 text-xs">{season.sport === 'soccer' ? 'Draws' : 'Ties'}</Text>
                          </View>
                          {season.sport === 'hockey' && (
                            <View className="items-center">
                              <Text className="text-purple-400 text-3xl font-bold">{season.teamRecord.otLosses ?? 0}</Text>
                              <Text className="text-slate-400 text-xs">OTL</Text>
                            </View>
                          )}
                        </View>

                        {/* Win Percentage */}
                        <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-700/50">
                          <Text className="text-slate-400 text-sm">Win Percentage</Text>
                          <Text className="text-white text-xl font-bold">
                            {(() => {
                              const gp = season.sport === 'hockey'
                                ? season.teamRecord.wins + season.teamRecord.losses + (season.teamRecord.ties ?? 0) + (season.teamRecord.otLosses ?? 0)
                                : season.teamRecord.wins + season.teamRecord.losses + (season.teamRecord.ties ?? 0);
                              return gp > 0 ? (season.teamRecord.wins / gp).toFixed(3) : '.000';
                            })()}
                          </Text>
                        </View>

                        {/* Season Statistics */}
                        <View className="px-4 py-3 border-b border-slate-700/50">
                          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                            Season Statistics
                          </Text>
                          <View className="bg-slate-700/30 rounded-xl p-3">
                            <View className="flex-row items-center justify-around">
                              <View className="items-center">
                                <Text className="text-white text-2xl font-bold">
                                  {(() => {
                                    const gp = season.sport === 'hockey'
                                      ? season.teamRecord.wins + season.teamRecord.losses + (season.teamRecord.ties ?? 0) + (season.teamRecord.otLosses ?? 0)
                                      : season.teamRecord.wins + season.teamRecord.losses + (season.teamRecord.ties ?? 0);
                                    return gp;
                                  })()}
                                </Text>
                                <Text className="text-slate-500 text-xs">GP</Text>
                              </View>
                              {(season.sport === 'hockey' || season.sport === 'soccer' || season.sport === 'lacrosse') && (
                                <>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.goals ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">Goals</Text>
                                  </View>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.assists ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">Assists</Text>
                                  </View>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.goals ?? 0) + (stats?.assists ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">Points</Text>
                                  </View>
                                </>
                              )}
                              {(season.sport === 'baseball' || season.sport === 'softball') && (
                                <>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.hits ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">Hits</Text>
                                  </View>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.homeRuns ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">HRs</Text>
                                  </View>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.rbi ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">RBIs</Text>
                                  </View>
                                </>
                              )}
                              {season.sport === 'basketball' && (
                                <>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.points ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">Points</Text>
                                  </View>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.rebounds ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">Rebounds</Text>
                                  </View>
                                  <View className="items-center">
                                    <Text className="text-white text-2xl font-bold">
                                      {season.playerStats.reduce((sum, p) => {
                                        const stats = p.stats as Record<string, number> | undefined;
                                        return sum + (stats?.assists ?? 0);
                                      }, 0)}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">Assists</Text>
                                  </View>
                                </>
                              )}
                            </View>
                          </View>
                        </View>

                        {/* Roster Summary */}
                        <View className="flex-row px-4 py-3 border-b border-slate-700/50">
                          <View className="flex-1 bg-slate-700/30 rounded-xl p-3 mr-2 flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-3">
                              <Users size={18} color="#22c55e" />
                            </View>
                            <View>
                              <Text className="text-slate-400 text-xs">Active Players</Text>
                              <Text className="text-white text-2xl font-bold">{nonGoalies.length}</Text>
                              <Text className="text-slate-500 text-[10px]">On roster</Text>
                            </View>
                          </View>
                          <View className="flex-1 bg-slate-700/30 rounded-xl p-3 ml-2 flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center mr-3">
                              <Trophy size={18} color="#a78bfa" />
                            </View>
                            <View>
                              <Text className="text-slate-400 text-xs">Total Roster</Text>
                              <Text className="text-white text-2xl font-bold">{season.playerStats.length}</Text>
                              <Text className="text-slate-500 text-[10px]">Including reserves</Text>
                            </View>
                          </View>
                        </View>

                        {/* Team Records (Streaks, Goals) */}
                        {((season.teamRecord.longestWinStreak !== undefined && season.teamRecord.longestWinStreak > 0) ||
                          (season.teamRecord.longestLosingStreak !== undefined && season.teamRecord.longestLosingStreak > 0) ||
                          (season.teamRecord.teamGoals !== undefined && season.teamRecord.teamGoals > 0)) && (
                          <View className="px-4 py-3 bg-slate-700/20 border-b border-slate-700/50">
                            <Text className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                              Team Records
                            </Text>
                            <View className="flex-row flex-wrap">
                              {season.teamRecord.longestWinStreak !== undefined && season.teamRecord.longestWinStreak > 0 && (
                                <View className="w-1/3 mb-2">
                                  <Text className="text-slate-500 text-xs">Win Streak</Text>
                                  <Text className="text-orange-400 font-semibold">{season.teamRecord.longestWinStreak}</Text>
                                </View>
                              )}
                              {season.teamRecord.longestLosingStreak !== undefined && season.teamRecord.longestLosingStreak > 0 && (
                                <View className="w-1/3 mb-2">
                                  <Text className="text-slate-500 text-xs">Lose Streak</Text>
                                  <Text className="text-red-400 font-semibold">{season.teamRecord.longestLosingStreak}</Text>
                                </View>
                              )}
                              {season.teamRecord.teamGoals !== undefined && season.teamRecord.teamGoals > 0 && (
                                <View className="w-1/3 mb-2">
                                  <Text className="text-slate-500 text-xs">Team Goals</Text>
                                  <Text className="text-green-400 font-semibold">{season.teamRecord.teamGoals}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        )}

                        {/* Player Stats Table */}
                        {season.playerStats.length > 0 && (
                          <View className="px-4 py-3">
                            <View className="flex-row items-center mb-3">
                              <Users size={14} color="#67e8f9" />
                              <Text className="text-slate-300 text-xs font-semibold uppercase tracking-wider ml-2">
                                Roster ({season.playerStats.length})
                              </Text>
                            </View>

                            {/* Stats Table */}
                            <View className="bg-slate-700/30 rounded-xl overflow-hidden">
                              {/* Table Header */}
                              <View className="flex-row items-center px-2 py-2 bg-slate-700/50 border-b border-slate-600/50">
                                <Text className="text-slate-300 font-semibold text-xs w-16">Player</Text>
                                <Text className="text-slate-300 font-semibold text-xs w-12 text-center">Pos</Text>
                                {statHeaders.map((header) => (
                                  <Text key={header} className="text-slate-300 font-semibold text-xs flex-1 text-center">
                                    {header}
                                  </Text>
                                ))}
                              </View>

                              {/* Non-Goalie Rows */}
                              {nonGoalies.map((player, idx) => {
                                const statValues = getStatValues(season.sport, player);
                                const positions = getDisplayPositions(player);
                                return (
                                  <View
                                    key={player.playerId}
                                    className={`flex-row items-center px-2 py-2 ${idx !== nonGoalies.length - 1 || goalies.length > 0 ? 'border-b border-slate-600/30' : ''}`}
                                  >
                                    <View className="w-16 flex-row items-center">
                                      <Text className="text-cyan-400 text-[10px] font-bold mr-0.5">#{player.jerseyNumber}</Text>
                                      <Text className="text-white text-[10px]" numberOfLines={1}>{player.playerName.split(' ')[0]}</Text>
                                    </View>
                                    <Text className="text-slate-400 text-[10px] w-12 text-center">{positions}</Text>
                                    {statValues.map((value, i) => (
                                      <Text key={i} className="text-slate-300 text-xs flex-1 text-center">
                                        {value}
                                      </Text>
                                    ))}
                                  </View>
                                );
                              })}

                              {/* Goalie Section */}
                              {goalies.length > 0 && goalieHeaders.length > 0 && (
                                <>
                                  {/* Goalie Header */}
                                  <View className="flex-row items-center px-2 py-2 bg-slate-700/50 border-b border-slate-600/50">
                                    <Text className="text-slate-300 font-semibold text-xs w-16">Goalies</Text>
                                    <Text className="text-slate-300 font-semibold text-xs w-12 text-center">Pos</Text>
                                    {goalieHeaders.map((header) => (
                                      <Text key={header} className="text-slate-300 font-semibold text-xs flex-1 text-center">
                                        {header}
                                      </Text>
                                    ))}
                                  </View>

                                  {/* Goalie Rows */}
                                  {goalies.map((player, idx) => {
                                    const statValues = getGoalieStatValues(season.sport, player);
                                    const positions = getDisplayPositions(player);
                                    return (
                                      <View
                                        key={player.playerId}
                                        className={`flex-row items-center px-2 py-2 ${idx !== goalies.length - 1 ? 'border-b border-slate-600/30' : ''}`}
                                      >
                                        <View className="w-16 flex-row items-center">
                                          <Text className="text-cyan-400 text-[10px] font-bold mr-0.5">#{player.jerseyNumber}</Text>
                                          <Text className="text-white text-[10px]" numberOfLines={1}>{player.playerName.split(' ')[0]}</Text>
                                        </View>
                                        <Text className="text-slate-400 text-[10px] w-12 text-center">{positions}</Text>
                                        {statValues.map((value, i) => (
                                          <Text key={i} className="text-slate-300 text-xs flex-1 text-center">
                                            {value}
                                          </Text>
                                        ))}
                                      </View>
                                    );
                                  })}
                                </>
                              )}
                            </View>

                            {/* Attendance Summary (if available) */}
                            {season.playerStats.some(p => (p.gamesInvited ?? 0) > 0) && (
                              <View className="mt-3">
                                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                  Attendance
                                </Text>
                                <View className="bg-slate-700/30 rounded-xl overflow-hidden">
                                  <View className="flex-row items-center px-2 py-2 bg-slate-700/50 border-b border-slate-600/50">
                                    <Text className="text-slate-300 font-semibold text-xs flex-1">Player</Text>
                                    <Text className="text-slate-300 font-semibold text-xs w-16 text-center">Games</Text>
                                    <Text className="text-slate-300 font-semibold text-xs w-12 text-center">%</Text>
                                  </View>
                                  {season.playerStats.filter(p => (p.gamesInvited ?? 0) > 0).map((player, idx, arr) => {
                                    const invited = player.gamesInvited ?? 0;
                                    const attended = player.gamesAttended ?? 0;
                                    const pct = invited > 0 ? Math.round((attended / invited) * 100) : 0;
                                    return (
                                      <View
                                        key={player.playerId}
                                        className={`flex-row items-center px-2 py-2 ${idx !== arr.length - 1 ? 'border-b border-slate-600/30' : ''}`}
                                      >
                                        <View className="flex-1 flex-row items-center">
                                          <Text className="text-cyan-400 text-[10px] font-bold mr-1">#{player.jerseyNumber}</Text>
                                          <Text className="text-white text-xs">{player.playerName}</Text>
                                        </View>
                                        <Text className="text-slate-300 text-xs w-16 text-center">{attended}/{invited}</Text>
                                        <Text className={`text-xs w-12 text-center font-medium ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                          {pct}%
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Restore Season Button - Admin Only */}
                        {isAdmin && (
                          <View className="px-4 pb-4">
                            <Pressable
                              onPress={() => handleUnarchive(season)}
                              className="flex-row items-center justify-center bg-amber-600/20 border border-amber-500/30 rounded-xl py-3 active:bg-amber-600/30"
                            >
                              <RotateCcw size={16} color="#fbbf24" />
                              <Text className="text-amber-400 font-semibold ml-2">Restore This Season</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
