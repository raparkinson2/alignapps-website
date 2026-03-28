import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Pencil, Trash2 } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';

interface GameSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  onOpenEditModal: () => void;
  onDeleteGame: () => void;
}

export function GameSettingsModal({ visible, onClose, gameId, onOpenEditModal, onDeleteGame }: GameSettingsModalProps) {
  const isAdmin = useTeamStore((s) => s.isAdmin);

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
            <Text className="text-white text-lg font-semibold">Game Settings</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView className="flex-1 px-5 pt-6">
            {/* Tip for inline editing */}
            <View className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700/50">
              <Text className="text-slate-400 text-sm">
                Tap any field on the game screen to edit it directly.
              </Text>
            </View>

            {/* Advanced Edit Button */}
            <Pressable
              onPress={onOpenEditModal}
              className="bg-slate-800/60 rounded-xl p-4 mb-4 border border-slate-700/50 active:bg-slate-700/60"
            >
              <View className="flex-row items-center">
                <Pencil size={20} color="#67e8f9" />
                <View className="ml-3">
                  <Text className="text-white font-semibold">Advanced Settings</Text>
                  <Text className="text-slate-400 text-sm">Invite release, notes, refreshment duty</Text>
                </View>
              </View>
            </Pressable>

            {/* Delete Game Button */}
            {isAdmin() && (
              <Pressable
                onPress={onDeleteGame}
                className="bg-red-500/20 rounded-xl p-4 mb-4 border border-red-500/30 active:bg-red-500/30"
              >
                <View className="flex-row items-center">
                  <Trash2 size={20} color="#ef4444" />
                  <View className="ml-3">
                    <Text className="text-red-400 font-semibold">Delete Game</Text>
                    <Text className="text-slate-400 text-sm">Permanently remove this game</Text>
                  </View>
                </View>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
