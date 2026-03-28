import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Shield,
  Settings,
  Users,
  Zap,
  ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';
import { useResponsive } from '@/lib/useResponsive';

export default function AdminScreen() {
  const router = useRouter();
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const { isTablet, containerPadding } = useResponsive();

  if (!isAdmin()) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center px-8">
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#0f172a']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Shield size={64} color="#64748b" />
        <Text className="text-white text-xl font-bold mt-4 text-center">Admin Access Required</Text>
        <Text className="text-slate-400 text-center mt-2">
          You need admin privileges to access this panel.
        </Text>
      </View>
    );
  }

  const sections = [
    {
      title: 'Team Settings',
      description: 'Name, logo, jersey colors, sport type',
      icon: <Settings size={24} color="#67e8f9" />,
      iconBg: 'bg-cyan-500/20',
      route: '/admin-team-settings' as const,
      meta: teamName,
    },
    {
      title: 'Roster & Roles',
      description: 'Manage players, roles, and lineups',
      icon: <Users size={24} color="#22c55e" />,
      iconBg: 'bg-green-500/20',
      route: '/admin-players' as const,
      meta: `${players.length} members`,
    },
    {
      title: 'Features & Tools',
      description: 'Chat, photos, payments, stats, refreshments',
      icon: <Zap size={24} color="#a78bfa" />,
      iconBg: 'bg-purple-500/20',
      route: '/admin-features' as const,
      meta: null,
    },
  ];

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-2 pb-4">
          <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            Control Panel
          </Text>
          <Text className="text-slate-400 text-sm mt-1">Admin settings for {teamName}</Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">
              Admin Sections
            </Text>

            {sections.map((section, index) => (
              <Animated.View key={section.route} entering={FadeInDown.delay(120 + index * 60).springify()}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(section.route);
                  }}
                  className="bg-slate-800/80 rounded-2xl p-5 mb-4 border border-slate-700/50 active:bg-slate-700/80"
                >
                  <View className="flex-row items-center">
                    <View className={`${section.iconBg} p-3 rounded-2xl`}>
                      {section.icon}
                    </View>
                    <View className="flex-1 ml-4">
                      <Text className="text-white font-bold text-lg">{section.title}</Text>
                      <Text className="text-slate-400 text-sm mt-0.5">{section.description}</Text>
                      {section.meta && (
                        <Text className="text-slate-500 text-xs mt-1">{section.meta}</Text>
                      )}
                    </View>
                    <ChevronRight size={20} color="#64748b" />
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
