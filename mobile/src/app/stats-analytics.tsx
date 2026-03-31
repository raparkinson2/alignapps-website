import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, TrendingUp, UserCheck, BarChart3, ChevronRight,
  Trophy, Calendar, Flame, Star, Zap, Crown,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useTeamStore, getPlayerName, Player } from '@/lib/store';
import { useTeamColor, hexToRgba } from '@/lib/theme';
import { PlayerAvatar } from '@/components/PlayerAvatar';

export default function StatsAnalyticsScreen() {
  const router = useRouter();
  const showTeamStats = useTeamStore((s) => s.teamSettings.showTeamStats !== false);
  const showTeamRecords = useTeamStore((s) => s.teamSettings.showTeamRecords === true && s.teamSettings.showTeamStats !== false);
  const hasSeasonHistory = useTeamStore((s) => (s.teamSettings.seasonHistory?.length ?? 0) > 0);
  const isPremium = useTeamStore((s) => s.teamSettings.isPremium);

  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamColor = useTeamColor();

  const sport = teamSettings?.sport ?? 'hockey';
  const record = teamSettings?.record;

  const wins = record?.wins ?? 0;
  const losses = record?.losses ?? 0;
  const ties = record?.ties ?? 0;
  const otLosses = record?.otLosses ?? 0;
  const hasRecord = wins > 0 || losses > 0 || ties > 0;
  const totalPlayed = wins + losses + ties + otLosses;
  const winPct = totalPlayed > 0 ? Math.round((wins / totalPlayed) * 100) : 0;

  const formatRecord = () => {
    const parts = [wins, losses];
    if (sport === 'hockey' || sport === 'soccer') {
      parts.push(ties);
      if (sport === 'hockey') parts.push(otLosses);
    }
    return parts.join(' — ');
  };

  // Last 5 completed games (oldest → newest so left = oldest)
  const last5 = useMemo(() => {
    return [...games]
      .filter((g) => g.gameResult)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .reverse();
  }, [games]);

  // Top performer by primary stat
  const topPerformer = useMemo((): { player: Player; value: number; label: string } | null => {
    const eligible = players.filter(
      (p) => p.status === 'active' && p.position !== 'Coach' && p.position !== 'Parent' && !p.roles?.includes('coach') && !p.roles?.includes('parent'),
    );
    let best: { player: Player; value: number; label: string } | null = null;
    for (const p of eligible) {
      const stats = p.stats as unknown as Record<string, number> | undefined;
      if (!stats) continue;
      let value = 0;
      let label = '';
      if (sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse') {
        value = (stats.goals ?? 0) + (stats.assists ?? 0);
        label = 'PTS';
      } else if (sport === 'basketball') {
        value = stats.points ?? 0;
        label = 'PTS';
      } else {
        value = stats.hits ?? 0;
        label = 'H';
      }
      if (value > (best?.value ?? 0)) {
        best = { player: p, value, label };
      }
    }
    return best;
  }, [players, sport]);

  // "Heating Up" — contributed in last 3 game logs
  const heatingUp = useMemo((): Player | null => {
    const eligible = players.filter(
      (p) => p.status === 'active' && (p.gameLogs?.length ?? 0) >= 3 && p.position !== 'Coach' && p.position !== 'Parent',
    );
    for (const p of eligible) {
      const recent = [...(p.gameLogs ?? [])]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);
      const hot = recent.every((log) => {
        const s = log.stats as unknown as Record<string, number>;
        if (sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse') {
          return (s.goals ?? 0) > 0 || (s.assists ?? 0) > 0;
        }
        if (sport === 'basketball') return (s.points ?? 0) >= 5;
        return (s.hits ?? 0) > 0;
      });
      if (hot) return p;
    }
    return null;
  }, [players, sport]);

  const resultColor = (result: string) =>
    result === 'win' ? '#22c55e' :
    result === 'loss' ? '#ef4444' :
    result === 'otLoss' ? '#f97316' :
    '#94a3b8';

  const resultLabel = (result: string) =>
    result === 'win' ? 'W' : result === 'loss' ? 'L' : result === 'otLoss' ? 'OTL' : 'T';

  const baseDelay = hasRecord ? 160 : 80;

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
          className="flex-row items-center px-5 pt-2 pb-4"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center mr-3"
          >
            <ArrowLeft size={20} color={teamColor} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-slate-400 text-sm font-medium">Teams</Text>
            <Text className="text-white text-2xl font-bold">Stats & Analytics</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hexToRgba(teamColor, 0.2), alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color={teamColor} />
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* ── Live Season Dashboard ── */}
          {hasRecord && (
            <Animated.View entering={FadeInDown.delay(80).springify()} className="mb-5">

              {/* Season Record Card */}
              <LinearGradient
                colors={[hexToRgba(teamColor, 0.22), hexToRgba(teamColor, 0.06), 'rgba(15,23,42,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: hexToRgba(teamColor, 0.28),
                }}
              >
                <View className="flex-row items-center mb-3">
                  <Trophy size={14} color={teamColor} />
                  <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider ml-2">
                    {teamSettings?.currentSeasonName ?? 'Current Season'}
                  </Text>
                </View>

                <View className="flex-row items-end justify-between">
                  <View>
                    <Text style={{ color: '#ffffff', fontSize: 40, fontWeight: '800', letterSpacing: -1, lineHeight: 46 }}>
                      {formatRecord()}
                    </Text>
                    <Text className="text-slate-500 text-xs mt-1">
                      {sport === 'hockey' ? 'W — L — T — OTL' : sport === 'soccer' ? 'W — L — T' : 'W — L'}
                    </Text>
                  </View>

                  {totalPlayed > 0 && (
                    <View
                      style={{
                        alignItems: 'center',
                        backgroundColor: hexToRgba(teamColor, 0.18),
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: hexToRgba(teamColor, 0.3),
                      }}
                    >
                      <Text style={{ color: teamColor, fontSize: 22, fontWeight: '800' }}>{winPct}%</Text>
                      <Text className="text-slate-400 text-xs">Win Rate</Text>
                    </View>
                  )}
                </View>

                {/* Last 5 W/L dots */}
                {last5.length > 0 && (
                  <View className="flex-row items-center mt-4" style={{ gap: 6 }}>
                    <Text className="text-slate-500 text-xs font-medium mr-1">Last {last5.length}</Text>
                    {last5.map((g) => (
                      <View
                        key={g.id}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: `${resultColor(g.gameResult!)}1A`,
                          borderWidth: 1.5,
                          borderColor: `${resultColor(g.gameResult!)}55`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: resultColor(g.gameResult!), fontWeight: '800', fontSize: 10 }}>
                          {resultLabel(g.gameResult!)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </LinearGradient>

              {/* Top Scorer + Heating Up */}
              {(topPerformer || heatingUp) && (
                <View className="flex-row" style={{ gap: 10 }}>
                  {topPerformer && (
                    <View className="flex-1 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/30">
                      <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                        <Star size={11} color="#f59e0b" />
                        <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Top Scorer</Text>
                      </View>
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <PlayerAvatar player={topPerformer.player} size={32} />
                        <View className="flex-1">
                          <Text className="text-white font-bold text-sm" numberOfLines={1}>
                            {getPlayerName(topPerformer.player)}
                          </Text>
                          <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700' }}>
                            {topPerformer.value} {topPerformer.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {heatingUp && (
                    <View
                      className="flex-1 rounded-2xl p-3"
                      style={{
                        backgroundColor: 'rgba(249,115,22,0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(249,115,22,0.28)',
                      }}
                    >
                      <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                        <Flame size={11} color="#f97316" />
                        <Text style={{ color: '#fb923c', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>HEATING UP</Text>
                      </View>
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <PlayerAvatar player={heatingUp} size={32} />
                        <View className="flex-1">
                          <Text className="text-white font-bold text-sm" numberOfLines={1}>
                            {getPlayerName(heatingUp)}
                          </Text>
                          <Text style={{ color: '#fb923c', fontSize: 12, fontWeight: '600' }}>3 game streak</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {/* ── Section Label ── */}
          <Animated.View entering={FadeInDown.delay(baseDelay - 20).springify()} className="mb-3">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Analytics</Text>
          </Animated.View>

          {/* Attendance */}
          <Animated.View entering={FadeInDown.delay(baseDelay).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/attendance');
              }}
              className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hexToRgba(teamColor, 0.2), alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={20} color={teamColor} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-semibold text-white">Attendance</Text>
                <Text className="text-slate-400 text-sm">Track check-ins and attendance rates</Text>
              </View>
              <ChevronRight size={20} color="#64748b" />
            </Pressable>
          </Animated.View>

          {/* Team Records */}
          {showTeamRecords && (
            <Animated.View entering={FadeInDown.delay(baseDelay + 30).springify()}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/team-records');
                }}
                className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
              >
                <View className="w-10 h-10 rounded-full items-center justify-center bg-amber-500/20">
                  <Trophy size={20} color="#f59e0b" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-white">Team Records</Text>
                  <Text className="text-slate-400 text-sm">All-time records and individual leaders</Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </Pressable>
            </Animated.View>
          )}

          {/* View Team Stats */}
          {showTeamStats && (
            <Animated.View entering={FadeInDown.delay(baseDelay + 60).springify()}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/team-stats');
                }}
                className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: hexToRgba(teamColor, 0.2), alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={20} color={teamColor} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-white">Player Statistics</Text>
                  <Text className="text-slate-400 text-sm">Sortable leaderboard with progress bars</Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </Pressable>
            </Animated.View>
          )}

          {/* Season Summary */}
          {showTeamStats && (
            <Animated.View entering={FadeInDown.delay(baseDelay + 90).springify()}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/season-summary');
                }}
                className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
              >
                <View className="w-10 h-10 rounded-full items-center justify-center bg-green-500/20">
                  <Zap size={20} color="#22c55e" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-white">Season Summary</Text>
                  <Text className="text-slate-400 text-sm">Full season overview and highlights</Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </Pressable>
            </Animated.View>
          )}

          {/* Season History */}
          {hasSeasonHistory && (
            <Animated.View entering={FadeInDown.delay(baseDelay + 120).springify()}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/season-history');
                }}
                className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
              >
                <View className="w-10 h-10 rounded-full items-center justify-center bg-purple-500/20">
                  <Calendar size={20} color="#a78bfa" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-white">Season History</Text>
                  <Text className="text-slate-400 text-sm">View archived seasons and stats</Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Premium Insights ── */}
          <Animated.View entering={FadeInDown.delay(baseDelay + 150).springify()} className="mt-2">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Premium</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/premium-insights');
              }}
            >
              <LinearGradient
                colors={isPremium ? ['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.06)'] : ['rgba(100,116,139,0.15)', 'rgba(100,116,139,0.05)']}
                style={{
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: isPremium ? 'rgba(245,158,11,0.35)' : 'rgba(100,116,139,0.25)',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isPremium ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Crown size={22} color={isPremium ? '#f59e0b' : '#64748b'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: isPremium ? '#f59e0b' : '#94a3b8', fontWeight: '700', fontSize: 15 }}>
                    Coach Insights
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                    {isPremium
                      ? 'Engagement scores, flakes, scouting & weather'
                      : 'Upgrade to unlock advanced analytics'}
                  </Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
