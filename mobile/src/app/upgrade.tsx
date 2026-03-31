import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
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
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
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

const FEATURES = [
  { icon: <Users size={16} color="#67e8f9" />, label: 'Unlimited players on your roster' },
  { icon: <Trophy size={16} color="#f59e0b" />, label: 'Team records, championships & history' },
  { icon: <BarChart3 size={16} color="#a78bfa" />, label: 'Advanced stats, game logs & leaderboards' },
  { icon: <FileText size={16} color="#22c55e" />, label: 'Export stats as CSV (coaches love this)' },
  { icon: <Share2 size={16} color="#67e8f9" />, label: 'Share stat cards & game results' },
  { icon: <Bell size={16} color="#f97316" />, label: 'Push notifications for games & chat' },
  { icon: <Calendar size={16} color="#a78bfa" />, label: 'Unlimited games, practices & events' },
  { icon: <MessageSquare size={16} color="#22c55e" />, label: 'Real-time team chat with photos & GIFs' },
  { icon: <DollarSign size={16} color="#f59e0b" />, label: 'Payment tracking & dues management' },
];

const MULTI_TEAM_EXTRA = [
  { icon: <Shield size={16} color="#f59e0b" />, label: 'Manage unlimited teams from one account' },
  { icon: <Users size={16} color="#f59e0b" />, label: 'Switch teams instantly — no re-login' },
];

type Tier = 'premium' | 'multi_team';

export default function UpgradeScreen() {
  const router = useRouter();
  const rcEnabled = isRevenueCatEnabled();

  const [selectedTier, setSelectedTier] = useState<Tier>('premium');
  const [annualPkg, setAnnualPkg] = useState<PurchasesPackage | null>(null);
  const [multiPkg, setMultiPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    const result = await getOfferings();
    if (result.ok && result.data.current) {
      const pkgs = result.data.current.availablePackages;
      setAnnualPkg(pkgs.find((p) => p.identifier === '$rc_annual') ?? null);
      setMultiPkg(pkgs.find((p) => p.identifier === '$rc_custom_multiteam_annual') ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const activePkg = selectedTier === 'premium' ? annualPkg : multiPkg;

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
    // Re-check customer info
    const info = await getCustomerInfo();
    setRestoring(false);
    if (info.ok && Object.keys(info.data.entitlements.active).length > 0) {
      router.back();
    }
  };

  const premiumPrice = annualPkg?.product.priceString ?? '$59.99';
  const multiPrice = multiPkg?.product.priceString ?? '$99.99';

  return (
    <View style={{ flex: 1, backgroundColor: '#080c14' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#080c14', '#0d1525', '#080c14']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Glow accents */}
      <View style={{ position: 'absolute', top: -80, left: '15%', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(245,158,11,0.05)' }} />
      <View style={{ position: 'absolute', top: 300, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(103,232,249,0.04)' }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Close */}
        <Animated.View entering={FadeIn.delay(30)} style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color="#94a3b8" />
          </Pressable>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {/* Hero */}
          <Animated.View entering={FadeInDown.delay(60).springify()} style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <Crown size={34} color="#f59e0b" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, lineHeight: 36, marginBottom: 8 }}>
              Unlock ALIGN Sports
            </Text>
            <Text style={{ color: '#64748b', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              Everything your team needs — stats, records,{'\n'}payments, chat, and unlimited players.
            </Text>
          </Animated.View>

          {/* Tier selector */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
              Choose your plan
            </Text>

            {/* Premium tier */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTier('premium'); }}
              style={{
                borderRadius: 18,
                borderWidth: selectedTier === 'premium' ? 2 : 1,
                borderColor: selectedTier === 'premium' ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.08)',
                backgroundColor: selectedTier === 'premium' ? 'rgba(245,158,11,0.07)' : 'rgba(15,23,42,0.6)',
                padding: 16,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>1 Team</Text>
                    <View style={{ backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)' }}>
                      <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>30-DAY FREE TRIAL</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Full features for one team</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                  <Text style={{ color: '#f59e0b', fontSize: 22, fontWeight: '800' }}>{premiumPrice}</Text>
                  <Text style={{ color: '#475569', fontSize: 12 }}>/year</Text>
                </View>
              </View>
              {selectedTier === 'premium' && (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 12, right: 12 }}>
                  <Check size={12} color="#000" />
                </View>
              )}
            </Pressable>

            {/* Multi-team tier */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedTier('multi_team'); }}
              style={{
                borderRadius: 18,
                borderWidth: selectedTier === 'multi_team' ? 2 : 1,
                borderColor: selectedTier === 'multi_team' ? 'rgba(167,139,250,0.7)' : 'rgba(255,255,255,0.08)',
                backgroundColor: selectedTier === 'multi_team' ? 'rgba(167,139,250,0.07)' : 'rgba(15,23,42,0.6)',
                padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>Multi-Team</Text>
                    <View style={{ backgroundColor: 'rgba(167,139,250,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)' }}>
                      <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '700' }}>BEST VALUE</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>All features, unlimited teams</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                  <Text style={{ color: '#a78bfa', fontSize: 22, fontWeight: '800' }}>{multiPrice}</Text>
                  <Text style={{ color: '#475569', fontSize: 12 }}>/year</Text>
                </View>
              </View>
              {selectedTier === 'multi_team' && (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#a78bfa', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 12, right: 12 }}>
                  <Check size={12} color="#000" />
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.delay(140).springify()} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            {rcEnabled ? (
              <>
                <Pressable
                  onPress={handlePurchase}
                  disabled={purchasing || loading || !activePkg}
                  style={({ pressed }) => ({ borderRadius: 16, overflow: 'hidden', opacity: pressed || purchasing || !activePkg ? 0.8 : 1 })}
                >
                  <LinearGradient
                    colors={selectedTier === 'premium' ? ['#f59e0b', '#d97706'] : ['#a78bfa', '#7c3aed']}
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
                          {selectedTier === 'premium' ? 'Start 30-Day Free Trial' : `Get Multi-Team — ${multiPrice}/yr`}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={handleRestore} disabled={restoring} style={{ alignItems: 'center', paddingVertical: 12 }}>
                  {restoring ? <ActivityIndicator color="#64748b" size="small" /> : <Text style={{ color: '#475569', fontSize: 13 }}>Restore Purchases</Text>}
                </Pressable>
              </>
            ) : (
              <View style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', alignItems: 'center' }}>
                <Text style={{ color: '#f59e0b', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                  Go to the Payments tab in Vibecode{'\n'}to activate subscriptions for your team.
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Features list */}
          <Animated.View entering={FadeInDown.delay(180).springify()} style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
              Everything included
            </Text>
            <View style={{ backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {FEATURES.map((f, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.04)', gap: 12 }}
                >
                  {f.icon}
                  <Text style={{ color: '#cbd5e1', fontSize: 14, flex: 1 }}>{f.label}</Text>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: 'rgba(167,139,250,0.2)', marginHorizontal: 16 }} />
              <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>Multi-Team also includes</Text>
              </View>
              {MULTI_TEAM_EXTRA.map((f, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', gap: 12 }}
                >
                  {f.icon}
                  <Text style={{ color: '#cbd5e1', fontSize: 14, flex: 1 }}>{f.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Trust signals */}
          <Animated.View entering={FadeInDown.delay(220).springify()} style={{ paddingHorizontal: 20 }}>
            <View style={{ backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
              {[
                { icon: <Shield size={15} color="#22c55e" />, text: 'Cancel anytime — no questions asked' },
                { icon: <Star size={15} color="#f59e0b" />, text: '30-day free trial on single-team plan' },
                { icon: <Lock size={15} color="#67e8f9" />, text: 'Secure payments via Apple / Google' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.05)', gap: 12 }}>
                  {item.icon}
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item.text}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
