import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format, parseISO, isPast } from 'date-fns';
import {
  ChevronLeft,
  Trophy,
  TrendingUp,
  Users,
  Target,
  Calendar,
  Swords,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore, getPlayerName } from '@/lib/store';

export default function SeasonSummaryScreen() {
  const router = useRouter();

  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);

  const sport = teamSettings?.sport ?? 'hockey';
  const record = teamSettings?.record;
  const seasonName = teamSettings?.currentSeasonName;

  // Completed games (those with a result recorded)
  const completedGames = games.filter((g) => g.gameResult);
  const wins = completedGames.filter((g) => g.gameResult === 'win').length;
  const losses = completedGames.filter((g) => g.gameResult === 'loss').length;
  const ties = completedGames.filter((g) => g.gameResult === 'tie').length;
  const otLosses = completedGames.filter((g) => g.gameResult === 'otLoss').length;
  const gamesPlayed = completedGames.length;
  const totalScheduled = games.length;

  // Goals/points scored (for games with score recorded)
  const scoredGames = completedGames.filter((g) => g.finalScoreUs !== undefined && g.finalScoreThem !== undefined);
  const totalGoalsFor = scoredGames.reduce((sum, g) => sum + (g.finalScoreUs ?? 0), 0);
  const totalGoalsAgainst = scoredGames.reduce((sum, g) => sum + (g.finalScoreThem ?? 0), 0);

  // Win percentage
  const winPct = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  // Longest win streak
  let currentStreak = 0;
  let longestStreak = 0;
  let currentStreakType: 'win' | 'loss' | null = null;
  let activeStreakCount = 0;
  let activeStreakType: 'win' | 'loss' | null = null;

  const sortedGames = [...completedGames].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const g of sortedGames) {
    const isWin = g.gameResult === 'win';
    const isLoss = g.gameResult === 'loss' || g.gameResult === 'otLoss';
    if (isWin) {
      currentStreak = currentStreakType === 'win' ? currentStreak + 1 : 1;
      currentStreakType = 'win';
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (isLoss) {
      currentStreak = currentStreakType === 'loss' ? currentStreak + 1 : 1;
      currentStreakType = 'loss';
    } else {
      currentStreak = 1;
      currentStreakType = null;
    }
  }

  // Current active streak (last N games)
  for (let i = sortedGames.length - 1; i >= 0; i--) {
    const g = sortedGames[i];
    const isWin = g.gameResult === 'win';
    const isLoss = g.gameResult === 'loss' || g.gameResult === 'otLoss';
    const type = isWin ? 'win' : isLoss ? 'loss' : null;
    if (i === sortedGames.length - 1) {
      activeStreakType = type;
      activeStreakCount = 1;
    } else if (type === activeStreakType) {
      activeStreakCount++;
    } else {
      break;
    }
  }

  // Attendance leaders — most games checked in across all completed games
  const isCoachOrParent = (roles?: string[], position?: string) =>
    position === 'Coach' || position === 'Parent' ||
    roles?.includes('coach') || roles?.includes('parent');

  const eligiblePlayers = players.filter((p) => !isCoachOrParent(p.roles, p.position));

  const attendanceCounts: Record<string, number> = {};
  for (const g of completedGames) {
    for (const pid of g.checkedInPlayers ?? []) {
      attendanceCounts[pid] = (attendanceCounts[pid] ?? 0) + 1;
    }
  }

  const attendanceLeaders = eligiblePlayers
    .map((p) => ({ player: p, count: attendanceCounts[p.id] ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent results (last 8 games)
  const recentResults = [...completedGames]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const formatRecord = () => {
    if (record) {
      const parts = [record.wins ?? 0, record.losses ?? 0];
      if (sport === 'hockey' || sport === 'soccer') {
        parts.push(record.ties ?? 0);
        if (sport === 'hockey') parts.push(record.otLosses ?? 0);
      }
      return parts.join(' - ');
    }
    // Fall back to computed
    const parts = [wins, losses];
    if (sport === 'hockey' || sport === 'soccer') {
      parts.push(ties);
      if (sport === 'hockey') parts.push(otLosses);
    }
    return parts.join(' - ');
  };

  const resultColor = (result: string) =>
    result === 'win' ? '#22c55e' :
    result === 'loss' ? '#ef4444' :
    result === 'otLoss' ? '#f97316' :
    '#94a3b8';

  const resultLabel = (result: string) =>
    result === 'win' ? 'W' : result === 'loss' ? 'L' : result === 'otLoss' ? 'OTL' : 'T';

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
          className="flex-row items-center px-4 py-3 mb-2"
        >
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-3"
          >
            <ChevronLeft size={24} color="white" />
          </Pressable>
          <View>
            <Text className="text-white font-bold text-xl">Season Summary</Text>
            {seasonName ? (
              <Text className="text-cyan-400 text-sm">{seasonName}</Text>
            ) : (
              <Text className="text-slate-500 text-xs">{teamName}</Text>
            )}
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 16 }}
        >
          {/* Record Hero */}
          <Animated.View entering={FadeInDown.delay(100).springify()} className="mb-5">
            <LinearGradient
              colors={wins > losses ? ['rgba(34,197,94,0.15)', 'rgba(34,197,94,0.05)'] : wins < losses ? ['rgba(239,68,68,0.12)', 'rgba(239,68,68,0.04)'] : ['rgba(148,163,184,0.1)', 'rgba(148,163,184,0.04)']}
              style={{ borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: wins > losses ? 'rgba(34,197,94,0.25)' : wins < losses ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.15)' }}
            >
              <Trophy size={32} color={wins > losses ? '#22c55e' : wins < losses ? '#ef4444' : '#94a3b8'} />
              <Text style={{ color: '#ffffff', fontSize: 48, fontWeight: '800', marginTop: 8, letterSpacing: -1 }}>
                {formatRecord()}
              </Text>
              {sport === 'hockey' ? (
                <Text className="text-slate-400 text-sm mt-1">W — L — T — OTL</Text>
              ) : sport === 'soccer' ? (
                <Text className="text-slate-400 text-sm mt-1">W — L — T</Text>
              ) : (
                <Text className="text-slate-400 text-sm mt-1">W — L</Text>
              )}
              {gamesPlayed > 0 && (
                <Text className="text-cyan-400 font-semibold mt-3">{winPct}% win rate</Text>
              )}
            </LinearGradient>
          </Animated.View>

          {/* Stats Row */}
          <Animated.View entering={FadeInDown.delay(150).springify()} className="flex-row mb-4 gap-3">
            <View className="flex-1 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/30 items-center">
              <Calendar size={18} color="#67e8f9" />
              <Text className="text-white font-bold text-2xl mt-2">{gamesPlayed}</Text>
              <Text className="text-slate-400 text-xs text-center mt-0.5">Games Played</Text>
              {totalScheduled > gamesPlayed && (
                <Text className="text-slate-600 text-xs mt-0.5">of {totalScheduled}</Text>
              )}
            </View>

            {scoredGames.length > 0 && (
              <>
                <View className="flex-1 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/30 items-center">
                  <Target size={18} color="#22c55e" />
                  <Text className="text-white font-bold text-2xl mt-2">{totalGoalsFor}</Text>
                  <Text className="text-slate-400 text-xs text-center mt-0.5">
                    {sport === 'basketball' ? 'Pts Scored' : 'Goals For'}
                  </Text>
                </View>
                <View className="flex-1 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/30 items-center">
                  <Swords size={18} color="#ef4444" />
                  <Text className="text-white font-bold text-2xl mt-2">{totalGoalsAgainst}</Text>
                  <Text className="text-slate-400 text-xs text-center mt-0.5">
                    {sport === 'basketball' ? 'Pts Against' : 'Goals Against'}
                  </Text>
                </View>
              </>
            )}
          </Animated.View>

          {/* Streak Info */}
          {gamesPlayed > 0 && (
            <Animated.View entering={FadeInDown.delay(180).springify()} className="flex-row mb-4 gap-3">
              {longestStreak > 1 && (
                <View className="flex-1 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/30">
                  <Text className="text-slate-400 text-xs mb-1">Best Win Streak</Text>
                  <Text className="text-white font-bold text-2xl">{longestStreak}</Text>
                  <Text className="text-green-400 text-xs">consecutive wins</Text>
                </View>
              )}
              {activeStreakCount >= 2 && activeStreakType && (
                <View style={{ flex: 1, backgroundColor: activeStreakType === 'win' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: activeStreakType === 'win' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)' }}>
                  <Text className="text-slate-400 text-xs mb-1">Current Streak</Text>
                  <Text style={{ color: activeStreakType === 'win' ? '#22c55e' : '#ef4444', fontSize: 24, fontWeight: '800' }}>{activeStreakCount}</Text>
                  <Text style={{ color: activeStreakType === 'win' ? '#86efac' : '#fca5a5', fontSize: 12 }}>
                    in a row ({activeStreakType === 'win' ? 'wins' : 'losses'})
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Recent Results */}
          {recentResults.length > 0 && (
            <Animated.View entering={FadeInDown.delay(210).springify()} className="mb-5">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Recent Results
              </Text>
              <View className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/30">
                {recentResults.map((g, i) => (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/game-recap/${g.id}`);
                    }}
                    className={`flex-row items-center px-4 py-3 active:bg-slate-700/30 ${i > 0 ? 'border-t border-slate-700/30' : ''}`}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: `${resultColor(g.gameResult!)}20`,
                        borderWidth: 1,
                        borderColor: `${resultColor(g.gameResult!)}40`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ color: resultColor(g.gameResult!), fontWeight: '800', fontSize: 11 }}>
                        {resultLabel(g.gameResult!)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium text-sm">vs {g.opponent}</Text>
                      <Text className="text-slate-500 text-xs">{format(parseISO(g.date), 'MMM d')}</Text>
                    </View>
                    {g.finalScoreUs !== undefined && g.finalScoreThem !== undefined && (
                      <Text className="text-slate-300 font-semibold text-sm">
                        {g.finalScoreUs} — {g.finalScoreThem}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Attendance Leaders */}
          {attendanceLeaders.length > 0 && (
            <Animated.View entering={FadeInDown.delay(240).springify()} className="mb-5">
              <View className="flex-row items-center mb-3">
                <Users size={14} color="#67e8f9" />
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider ml-2">
                  Attendance Leaders
                </Text>
              </View>
              <View className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/30">
                {attendanceLeaders.map((item, i) => (
                  <View
                    key={item.player.id}
                    className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-slate-700/30' : ''}`}
                  >
                    <Text style={{ width: 24, color: i === 0 ? '#f59e0b' : '#64748b', fontWeight: '700', fontSize: 13 }}>
                      {i + 1}
                    </Text>
                    <Text className="flex-1 text-white font-medium text-sm">{getPlayerName(item.player)}</Text>
                    <Text className="text-slate-400 text-sm">
                      {item.count}/{gamesPlayed}
                    </Text>
                    <View
                      style={{
                        width: 60,
                        height: 4,
                        backgroundColor: '#1e293b',
                        borderRadius: 2,
                        marginLeft: 12,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${gamesPlayed > 0 ? (item.count / gamesPlayed) * 100 : 0}%`,
                          height: '100%',
                          backgroundColor: '#67e8f9',
                          borderRadius: 2,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {gamesPlayed === 0 && (
            <Animated.View entering={FadeInDown.delay(150).springify()} className="items-center py-12">
              <TrendingUp size={48} color="#334155" />
              <Text className="text-slate-500 text-center mt-4">
                No completed games yet.{'\n'}Record results to see your season summary.
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
