import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  X,
  Trophy,
  Users,
  BarChart3,
  Bell,
  Zap,
  Star,
  Shield,
  Calendar,
  MessageSquare,
  Share2,
  Check,
  Crown,
  ChevronRight,
  Lock,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';

const PREMIUM_FEATURES = [
  {
    icon: <Users size={18} color="#67e8f9" />,
    title: 'Unlimited Players',
    description: 'Roster of any size — no caps',
    free: '10 players',
    premium: 'Unlimited',
  },
  {
    icon: <Trophy size={18} color="#f59e0b" />,
    title: 'Team Records & History',
    description: 'All-time records, championship tracker, archived seasons',
    free: false,
    premium: true,
  },
  {
    icon: <BarChart3 size={18} color="#a78bfa" />,
    title: 'Advanced Stats & Analytics',
    description: 'Player leaderboards, game logs, season summaries',
    free: false,
    premium: true,
  },
  {
    icon: <Share2 size={18} color="#22c55e" />,
    title: 'Share Season Highlights',
    description: 'Share stat cards and game results to social media',
    free: false,
    premium: true,
  },
  {
    icon: <Bell size={18} color="#f97316" />,
    title: 'Push Notifications',
    description: 'Game invites, reminders, and chat notifications',
    free: false,
    premium: true,
  },
  {
    icon: <Calendar size={18} color="#67e8f9" />,
    title: 'Schedule & Game Management',
    description: 'Create unlimited games, practices, and events',
    free: '5 per month',
    premium: 'Unlimited',
  },
  {
    icon: <MessageSquare size={18} color="#a78bfa" />,
    title: 'Team Chat',
    description: 'Real-time group messaging, GIFs, photo sharing',
    free: false,
    premium: true,
  },
  {
    icon: <Shield size={18} color="#22c55e" />,
    title: 'Payment Tracking',
    description: 'Dues management, payment ledger, Stripe integration',
    free: false,
    premium: true,
  },
];

const TESTIMONIALS = [
  {
    quote: "Our whole team uses it every week. Worth every penny.",
    name: "Coach Dave",
    team: "Lightning Hockey",
  },
  {
    quote: "Stats and records keep our players motivated all season.",
    name: "Sarah T.",
    team: "City FC Soccer",
  },
  {
    quote: "Finally an app that handles our 22-player roster!",
    name: "Mike R.",
    team: "Sunday Baseball",
  },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const teamName = useTeamStore((s) => s.teamName);

  return (
    <View style={{ flex: 1, backgroundColor: '#080c14' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background gradient */}
      <LinearGradient
        colors={['#080c14', '#0d1525', '#080c14']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative glow */}
      <View
        style={{
          position: 'absolute',
          top: -100,
          left: '20%',
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(103, 232, 249, 0.06)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 200,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(167, 139, 250, 0.05)',
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Close button */}
        <Animated.View
          entering={FadeIn.delay(50)}
          style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color="#94a3b8" />
          </Pressable>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Hero Section */}
          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
          >
            {/* Crown icon with glow */}
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                borderWidth: 1.5,
                borderColor: 'rgba(245, 158, 11, 0.35)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Crown size={36} color="#f59e0b" />
            </View>

            <Text
              style={{
                color: '#ffffff',
                fontSize: 32,
                fontWeight: '800',
                textAlign: 'center',
                letterSpacing: -0.5,
                lineHeight: 38,
                marginBottom: 8,
              }}
            >
              Unlock the full{'\n'}AlignSports experience
            </Text>

            <Text style={{ color: '#64748b', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Everything your team needs — stats, records,{'\n'}payments, chat, and unlimited players.
            </Text>

            {/* Price card */}
            <LinearGradient
              colors={['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.06)']}
              style={{
                borderRadius: 20,
                paddingHorizontal: 28,
                paddingVertical: 20,
                width: '100%',
                borderWidth: 1.5,
                borderColor: 'rgba(245,158,11,0.35)',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ color: '#f59e0b', fontSize: 20, fontWeight: '700', marginTop: 6 }}>$</Text>
                <Text style={{ color: '#ffffff', fontSize: 52, fontWeight: '900', letterSpacing: -2, lineHeight: 58 }}>59</Text>
                <View style={{ marginLeft: 4, marginTop: 12 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600' }}>/year</Text>
                </View>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                That's just{' '}
                <Text style={{ color: '#f59e0b', fontWeight: '700' }}>$4.92/month</Text>
                {' '}— less than a coffee
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(34,197,94,0.15)',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(34,197,94,0.3)',
                }}
              >
                <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>7-DAY FREE TRIAL</Text>
              </View>
            </LinearGradient>

            {/* CTA Button */}
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              }}
              style={({ pressed }) => ({
                width: '100%',
                borderRadius: 16,
                overflow: 'hidden',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  alignItems: 'center',
                  borderRadius: 16,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Zap size={20} color="#000" />
                <Text style={{ color: '#000000', fontSize: 17, fontWeight: '800' }}>
                  Start Free Trial
                </Text>
              </LinearGradient>
            </Pressable>

            <Text style={{ color: '#475569', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              Set up payments in the Payments tab to activate subscriptions
            </Text>
          </Animated.View>

          {/* Features List */}
          <Animated.View
            entering={FadeInDown.delay(160).springify()}
            style={{ paddingHorizontal: 20, marginBottom: 32 }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16 }}>
              What you get with Premium
            </Text>

            <View
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              {PREMIUM_FEATURES.map((feature, i) => (
                <View
                  key={feature.title}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {feature.icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>{feature.title}</Text>
                    <Text style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>{feature.description}</Text>
                  </View>
                  <View style={{ alignItems: 'center', marginLeft: 8 }}>
                    {feature.premium === true ? (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: 'rgba(34,197,94,0.2)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={12} color="#22c55e" />
                      </View>
                    ) : (
                      <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700' }}>{feature.premium}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Testimonials */}
          <Animated.View
            entering={FadeInDown.delay(220).springify()}
            style={{ paddingHorizontal: 20, marginBottom: 32 }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16 }}>
              What teams are saying
            </Text>

            {TESTIMONIALS.map((t, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}
              >
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Star key={star} size={12} color="#f59e0b" fill="#f59e0b" style={{ marginRight: 2 }} />
                  ))}
                </View>
                <Text style={{ color: '#cbd5e1', fontSize: 14, fontStyle: 'italic', lineHeight: 20, marginBottom: 8 }}>
                  "{t.quote}"
                </Text>
                <Text style={{ color: '#475569', fontSize: 12 }}>
                  <Text style={{ color: '#64748b', fontWeight: '600' }}>{t.name}</Text> · {t.team}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* FAQ / Trust signals */}
          <Animated.View
            entering={FadeInDown.delay(260).springify()}
            style={{ paddingHorizontal: 20, marginBottom: 24 }}
          >
            <View
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
              }}
            >
              {[
                { icon: <Shield size={16} color="#22c55e" />, text: 'Cancel anytime — no questions asked' },
                { icon: <Star size={16} color="#f59e0b" />, text: '7-day free trial, no charge until day 8' },
                { icon: <Lock size={16} color="#67e8f9" />, text: 'Secure payments powered by RevenueCat' },
              ].map((item, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: 'rgba(255,255,255,0.05)',
                    gap: 12,
                  }}
                >
                  {item.icon}
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item.text}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Bottom CTA */}
          <Animated.View
            entering={FadeInUp.delay(300).springify()}
            style={{ paddingHorizontal: 20 }}
          >
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              }}
              style={({ pressed }) => ({
                borderRadius: 16,
                overflow: 'hidden',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  alignItems: 'center',
                  borderRadius: 16,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Crown size={20} color="#000" />
                <Text style={{ color: '#000000', fontSize: 17, fontWeight: '800' }}>
                  Unlock AlignSports Premium
                </Text>
              </LinearGradient>
            </Pressable>

            <Text style={{ color: '#334155', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 }}>
              To activate in-app purchases, go to the Payments tab{'\n'}in the Vibecode app and click Set Up Project.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
