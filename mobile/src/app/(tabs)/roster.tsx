import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore, Player, getPlayerName } from '@/lib/store';
import { useResponsive } from '@/lib/useResponsive';
import { PlayerStatRow } from '@/components/roster/PlayerStatRow';
import { PlayerEditModal } from '@/components/roster/PlayerEditModal';

export default function RosterScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const canEditPlayers = useTeamStore((s) => s.canEditPlayers);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const showTeamStats = teamSettings.showTeamStats !== false;
  const allowPlayerSelfStats = teamSettings.allowPlayerSelfStats === true;

  // Responsive layout for iPad
  const { isTablet, columns, containerPadding } = useResponsive();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const openAddModal = () => {
    if (!canEditPlayers()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setEditingPlayerId(null);
    setIsModalVisible(true);
  };

  const openEditModal = (player: Player) => {
    if (!canEditPlayers()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setEditingPlayerId(player.id);
    setIsModalVisible(true);
  };

  // Handle player card press - either edit player or go to stats
  const handlePlayerPress = (player: Player) => {
    const isOwnProfile = player.id === currentPlayerId;
    const canEdit = canEditPlayers();

    // If admin/coach, open edit modal
    if (canEdit) {
      openEditModal(player);
      return;
    }

    // If it's their own profile and self-stats is enabled, go to team stats
    if (isOwnProfile && allowPlayerSelfStats && showTeamStats) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/team-stats');
      return;
    }

    // Otherwise, no action (or could show a read-only profile in the future)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Group players by position type based on sport
  const getPositionGroups = () => {
    const sport = teamSettings.sport;

    // Players whose position doesn't match the current sport get shown in a catch-all group
    const allMatchedIds = new Set<string>();

    let groups: { title: string; players: Player[] }[] = [];

    if (sport === 'hockey') {
      groups = [
        { title: 'Forwards', players: players.filter((p) => ['C', 'LW', 'RW'].includes(p.position)) },
        { title: 'Defense', players: players.filter((p) => ['LD', 'RD'].includes(p.position)) },
        { title: 'Goalies', players: players.filter((p) => p.position === 'G') },
      ];
    } else if (sport === 'baseball' || sport === 'softball') {
      groups = [
        { title: 'Battery', players: players.filter((p) => ['P', 'C'].includes(p.position)) },
        { title: 'Infield', players: players.filter((p) => ['1B', '2B', '3B', 'SS'].includes(p.position)) },
        { title: 'Outfield', players: players.filter((p) => ['LF', 'RF', 'CF'].includes(p.position)) },
      ];
    } else if (sport === 'basketball') {
      groups = [
        { title: 'Guards', players: players.filter((p) => ['PG', 'SG'].includes(p.position)) },
        { title: 'Forwards', players: players.filter((p) => ['SF', 'PF'].includes(p.position)) },
        { title: 'Centers', players: players.filter((p) => p.position === 'C') },
      ];
    } else if (sport === 'lacrosse') {
      groups = [
        { title: 'Attack', players: players.filter((p) => p.position === 'A') },
        { title: 'Midfield', players: players.filter((p) => p.position === 'M') },
        { title: 'Defense', players: players.filter((p) => p.position === 'D') },
        { title: 'Goalies', players: players.filter((p) => p.position === 'G') },
      ];
    } else if (sport === 'soccer') {
      groups = [
        { title: 'Goalkeepers', players: players.filter((p) => p.position === 'GK') },
        { title: 'Defenders', players: players.filter((p) => p.position === 'DEF') },
        { title: 'Midfielders', players: players.filter((p) => p.position === 'MID') },
        { title: 'Forwards', players: players.filter((p) => p.position === 'FWD') },
      ];
    } else {
      return [{ title: 'Players', players: players }];
    }

    // Collect all player IDs that were matched into a group
    for (const group of groups) {
      for (const p of group.players) allMatchedIds.add(p.id);
    }

    // Also exclude coaches and parents from the unmatched group
    const unmatched = players.filter(
      (p) => !allMatchedIds.has(p.id) && p.position !== 'Coach' && p.position !== 'Parent'
    );
    if (unmatched.length > 0) {
      groups.push({ title: 'Players', players: unmatched });
    }

    // Coaches and parents always shown at the bottom
    const coaches = players.filter((p) => p.position === 'Coach' || p.roles?.includes('coach'));
    const parents = players.filter((p) => p.position === 'Parent' || p.roles?.includes('parent'));

    const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
    const coachRoleEnabled = enabledRoles.includes('coach');
    const parentRoleEnabled = enabledRoles.includes('parent');

    if (coachRoleEnabled && coaches.length > 0) groups.push({ title: 'Coaches', players: coaches });
    if (parentRoleEnabled && parents.length > 0) groups.push({ title: 'Parents/Guardians', players: parents });

    return groups;
  };

  const positionGroups = getPositionGroups();

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
          className="px-5 pt-2 pb-4"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{teamName} Roster</Text>
            {canEditPlayers() && (
              <Pressable
                onPress={openAddModal}
              >
                <UserPlus size={24} color="#22c55e" />
              </Pressable>
            )}
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
          {positionGroups.map((group) => {
            if (group.players.length === 0) return null;

            return (
              <View key={group.title} className="mb-3">
                <View className="flex-row items-center mb-1.5">
                  <Text className="text-cyan-300 font-bold text-base">
                    {group.title} ({group.players.length})
                  </Text>
                </View>
                {/* Use grid layout on iPad */}
                <View className={isTablet && columns >= 2 ? 'flex-row flex-wrap' : ''} style={isTablet && columns >= 2 ? { marginHorizontal: -6 } : undefined}>
                  {group.players.map((player, index) => (
                    <View
                      key={player.id}
                      style={isTablet && columns >= 2 ? {
                        width: columns >= 3 ? '33.33%' : '50%',
                        paddingHorizontal: 6
                      } : undefined}
                    >
                      <PlayerStatRow
                        player={player}
                        index={index}
                        onPress={() => handlePlayerPress(player)}
                        showStats={showTeamStats}
                        isCurrentUser={player.id === currentPlayerId}
                        canEditOwnStats={allowPlayerSelfStats && !canEditPlayers()}
                        associatedPlayerName={
                          player.associatedPlayerId
                            ? (() => {
                                const linked = players.find((p) => p.id === player.associatedPlayerId);
                                return linked ? getPlayerName(linked) : undefined;
                              })()
                            : undefined
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Add/Edit Player Modal */}
      <PlayerEditModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        playerId={editingPlayerId}
      />
    </View>
  );
}
