import { View, Text, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Send, Bell, BellOff } from 'lucide-react-native';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTeamStore, InviteReleaseOption, AppNotification } from '@/lib/store';
import { pushGameToSupabase, pushNotificationToSupabase } from '@/lib/realtime-sync';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import { syncError } from '@/lib/sync-error-handler';

interface ReleaseInvitesModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
}

export function ReleaseInvitesModal({ visible, onClose, gameId }: ReleaseInvitesModalProps) {
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const updateGame = useTeamStore((s) => s.updateGame);
  const addNotification = useTeamStore((s) => s.addNotification);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  const game = games.find((g) => g.id === gameId);

  // Internal state
  const [editInviteReleaseOption, setEditInviteReleaseOption] = useState<InviteReleaseOption>('now');
  const [editInviteReleaseDate, setEditInviteReleaseDate] = useState<Date>(new Date());
  const [showEditInviteReleaseDatePicker, setShowEditInviteReleaseDatePicker] = useState(false);

  const handleShow = () => {
    if (!game) return;
    setEditInviteReleaseOption(game.inviteReleaseOption || 'now');
    setEditInviteReleaseDate(game.inviteReleaseDate ? parseISO(game.inviteReleaseDate) : new Date());
    setShowEditInviteReleaseDatePicker(false);
  };

  const updateGameAndSync = (updates: Parameters<typeof updateGame>[1]) => {
    if (!game) return;
    updateGame(game.id, updates);
    if (activeTeamId) {
      const currentGame = useTeamStore.getState().games.find((g) => g.id === gameId);
      if (currentGame) {
        pushGameToSupabase({ ...currentGame, ...updates } as any, activeTeamId).catch(syncError('sync'));
      }
    }
  };

  const handleSaveReleaseInvites = () => {
    if (!game) return;

    updateGameAndSync({
      inviteReleaseOption: editInviteReleaseOption,
      inviteReleaseDate: editInviteReleaseOption === 'scheduled' ? editInviteReleaseDate.toISOString() : undefined,
      invitesSent: editInviteReleaseOption === 'now' ? true : game.invitesSent,
    });

    // Build invited players list (excluding coaches/parents)
    const isCoachOrParent = (p: typeof players[0]) =>
      p.position === 'Coach' || p.position === 'Parent' ||
      p.roles?.includes('coach') || p.roles?.includes('parent');
    const eligiblePlayers = players.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx && !isCoachOrParent(p));
    const invitedPlayers = eligiblePlayers.filter((p) => game.invitedPlayers?.includes(p.id));

    // Get jersey color name for notifications
    const safeJerseyColor = game.jerseyColor ?? '#1a1a1a';
    const jerseyColorInfo = teamSettings.jerseyColors.find((c) => c.name === safeJerseyColor || c.color === safeJerseyColor);
    const jerseyColorName = jerseyColorInfo?.name || safeJerseyColor;

    // If releasing now, send notifications
    if (editInviteReleaseOption === 'now' && !game.invitesSent) {
      const dateStr = format(parseISO(game.date), 'EEE, MMM d');
      invitedPlayers.forEach((player) => {
        const notification: AppNotification = {
          id: `game-invite-${game.id}-${player.id}-${Date.now()}`,
          type: 'game_invite',
          title: 'Game Invite!',
          message: `You're invited to play vs ${game.opponent} on ${dateStr} at ${game.time}. Wear your ${jerseyColorName} jersey!`,
          gameId: game.id,
          toPlayerId: player.id,
          read: false,
          createdAt: new Date().toISOString(),
        };
        addNotification(notification);
        if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(syncError('sync'));
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Release Invites</Text>
            <Pressable onPress={handleSaveReleaseInvites}>
              <Check size={24} color="#22c55e" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 pt-6">
            <View className="bg-slate-800/50 rounded-xl p-3">
              {/* Release Now Option */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditInviteReleaseOption('now');
                  setShowEditInviteReleaseDatePicker(false);
                }}
                className={cn(
                  'flex-row items-center p-3 rounded-xl mb-2 border',
                  editInviteReleaseOption === 'now'
                    ? 'bg-green-500/20 border-green-500/50'
                    : 'bg-slate-700/50 border-slate-600'
                )}
              >
                <Send size={18} color={editInviteReleaseOption === 'now' ? '#22c55e' : '#64748b'} />
                <View className="ml-3 flex-1">
                  <Text className={cn(
                    'font-medium',
                    editInviteReleaseOption === 'now' ? 'text-green-400' : 'text-slate-400'
                  )}>
                    Release invites now
                  </Text>
                  <Text className="text-slate-500 text-xs mt-0.5">
                    Players will be notified immediately
                  </Text>
                </View>
                {editInviteReleaseOption === 'now' && <Check size={18} color="#22c55e" />}
              </Pressable>

              {/* Schedule Release Option */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditInviteReleaseOption('scheduled');
                  setShowEditInviteReleaseDatePicker(true);
                }}
                className={cn(
                  'flex-row items-center p-3 rounded-xl mb-2 border',
                  editInviteReleaseOption === 'scheduled'
                    ? 'bg-cyan-500/20 border-cyan-500/50'
                    : 'bg-slate-700/50 border-slate-600'
                )}
              >
                <Bell size={18} color={editInviteReleaseOption === 'scheduled' ? '#22d3ee' : '#64748b'} />
                <View className="ml-3 flex-1">
                  <Text className={cn(
                    'font-medium',
                    editInviteReleaseOption === 'scheduled' ? 'text-cyan-400' : 'text-slate-400'
                  )}>
                    Schedule release
                  </Text>
                  <Text className="text-slate-500 text-xs mt-0.5">
                    Choose when to notify players
                  </Text>
                </View>
                {editInviteReleaseOption === 'scheduled' && <Check size={18} color="#22d3ee" />}
              </Pressable>

              {/* Schedule Date/Time Picker */}
              {editInviteReleaseOption === 'scheduled' && (
                <View className="mt-2 mb-2">
                  <Pressable
                    onPress={() => setShowEditInviteReleaseDatePicker(!showEditInviteReleaseDatePicker)}
                    className="bg-slate-700/80 rounded-xl px-4 py-3"
                  >
                    <Text className="text-cyan-400 text-base">
                      {format(editInviteReleaseDate, 'EEE, MMM d, yyyy h:mm a')}
                    </Text>
                  </Pressable>
                  {showEditInviteReleaseDatePicker && (
                    <View className="bg-slate-700/80 rounded-xl mt-2 overflow-hidden items-center">
                      <DateTimePicker
                        value={editInviteReleaseDate}
                        mode="datetime"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={(evt, date) => {
                          if (date) setEditInviteReleaseDate(date);
                          if (Platform.OS === 'android') setShowEditInviteReleaseDatePicker(false);
                        }}
                        minimumDate={new Date()}
                        themeVariant="dark"
                        accentColor="#22d3ee"
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Don't Send Option */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditInviteReleaseOption('none');
                  setShowEditInviteReleaseDatePicker(false);
                }}
                className={cn(
                  'flex-row items-center p-3 rounded-xl border',
                  editInviteReleaseOption === 'none'
                    ? 'bg-slate-600/50 border-slate-500'
                    : 'bg-slate-700/50 border-slate-600'
                )}
              >
                <BellOff size={18} color={editInviteReleaseOption === 'none' ? '#94a3b8' : '#64748b'} />
                <View className="ml-3 flex-1">
                  <Text className={cn(
                    'font-medium',
                    editInviteReleaseOption === 'none' ? 'text-slate-300' : 'text-slate-400'
                  )}>
                    Don't send invites
                  </Text>
                  <Text className="text-slate-500 text-xs mt-0.5">
                    Send manually later
                  </Text>
                </View>
                {editInviteReleaseOption === 'none' && <Check size={18} color="#94a3b8" />}
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
