import { View, Text, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Users } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { useTeamStore, getPlayerName, AppNotification } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { pushGameToSupabase, pushGameResponseToSupabase, pushNotificationToSupabase } from '@/lib/realtime-sync';
import { sendPushToPlayers } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

interface InvitePlayersModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
}

export function InvitePlayersModal({ visible, onClose, gameId }: InvitePlayersModalProps) {
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const updateGame = useTeamStore((s) => s.updateGame);
  const addNotification = useTeamStore((s) => s.addNotification);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  const game = games.find((g) => g.id === gameId);

  // Build eligible players
  const isCoachOrParent = (p: typeof players[0]) =>
    p.position === 'Coach' || p.position === 'Parent' ||
    p.roles?.includes('coach') || p.roles?.includes('parent');
  const uniquePlayers = players.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);
  const eligiblePlayers = uniquePlayers.filter((p) => !isCoachOrParent(p));
  const uninvitedPlayers = game ? eligiblePlayers.filter((p) => !game.invitedPlayers?.includes(p.id)) : [];
  const uninvitedActive = uninvitedPlayers.filter((p) => p.status === 'active');
  const uninvitedReserve = uninvitedPlayers.filter((p) => p.status === 'reserve');

  const updateGameAndSync = (updates: Parameters<typeof updateGame>[1]) => {
    if (!game) return;
    updateGame(game.id, updates);
    if (activeTeamId) {
      const currentGame = useTeamStore.getState().games.find((g) => g.id === gameId);
      if (currentGame) {
        pushGameToSupabase({ ...currentGame, ...updates } as any, activeTeamId).catch(console.error);
      }
    }
  };

  // Get jersey color name for notifications
  const getJerseyColorName = () => {
    if (!game) return '';
    const safeJerseyColor = game.jerseyColor ?? '#1a1a1a';
    const jerseyColorInfo = teamSettings.jerseyColors.find((c) => c.name === safeJerseyColor || c.color === safeJerseyColor);
    return jerseyColorInfo?.name || safeJerseyColor;
  };

  const handleInvitePlayer = async (playerId: string, sendNotificationFlag: boolean = true) => {
    if (!game) return;
    const currentInvited = game.invitedPlayers ?? [];
    if (currentInvited.includes(playerId)) return;

    updateGameAndSync({
      invitedPlayers: [...currentInvited, playerId],
    });

    if (activeTeamId) pushGameResponseToSupabase(game.id, playerId, 'invited').catch(console.error);

    if (sendNotificationFlag) {
      const jerseyColorName = getJerseyColorName();
      const gameDate = parseISO(game.date);
      const dateStr = format(gameDate, 'EEEE, MMMM d');
      const title = 'Game Invite';
      const message = `You're invited to play vs ${game.opponent} on ${dateStr} at ${game.time}. Wear your ${jerseyColorName} jersey!`;

      if (playerId === currentPlayerId) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body: message,
              data: { gameId: game.id, type: 'game_invite' },
              sound: true,
              ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
            },
            trigger: null,
          });
        } catch (error) {
          console.log('Could not send push notification:', error);
        }
      }

      sendPushToPlayers([playerId], title, message, { gameId: game.id, type: 'game_invite' }).catch(console.error);

      const notification: AppNotification = {
        id: `${Date.now()}-${playerId}`,
        type: 'game_invite',
        title,
        message,
        gameId: game.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: playerId,
        createdAt: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleInviteMultiplePlayers = async (playerIds: string[]) => {
    if (!game) return;
    const currentInvited = game.invitedPlayers ?? [];
    const newInvites = playerIds.filter((id) => !currentInvited.includes(id));
    if (newInvites.length === 0) return;

    updateGameAndSync({
      invitedPlayers: [...currentInvited, ...newInvites],
    });

    if (activeTeamId) {
      newInvites.forEach((id) => pushGameResponseToSupabase(game.id, id, 'invited').catch(console.error));
    }

    const jerseyColorName = getJerseyColorName();
    const gameDate = parseISO(game.date);
    const dateStr = format(gameDate, 'EEEE, MMMM d');
    const title = 'Game Invite';
    const message = `You're invited to play vs ${game.opponent} on ${dateStr} at ${game.time}. Wear your ${jerseyColorName} jersey!`;

    if (currentPlayerId && newInvites.includes(currentPlayerId)) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: message,
            data: { gameId: game.id, type: 'game_invite' },
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
          },
          trigger: null,
        });
      } catch (error) {
        console.log('Could not send push notification:', error);
      }
    }

    sendPushToPlayers(newInvites, title, message, { gameId: game.id, type: 'game_invite' }).catch(console.error);

    newInvites.forEach((playerId) => {
      const notification: AppNotification = {
        id: `${Date.now()}-${playerId}`,
        type: 'game_invite',
        title,
        message,
        gameId: game.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: playerId,
        createdAt: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Invites Sent', `${newInvites.length} player${newInvites.length !== 1 ? 's' : ''} invited!`);
    onClose();
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Invite Players</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView className="flex-1 px-5 pt-6">
            {uninvitedPlayers.length === 0 ? (
              <View className="items-center py-8">
                <Users size={48} color="#64748b" />
                <Text className="text-slate-400 text-center mt-4">
                  All players have been invited
                </Text>
              </View>
            ) : (
              <>
                {/* Quick Actions */}
                <View className="flex-row mb-4">
                  {uninvitedActive.length > 0 && (
                    <Pressable
                      onPress={() => handleInviteMultiplePlayers(uninvitedActive.map((p) => p.id))}
                      className="flex-1 py-3 rounded-xl mr-2 bg-green-500/20 border border-green-500/50 items-center"
                    >
                      <Text className="text-green-400 font-medium">
                        Invite All Active ({uninvitedActive.length})
                      </Text>
                    </Pressable>
                  )}
                  {uninvitedReserve.length > 0 && (
                    <Pressable
                      onPress={() => handleInviteMultiplePlayers(uninvitedReserve.map((p) => p.id))}
                      className="flex-1 py-3 rounded-xl bg-amber-500/20 border border-amber-500/50 items-center"
                    >
                      <Text className="text-amber-400 font-medium">
                        Invite All Reserve ({uninvitedReserve.length})
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Uninvited Active Players */}
                {uninvitedActive.length > 0 && (
                  <>
                    <Text className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">
                      Active Players
                    </Text>
                    {uninvitedActive.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() => handleInvitePlayer(player.id)}
                        className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50 active:bg-slate-700/80"
                      >
                        <PlayerAvatar player={player} size={44} />
                        <View className="flex-1 ml-3">
                          <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                          <Text className="text-slate-400 text-sm">#{player.number}</Text>
                        </View>
                        <View className="bg-cyan-500 rounded-lg px-3 py-1.5">
                          <Text className="text-white font-medium text-sm">Invite</Text>
                        </View>
                      </Pressable>
                    ))}
                  </>
                )}

                {/* Uninvited Reserve Players */}
                {uninvitedReserve.length > 0 && (
                  <>
                    <Text className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-4">
                      Reserve Players
                    </Text>
                    {uninvitedReserve.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() => handleInvitePlayer(player.id)}
                        className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50 active:bg-slate-700/80"
                      >
                        <PlayerAvatar player={player} size={44} />
                        <View className="flex-1 ml-3">
                          <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                          <Text className="text-slate-400 text-sm">#{player.number}</Text>
                        </View>
                        <View className="bg-cyan-500 rounded-lg px-3 py-1.5">
                          <Text className="text-white font-medium text-sm">Invite</Text>
                        </View>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
