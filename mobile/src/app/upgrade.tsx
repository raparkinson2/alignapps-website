import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  X,
  Trophy,
  Users,
  BarChart3,
  Bell,
  Calendar,
  MessageSquare,
  Share2,
  Check,
  Crown,
  Shield,
  Star,
  Lock,
  Zap,
  DollarSign,
  FileText,
  Image,
  TrendingUp,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState, useEffect, useCallback } from 'react';
import {
  isRevenueCatEnabled,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
} from '@/lib/revenuecatClient';
import type { PurchasesPackage } from 'react-native-purchases';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tier = 'premium' | 'multi_team';
type Billing = 'monthly' | 'annual';

interface PlanPackages {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

// ─── Static data ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: <BarChart3 size={15} color="#67e8f9" />,    label: 'Stats tracking — per player, per game, per season' },
  { icon: <Trophy size={15} color="#f59e0b" />,       label: 'Team records & championship history' },
  { icon: <Star size={15} color="#a78bfa" />,         label: 'Advanced stats — leaderboards, game logs, trends' },
  { icon: <Share2 size={15} color="#22c55e" />,       label: 'Share season highlights & stat cards' },
  { icon: <Calendar size={15} color="#67e8f9" />,     label: 'Seasons — archive & restore full season history' },
  { icon: <FileText size={15} color="#f97316" />,     label: 'Export stats as CSV' },
  { icon: <Shield size={15} color="#a78bfa" />,       label: 'File storage — documents, playbooks & media' },
  { icon: <DollarSign size={15} color="#22c55e" />,   label: 'Payment tracking & dues management' },
  { icon: <Image size={15} color="#f59e0b" />,        label: 'Expanded photo & media storage' },
  { icon: <TrendingUp size={15} color="#67e8f9" />,   label: 'Attendance trends — reliability charts over time' },
  { icon: <Users size={15} color="#a78bfa" />,        label: 'Parent portal — linked parent accounts per player' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function annualSavings(monthly: PurchasesPackage | null, annual: PurchasesPackage | null): string | null {
  if (!monthly || !annual) return null;
  const monthlyYearly = monthly.product.price * 12;
  const annualPrice = annual.product.price;
  if (monthlyYearly <= 0) return null;
  const pct = Math.round(((monthlyYearly - annualPrice) / monthlyYearly) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UpgradeScreen() {
  const router = useRouter();
  const rcEnabled = isRevenueCatEnabled();

  const [billing, setBilling] = useState<Billing>('annual');
  const [selectedTier, setSelectedTier] = useState<Tier>('premium');
  const [premium, setPremium] = useState<PlanPackages>({ monthly: null, annual: null });
  const [multiTeam, setMultiTeam] = useState<PlanPackages>({ monthly: null, annual: null });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    const result = await getOfferings();
    if (result.ok && result.data.current) {
      const pkgs = result.data.current.availablePackages;
      setPremium({
        monthly: pkgs.find((p) => p.identifier === '$rc_monthly') ?? null,
        annual:  pkgs.find((p) => p.identifier === '$rc_annual') ?? null,
      });
      setMultiTeam({
        monthly: pkgs.find((p) => p.identifier === '$rc_custom_multiteam_monthly') ?? null,
        annual:  pkgs.find((p) => p.identifier === '$rc_custom_multiteam_annual') ?? null,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadOfferings(); }, [loadOfferings]);

  const activePlan   = selectedTier === 'premium' ? premium   : multiTeam;
  const activePkg    = billing === 'monthly' ? activePlan.monthly : activePlan.annual;
  const savingsLabel = annualSavings(
    selectedTier === 'premium' ? premium.monthly   : multiTeam.monthly,
    selectedTier === 'premium' ? premium.annual    : multiTeam.annual,
  );

  const handlePurchase = async () => {
    if (!activePkg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPurchasing(true);
    const result = await purchasePackage(activePkg);
    setPurchasing(false);
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestoring(true);
    await restorePurchases();
    const info = await getCustomerInfo();
    setRestoring(false);
    if (info.ok && Object.keys(info.data.entitlements.active).length > 0) {
      router.back();
    }
  };

  // Price display helpers
  const premiumMonthlyStr  = premium.monthly?.product.priceString  ?? '$4.99';
  const premiumAnnualStr   = premium.annual?.product.priceString   ?? '$49.99';
  const multiMonthlyStr    = multiTeam.monthly?.product.priceString ?? '$9.99';
  const multiAnnualStr     = multiTeam.annual?.product.priceString  ?? '$99.99';

  const premiumDisplayPrice  = billing === 'monthly' ? `${premiumMonthlyStr}/mo`  : `${premiumAnnualStr}/yr`;
  const multiDisplayPrice    = billing === 'monthly' ? `${multiMonthlyStr}/mo`    : `${multiAnnualStr}/yr`;

  const isPremium    = selectedTier === 'premium';
  const accentColor  = isPremium ? '#f59e0b' : '#a78bfa';
  const ctaColors: [string, string] = isPremium ? ['#f59e0b', '#d97706'] : ['#a78bfa', '#7c3aed'];

  return (
    <View style={{ flex: 1, backgroundColor: '#080c14' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background */}
      <LinearGradient
        colors={['#080c14', '#0d1525', '#080c14']}
        style={{ position: 'absolute', inset: 0 }}
      />
      <View style={{ position: 'absolute', top: -80, left: '10%', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(245,158,11,0.04)' }} />
      <View style={{ position: 'absolute', top: 260, right: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(167,139,250,0.04)' }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Close button */}
        <Animated.View entering={FadeIn.delay(20)} style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color="#94a3b8" />
          </Pressable>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* Hero */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Crown size={32} color="#f59e0b" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, marginBottom: 6 }}>
              Unlock ALIGN Sports
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
              Stats, records, payments, chat{'\n'}and unlimited players — all in one place.
            </Text>
          </Animated.View>

          {/* Billing toggle */}
          <Animated.View entering={FadeInDown.delay(90).springify()} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(15,23,42,0.9)', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
              {(['monthly', 'annual'] as Billing[]).map((b) => {
                const isActive = billing === b;
                return (
                  <Pressable
                    key={b}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBilling(b); }}
                    style={{ flex: 1, position: 'relative' }}
                  >
                    {isActive && (
                      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }} />
                    )}
                    <View style={{ paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                      <Text style={{ color: isActive ? '#ffffff' : '#475569', fontSize: 14, fontWeight: isActive ? '700' : '500' }}>
                        {b === 'monthly' ? 'Monthly' : 'Annual'}
                      </Text>
                      {b === 'annual' && savingsLabel && (
                        <View style={{ backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '700' }}>{savingsLabel}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Plan cards */}
          <Animated.View entering={FadeInDown.delay(120).springify()} style={{ paddingHorizontal: 20, marginBottom: 20, gap: 10 }}>

            {/* Premium card */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTier('premium'); }}
              style={{
                borderRadius: 20,
                borderWidth: selectedTier === 'premium' ? 2 : 1,
                borderColor: selectedTier === 'premium' ? 'rgba(245,158,11,0.65)' : 'rgba(255,255,255,0.07)',
                backgroundColor: selectedTier === 'premium' ? 'rgba(245,158,11,0.06)' : 'rgba(15,23,42,0.7)',
                padding: 18,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>1 Team</Text>
                    {billing === 'annual' && (
                      <View style={{ backgroundColor: 'rgba(34,197,94,0.18)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
                        <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '700' }}>30-DAY FREE TRIAL</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Full features for one team</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#f59e0b', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
                    {billing === 'monthly' ? premiumMonthlyStr : premiumAnnualStr}
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>
                    per {billing === 'monthly' ? 'month' : 'year'}
                  </Text>
                  {billing === 'annual' && (
                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                      ~$4.17/mo
                    </Text>
                  )}
                </View>
              </View>
              {selectedTier === 'premium' && (
                <View style={{ position: 'absolute', top: 14, right: 14, width: 22, height: 22, borderRadius: 11, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} color="#000" strokeWidth={3} />
                </View>
              )}
            </Pressable>

            {/* Multi-Team card */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTier('multi_team'); }}
              style={{
                borderRadius: 20,
                borderWidth: selectedTier === 'multi_team' ? 2 : 1,
                borderColor: selectedTier === 'multi_team' ? 'rgba(167,139,250,0.65)' : 'rgba(255,255,255,0.07)',
                backgroundColor: selectedTier === 'multi_team' ? 'rgba(167,139,250,0.06)' : 'rgba(15,23,42,0.7)',
                padding: 18,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>Multi-Team</Text>
                    <View style={{ backgroundColor: 'rgba(167,139,250,0.18)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' }}>
                      <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '700' }}>UP TO 3 TEAMS</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>All features, manage up to 3 teams</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#a78bfa', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
                    {billing === 'monthly' ? multiMonthlyStr : multiAnnualStr}
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>
                    per {billing === 'monthly' ? 'month' : 'year'}
                  </Text>
                  {billing === 'annual' && (
                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                      ~$8.33/mo
                    </Text>
                  )}
                </View>
              </View>
              {selectedTier === 'multi_team' && (
                <View style={{ position: 'absolute', top: 14, right: 14, width: 22, height: 22, borderRadius: 11, backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} color="#000" strokeWidth={3} />
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.delay(150).springify()} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            {rcEnabled ? (
              <>
                <Pressable
                  onPress={handlePurchase}
                  disabled={purchasing || loading || !activePkg}
                  style={({ pressed }) => ({
                    borderRadius: 16,
                    overflow: 'hidden',
                    opacity: pressed || purchasing || !activePkg ? 0.75 : 1,
                  })}
                >
                  <LinearGradient
                    colors={ctaColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <>
                        <Zap size={18} color="#000" />
                        <Text style={{ color: '#000', fontSize: 16, fontWeight: '800' }}>
                          {isPremium && billing === 'annual'
                            ? `Start Free Trial — ${premiumAnnualStr}/yr`
                            : `Get ${isPremium ? '1 Team' : 'Multi-Team'} — ${billing === 'monthly' ? (isPremium ? premiumMonthlyStr : multiMonthlyStr) : (isPremium ? premiumAnnualStr : multiAnnualStr)}/${billing === 'monthly' ? 'mo' : 'yr'}`}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={handleRestore}
                  disabled={restoring}
                  style={{ alignItems: 'center', paddingVertical: 12 }}
                >
                  {restoring
                    ? <ActivityIndicator color="#475569" size="small" />
                    : <Text style={{ color: '#475569', fontSize: 13 }}>Restore Purchases</Text>}
                </Pressable>
              </>
            ) : (
              <View style={{ backgroundColor: 'rgba(245,158,11,0.07)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', alignItems: 'center' }}>
                <Text style={{ color: '#f59e0b', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                  Go to the Payments tab in Vibecode{'\n'}to activate subscriptions for your team.
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Features */}
          <Animated.View entering={FadeInDown.delay(180).springify()} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#334155', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
              Everything included in both plans
            </Text>
            <View style={{ backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              {FEATURES.map((f, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 11,
                    gap: 12,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {f.icon}
                  <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>{f.label}</Text>
                </View>
              ))}
              {/* Multi-team extra */}
              <View style={{ height: 1, backgroundColor: 'rgba(167,139,250,0.15)', marginHorizontal: 16 }} />
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
                <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Multi-Team also includes
                </Text>
              </View>
              {[
                { icon: <Users size={15} color="#a78bfa" />,  label: 'Manage up to 3 teams from one account' },
                { icon: <Shield size={15} color="#a78bfa" />, label: 'Instant team switching — no re-login' },
              ].map((f, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 11,
                    gap: 12,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {f.icon}
                  <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>{f.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Trust */}
          <Animated.View entering={FadeInDown.delay(210).springify()} style={{ paddingHorizontal: 20 }}>
            <View style={{ backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
              {[
                { icon: <Shield size={14} color="#22c55e" />, text: 'Cancel anytime — no questions asked' },
                { icon: <Star   size={14} color="#f59e0b" />, text: '30-day free trial on annual 1-team plan' },
                { icon: <Lock   size={14} color="#67e8f9" />, text: 'Secure payments via Apple & Google' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.05)', gap: 10 }}>
                  {item.icon}
                  <Text style={{ color: '#64748b', fontSize: 13 }}>{item.text}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
