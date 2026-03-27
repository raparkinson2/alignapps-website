import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, ChevronRight, Plus, Shield, Star } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTeamStore, Team, SPORT_NAMES, getSportName, getPlayerName } from '@/lib/store';

interface TeamCardProps {
  team: Team;
  userRole: string;
  index: number;
  onSelect: () => void;
}

function TeamCard({ team, userRole, index, onSelect }: TeamCardProps) {
  const sportName = getSportName(team.teamSettings.sport);
  const playerCount = team.players.length;

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSelect();
        }}
        className="bg-slate-800/90 rounded-2xl p-4 mb-4 border border-slate-600/60 active:bg-slate-700/80"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <View className="flex-row items-center">
          {/* Team Logo */}
          {team.teamSettings.teamLogo ? (
            <Image
              source={{ uri: team.teamSettings.teamLogo }}
              style={{ width: 56, height: 56, borderRadius: 12 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-14 h-14 rounded-xl bg-cyan-500/20 items-center justify-center">
              <Users size={28} color="#67e8f9" />
            </View>
          )}

          {/* Team Info */}
          <View className="flex-1 ml-4">
            <Text className="text-white text-lg font-bold" numberOfLines={1}>
              {team.teamName}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-slate-300 text-sm">{sportName}</Text>
              <Text className="text-slate-500 mx-2">•</Text>
              <Text className="text-slate-300 text-sm">{playerCount} player{playerCount !== 1 ? 's' : ''}</Text>
            </View>
            {/* User's role */}
            <View className="flex-row items-center mt-2">
              {userRole === 'admin' ? (
                <View className="flex-row items-center bg-amber-500/20 px-2 py-0.5 rounded-full">
                  <Shield size={11} color="#f59e0b" />
                  <Text className="text-amber-400 text-xs font-medium ml-1">Admin</Text>
                </View>
              ) : userRole === 'captain' ? (
                <View className="flex-row items-center bg-cyan-500/20 px-2 py-0.5 rounded-full">
                  <Star size={11} color="#67e8f9" />
                  <Text className="text-cyan-400 text-xs font-medium ml-1">Captain</Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-slate-700/50 px-2 py-0.5 rounded-full">
                  <Text className="text-slate-400 text-xs font-medium">Player</Text>
                </View>
              )}
            </View>
          </View>

          {/* Arrow */}
          <ChevronRight size={24} color="#94a3b8" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SelectTeamScreen() {
  const router = useRouter();
  const teams = useTeamStore((s) => s.teams);
  const pendingTeamIds = useTeamStore((s) => s.pendingTeamIds);
  const userEmail = useTeamStore((s) => s.userEmail);
  const userPhone = useTeamStore((s) => s.userPhone);
  const switchTeam = useTeamStore((s) => s.switchTeam);
  const setIsLoggedIn = useTeamStore((s) => s.setIsLoggedIn);

  // Get teams the user belongs to (either from pending selection or all user teams)
  const userTeams = pendingTeamIds
    ? teams.filter((t) => pendingTeamIds.includes(t.id))
    : teams.filter((team) =>
        team.players.length === 0 // players not yet loaded — trust the teams array
          ? true
          : team.players.some(
              (p) =>
                (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
                (userPhone && p.phone?.replace(/\D/g, '') === userPhone?.replace(/\D/g, ''))
            )
      );

  // Get user's role in each team
  const getUserRole = (team: Team): string => {
    const player = team.players.find(
      (p) =>
        (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
        (userPhone && p.phone?.replace(/\D/g, '') === userPhone?.replace(/\D/g, ''))
    );
    if (player?.roles?.includes('admin')) return 'admin';
    if (player?.roles?.includes('captain')) return 'captain';
    return 'player';
  };

  const handleSelectTeam = (teamId: string) => {
    switchTeam(teamId);
    setIsLoggedIn(true);
    router.replace('/(tabs)');
  };

  const handleCreateNewTeam = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/create-team');
  };

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0c4a6e', '#0f172a', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1">
        {/* Header */}
        <Animated.View
          entering={FadeInUp.delay(50).springify()}
          className="items-center pt-8 pb-6"
        >
          <View className="w-20 h-20 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
            <Users size={40} color="#67e8f9" />
          </View>
          <Text className="text-white text-2xl font-bold mb-2">Select a Team</Text>
          <Text className="text-slate-400 text-base text-center px-8">
            You belong to multiple teams. Choose which one to view.
          </Text>
        </Animated.View>

        {/* Team List */}
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {userTeams.map((team, index) => (
            <TeamCard
              key={team.id}
              team={team}
              userRole={getUserRole(team)}
              index={index}
              onSelect={() => handleSelectTeam(team.id)}
            />
          ))}

          {/* Create New Team Button */}
          <Animated.View entering={FadeInDown.delay(100 + userTeams.length * 80).springify()}>
            <Pressable
              onPress={handleCreateNewTeam}
              className="bg-cyan-500/10 rounded-2xl p-4 border-2 border-dashed border-cyan-500/40 active:bg-cyan-500/20"
            >
              <View className="flex-row items-center justify-center">
                <View className="w-10 h-10 rounded-full bg-cyan-500/20 items-center justify-center mr-3">
                  <Plus size={20} color="#67e8f9" />
                </View>
                <Text className="text-cyan-400 font-semibold text-base">Create New Team</Text>
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
