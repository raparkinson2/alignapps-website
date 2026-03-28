import { View, Text, ScrollView, Pressable, Modal, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, UserPlus } from 'lucide-react-native';
import { useTeamStore, getPlayerName } from '@/lib/store';
import { SwipeablePlayerManageCard } from './AdminPlayerCard';
import { deletePlayerFromSupabase } from '@/lib/realtime-sync';

interface ManageTeamModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenPlayerEdit: (playerId: string) => void;
  onOpenAddPlayer: () => void;
}

export function ManageTeamModal({ visible, onClose, onOpenPlayerEdit, onOpenAddPlayer }: ManageTeamModalProps) {
  const players = useTeamStore((s) => s.players);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-lg font-bold">Manage Team</Text>
            <View className="flex-row items-center">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                  setTimeout(() => {
                    onOpenAddPlayer();
                  }, 300);
                }}
                className="mr-3"
              >
                <UserPlus size={22} color="#22c55e" />
              </Pressable>
              <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
          </View>

          <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {players.map((player, index) => (
              <SwipeablePlayerManageCard
                key={player.id}
                player={player}
                index={index}
                onPress={() => {
                  onClose();
                  setTimeout(() => {
                    onOpenPlayerEdit(player.id);
                  }, 300);
                }}
                isCurrentUser={player.id === currentPlayerId}
                canDelete={player.id !== currentPlayerId}
                onDelete={() => {
                  Alert.alert(
                    'Delete Player',
                    `Are you sure you want to remove ${getPlayerName(player)} from the roster? This cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          removePlayer(player.id);
                          deletePlayerFromSupabase(player.id).catch(console.error);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        },
                      },
                    ]
                  );
                }}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
