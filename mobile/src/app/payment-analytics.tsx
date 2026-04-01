import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ChevronLeft, DollarSign, TrendingUp, Clock, Users, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useTeamStore } from '@/lib/store';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PaymentAnalyticsScreen() {
  const router = useRouter();
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const players = useTeamStore((s) => s.players);
  const isPremium = useTeamStore((s) => s.teamSettings?.isPremium);

  // ── Computed metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!paymentPeriods.length) return null;

    const activePlayers = players.filter(
      (p) => p.position !== 'Coach' && p.position !== 'Parent' && p.status !== 'reserve',
    );

    // Collection rate per period
    const periodStats = paymentPeriods.map((period) => {
      const total = period.playerPayments.length || activePlayers.length;
      const paid = period.playerPayments.filter((pp) => pp.status === 'paid').length;
      const partial = period.playerPayments.filter((pp) => pp.status === 'partial').length;
      const totalCollected = period.playerPayments.reduce((sum, pp) => {
        return sum + (pp.entries?.reduce((s, e) => s + e.amount, 0) ?? 0);
      }, 0);
      const totalOwed = (period.teamTotalOwed ?? period.amount * total);
      const collectionRate = total > 0 ? Math.round((paid / total) * 100) : 0;

      // Average days to pay (from createdAt to first entry date)
      const daysToPayList: number[] = [];
      period.playerPayments.forEach((pp) => {
        if (pp.paidAt && period.createdAt) {
          const created = new Date(period.createdAt).getTime();
          const paidTime = new Date(pp.paidAt).getTime();
          const days = Math.round((paidTime - created) / (1000 * 60 * 60 * 24));
          if (days >= 0) daysToPayList.push(days);
        }
      });
      const avgDaysToPay =
        daysToPayList.length > 0
          ? Math.round(daysToPayList.reduce((a, b) => a + b, 0) / daysToPayList.length)
          : null;

      return {
        id: period.id,
        title: period.title,
        amount: period.amount,
        dueDate: period.dueDate,
        createdAt: period.createdAt,
        paid,
        partial,
        unpaid: total - paid - partial,
        total,
        totalCollected,
        totalOwed,
        collectionRate,
        avgDaysToPay,
      };
    });

    // Overall stats
    const overallCollectionRate =
      periodStats.length > 0
        ? Math.round(periodStats.reduce((s, p) => s + p.collectionRate, 0) / periodStats.length)
        : 0;

    const totalCollected = periodStats.reduce((s, p) => s + p.totalCollected, 0);
    const totalOwed = periodStats.reduce((s, p) => s + p.totalOwed, 0);
    const outstanding = Math.max(0, totalOwed - totalCollected);

    const avgDaysAll = periodStats
      .map((p) => p.avgDaysToPay)
      .filter((d): d is number => d !== null);
    const overallAvgDays =
      avgDaysAll.length > 0
        ? Math.round(avgDaysAll.reduce((a, b) => a + b, 0) / avgDaysAll.length)
        : null;

    // Per-player collection rate across all periods
    const playerRates = activePlayers.map((player) => {
      let totalPeriods = 0;
      let paidPeriods = 0;
      paymentPeriods.forEach((period) => {
        const pp = period.playerPayments.find((p) => p.playerId === player.id);
        if (pp) {
          totalPeriods++;
          if (pp.status === 'paid') paidPeriods++;
        }
      });
      const rate = totalPeriods > 0 ? Math.round((paidPeriods / totalPeriods) * 100) : null;
      return { player, rate, paidPeriods, totalPeriods };
    }).filter((p) => p.totalPeriods > 0)
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

    return {
      periodStats,
      overallCollectionRate,
      totalCollected,
      totalOwed,
      outstanding,
      overallAvgDays,
      playerRates,
    };
  }, [paymentPeriods, players]);

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
            <DollarSign size={48} color="#1e3a5f" />
            <Text style={{ color: '#e2e8f0', fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>Payment Analytics</Text>
            <Text style={{ color: '#475569', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>Upgrade to Premium to unlock collection rates, payment timelines, and financial insights.</Text>
            <Pressable onPress={() => router.push('/upgrade')} style={{ marginTop: 24, backgroundColor: '#0ea5e9', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upgrade to Premium</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080c14' }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color="#94a3b8" />
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <BarChart3 size={40} color="#1e3a5f" />
            <Text style={{ color: '#475569', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>No payment periods yet.{'\n'}Add your first payment period to see analytics.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const rateColor = (rate: number) =>
    rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444';

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
          <Text style={{ color: '#334155', fontSize: 13, fontWeight: '600' }}>Payment Analytics</Text>
          <View style={{ width: 40 }} />
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(60).springify()} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>Financial Summary</Text>
            <Text style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{metrics.periodStats.length} payment period{metrics.periodStats.length !== 1 ? 's' : ''} tracked</Text>
          </Animated.View>

          {/* Top KPI row */}
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Collection Rate */}
              <LinearGradient
                colors={['#0f1e35', '#0a1628']}
                style={{ flex: 1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(103,232,249,0.1)' }}
              >
                <CheckCircle size={18} color="#22c55e" style={{ marginBottom: 8 }} />
                <Text style={{ color: rateColor(metrics.overallCollectionRate), fontSize: 28, fontWeight: '900' }}>
                  {metrics.overallCollectionRate}%
                </Text>
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Collection Rate</Text>
              </LinearGradient>

              {/* Avg Days to Pay */}
              <LinearGradient
                colors={['#0f1e35', '#0a1628']}
                style={{ flex: 1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(103,232,249,0.1)' }}
              >
                <Clock size={18} color="#67e8f9" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#67e8f9', fontSize: 28, fontWeight: '900' }}>
                  {metrics.overallAvgDays !== null ? `${metrics.overallAvgDays}d` : '—'}
                </Text>
                <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Avg Days to Pay</Text>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Collected vs Outstanding */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <LinearGradient
              colors={['#0f1e35', '#0a1628']}
              style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(103,232,249,0.08)' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                <View>
                  <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Collected</Text>
                  <Text style={{ color: '#22c55e', fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                    ${metrics.totalCollected.toLocaleString()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Outstanding</Text>
                  <Text style={{ color: metrics.outstanding > 0 ? '#f59e0b' : '#22c55e', fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                    ${metrics.outstanding.toLocaleString()}
                  </Text>
                </View>
              </View>
              {/* Progress bar */}
              {metrics.totalOwed > 0 && (
                <View>
                  <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                    <LinearGradient
                      colors={['#22c55e', '#16a34a']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{
                        height: 8,
                        borderRadius: 4,
                        width: `${Math.min(100, Math.round((metrics.totalCollected / metrics.totalOwed) * 100))}%`,
                      }}
                    />
                  </View>
                  <Text style={{ color: '#334155', fontSize: 10, marginTop: 6 }}>
                    {Math.round((metrics.totalCollected / metrics.totalOwed) * 100)}% of ${metrics.totalOwed.toLocaleString()} total owed
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {/* Per-period breakdown */}
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
              By Period
            </Text>
            <View style={{ gap: 10 }}>
              {metrics.periodStats.map((period, i) => (
                <Animated.View
                  key={period.id}
                  entering={FadeInDown.delay(130 + i * 30).springify()}
                  style={{ backgroundColor: '#0f172a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700' }}>{period.title}</Text>
                      {period.dueDate && (
                        <Text style={{ color: '#334155', fontSize: 11, marginTop: 2 }}>
                          Due {new Date(period.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      )}
                    </View>
                    <View style={{
                      backgroundColor: `${rateColor(period.collectionRate)}18`,
                      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
                      borderWidth: 1, borderColor: `${rateColor(period.collectionRate)}40`,
                    }}>
                      <Text style={{ color: rateColor(period.collectionRate), fontSize: 13, fontWeight: '800' }}>
                        {period.collectionRate}%
                      </Text>
                    </View>
                  </View>
                  {/* Mini bar */}
                  <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: rateColor(period.collectionRate), width: `${period.collectionRate}%` }} />
                  </View>
                  {/* Paid / Partial / Unpaid chips */}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                      <Text style={{ color: '#475569', fontSize: 11 }}>{period.paid} paid</Text>
                    </View>
                    {period.partial > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
                        <Text style={{ color: '#475569', fontSize: 11 }}>{period.partial} partial</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
                      <Text style={{ color: '#475569', fontSize: 11 }}>{period.unpaid} unpaid</Text>
                    </View>
                    {period.avgDaysToPay !== null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                        <Clock size={10} color="#475569" />
                        <Text style={{ color: '#475569', fontSize: 11 }}>{period.avgDaysToPay}d avg</Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* Player leaderboard */}
          {metrics.playerRates.length > 0 && (
            <Animated.View entering={FadeInDown.delay(160).springify()} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
                Player Reliability
              </Text>
              <View style={{ backgroundColor: '#0f172a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                {metrics.playerRates.slice(0, 10).map((item, i) => {
                  const name = `${item.player.firstName} ${item.player.lastName}`;
                  const rate = item.rate ?? 0;
                  return (
                    <View
                      key={item.player.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 14, paddingVertical: 11,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: 'rgba(255,255,255,0.04)',
                        gap: 12,
                      }}
                    >
                      <Text style={{ color: '#334155', fontSize: 12, fontWeight: '700', width: 20, textAlign: 'center' }}>{i + 1}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }} numberOfLines={1}>{name}</Text>
                      <View style={{ width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginRight: 8 }}>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: rateColor(rate), width: `${rate}%` }} />
                      </View>
                      <Text style={{ color: rateColor(rate), fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' }}>
                        {rate}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default withErrorBoundary(PaymentAnalyticsScreen);
