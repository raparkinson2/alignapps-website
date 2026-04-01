import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ChevronLeft, Calendar, TrendingUp, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useTeamStore } from '@/lib/store';
import { getPlayerName } from '@/lib/store';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 40 - 100) / 10); // up to 10 columns

function AttendanceHeatmapScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const isPremium = useTeamStore((s) => s.teamSettings?.isPremium);

  const { heatmapData, completedGames, sortedPlayers } = useMemo(() => {
    const completed = games
      .filter((g) => !!g.gameResult)
      .sort((a, b) => a.date.localeCompare(b.date));

    const activePlayers = players.filter(
      (p) =>
        p.position !== 'Coach' &&
        p.position !== 'Parent' &&
        p.status !== 'reserve',
    );

    // For each player: array of 'played' | 'invited_not_played' | 'not_invited' per game
    const heatmap = activePlayers.map((player) => {
      const gameStatuses = completed.map((game) => {
        const invited = (game.invitedPlayers ?? []).includes(player.id);
        if (!invited) return 'not_invited' as const;
        const invitedIds = new Set(completed.filter(g => (g.invitedPlayers ?? []).includes(player.id)).map(g => g.id));
        const played = (player.gameLogs ?? []).some(
          (log) => !log.gameId || log.gameId === game.id,
        );
        return played ? ('played' as const) : ('missed' as const);
      });

      const invitedGames = completed.filter((g) => (g.invitedPlayers ?? []).includes(player.id));
      const invitedIds = new Set(invitedGames.map((g) => g.id));
      const playedCount = (player.gameLogs ?? []).filter(
        (log) => !log.gameId || invitedIds.has(log.gameId),
      ).length;
      const rate =
        invitedGames.length > 0
          ? Math.min(100, Math.round((playedCount / invitedGames.length) * 100))
          : null;

      return { player, gameStatuses, playedCount, invitedCount: invitedGames.length, rate };
    });

    // Sort by attendance rate desc, then by games invited desc
    const sorted = [...heatmap].sort((a, b) => {
      if (a.rate === null && b.rate === null) return 0;
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return b.rate - a.rate;
    });

    return { heatmapData: sorted, completedGames: completed, sortedPlayers: sorted };
  }, [games, players]);

  const cellColor = (status: 'played' | 'missed' | 'not_invited') => {
    switch (status) {
      case 'played': return '#22c55e';
      case 'missed': return '#ef4444';
      case 'not_invited': return 'rgba(255,255,255,0.05)';
    }
  };

  const rateColor = (rate: number | null) => {
    if (rate === null) return '#334155';
    if (rate >= 80) return '#22c55e';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (!isPremium) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080c14' }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color="#94a3b8" />
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Calendar size={48} color="#1e3a5f" />
            <Text style={{ color: '#e2e8f0', fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>Attendance Heatmap</Text>
            <Text style={{ color: '#475569', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>Upgrade to Premium to see who consistently shows up — and who flakes.</Text>
            <Pressable onPress={() => router.push('/upgrade')} style={{ marginTop: 24, backgroundColor: '#0ea5e9', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upgrade to Premium</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!completedGames.length) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080c14' }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color="#94a3b8" />
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Calendar size={40} color="#1e3a5f" />
            <Text style={{ color: '#475569', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>No completed games yet.{'\n'}Play some games to see attendance patterns.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Show last 10 games in heatmap (most recent, most visible)
  const displayGames = completedGames.slice(-10);
  const displayOffset = completedGames.length - displayGames.length;

  // Summary stats
  const teamAvgRate = (() => {
    const rates = heatmapData.map((d) => d.rate).filter((r): r is number => r !== null);
    return rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
  })();

  const topAttenders = heatmapData.filter((d) => (d.rate ?? 0) === 100).length;
  const concernPlayers = heatmapData.filter((d) => d.rate !== null && d.rate < 50).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#080c14' }}>
      <LinearGradient
        colors={['#080c14', '#0a1220', '#080c14']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(50)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={22} color="#94a3b8" />
          </Pressable>
          <Text style={{ color: '#334155', fontSize: 13, fontWeight: '600' }}>Attendance Heatmap</Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(60).springify()} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>Attendance Heatmap</Text>
            <Text style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Last {displayGames.length} of {completedGames.length} games</Text>
          </Animated.View>

          {/* KPI row */}
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <LinearGradient colors={['#0f1e35', '#0a1628']} style={{ flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)' }}>
                <Text style={{ color: teamAvgRate !== null ? rateColor(teamAvgRate) : '#334155', fontSize: 26, fontWeight: '900' }}>
                  {teamAvgRate !== null ? `${teamAvgRate}%` : '—'}
                </Text>
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Team Avg</Text>
              </LinearGradient>
              <LinearGradient colors={['#0f1e35', '#0a1628']} style={{ flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)' }}>
                <Text style={{ color: '#22c55e', fontSize: 26, fontWeight: '900' }}>{topAttenders}</Text>
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Perfect Attendance</Text>
              </LinearGradient>
              <LinearGradient colors={['#0f1e35', '#0a1628']} style={{ flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: concernPlayers > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(103,232,249,0.08)' }}>
                <Text style={{ color: concernPlayers > 0 ? '#ef4444' : '#334155', fontSize: 26, fontWeight: '900' }}>{concernPlayers}</Text>
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Below 50%</Text>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Legend */}
          <Animated.View entering={FadeInDown.delay(90).springify()} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {([['#22c55e', 'Played'], ['#ef4444', 'Missed'], ['rgba(255,255,255,0.1)', 'Not invited']] as const).map(([color, label]) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
                  <Text style={{ color: '#334155', fontSize: 11 }}>{label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Heatmap grid */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            {/* Game date headers */}
            <View style={{ flexDirection: 'row', marginBottom: 6, marginLeft: 100 }}>
              {displayGames.map((game, i) => (
                <View key={game.id} style={{ width: CELL_SIZE, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center' }}>
                    {new Date(game.date.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                  </Text>
                </View>
              ))}
            </View>

            {/* Player rows */}
            <View style={{ gap: 4 }}>
              {heatmapData.map((row, pi) => {
                const displayStatuses = row.gameStatuses.slice(-10);
                return (
                  <Animated.View
                    key={row.player.id}
                    entering={FadeInDown.delay(110 + pi * 20).springify()}
                    style={{ flexDirection: 'row', alignItems: 'center', height: CELL_SIZE }}
                  >
                    {/* Player name */}
                    <View style={{ width: 100, paddingRight: 8 }}>
                      <Text numberOfLines={1} style={{ color: '#94a3b8', fontSize: 11, fontWeight: '500' }}>
                        {row.player.firstName} {row.player.lastName?.[0]}.
                      </Text>
                    </View>
                    {/* Cells */}
                    {displayStatuses.map((status, gi) => (
                      <View
                        key={gi}
                        style={{
                          width: CELL_SIZE - 2,
                          height: CELL_SIZE - 2,
                          borderRadius: 3,
                          backgroundColor: cellColor(status),
                          marginRight: 2,
                        }}
                      />
                    ))}
                    {/* Rate badge */}
                    <View style={{ marginLeft: 8, minWidth: 32, alignItems: 'flex-end' }}>
                      <Text style={{ color: rateColor(row.rate), fontSize: 11, fontWeight: '700' }}>
                        {row.rate !== null ? `${row.rate}%` : '—'}
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* Reliability ranking */}
          <Animated.View entering={FadeInDown.delay(140).springify()} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
              Reliability Ranking
            </Text>
            <View style={{ backgroundColor: '#0f172a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              {heatmapData.filter((d) => d.invitedCount > 0).slice(0, 12).map((item, i) => {
                const rate = item.rate ?? 0;
                return (
                  <View
                    key={item.player.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 14, paddingVertical: 10,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: 'rgba(255,255,255,0.04)',
                      gap: 10,
                    }}
                  >
                    <Text style={{ color: '#1e3a5f', fontSize: 12, fontWeight: '700', width: 22, textAlign: 'center' }}>{i + 1}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {item.player.firstName} {item.player.lastName}
                    </Text>
                    <Text style={{ color: '#334155', fontSize: 11 }}>
                      {item.playedCount}/{item.invitedCount}
                    </Text>
                    <View style={{ width: 60, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: rateColor(rate), width: `${rate}%` }} />
                    </View>
                    <Text style={{ color: rateColor(rate), fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' }}>
                      {rate}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default withErrorBoundary(AttendanceHeatmapScreen);
