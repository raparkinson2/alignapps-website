import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Trash2, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTeamStore } from '@/lib/store';
import { cn } from '@/lib/cn';

interface DangerZoneModalsProps {
  dangerMenuVisible: boolean;
  onCloseDangerMenu: () => void;
  eraseDataVisible: boolean;
  onCloseEraseData: () => void;
  deleteTeamVisible: boolean;
  onCloseDeleteTeam: () => void;
  onOpenEraseData: () => void;
  onOpenDeleteTeam: () => void;
}

export function DangerZoneModals({
  dangerMenuVisible,
  onCloseDangerMenu,
  eraseDataVisible,
  onCloseEraseData,
  deleteTeamVisible,
  onCloseDeleteTeam,
  onOpenEraseData,
  onOpenDeleteTeam,
}: DangerZoneModalsProps) {
  const router = useRouter();
  const resetAllData = useTeamStore((s) => s.resetAllData);
  const deleteCurrentTeam = useTeamStore((s) => s.deleteCurrentTeam);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleEraseAllData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onCloseDangerMenu();
    onOpenEraseData();
  };

  const confirmEraseAllData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetAllData();
    onCloseEraseData();
  };

  const cancelEraseAllData = () => {
    onCloseEraseData();
  };

  return (
    <>
      {/* Danger Zone Menu Modal */}
      <Modal
        visible={dangerMenuVisible}
        animationType="slide"
        transparent
        onRequestClose={onCloseDangerMenu}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Danger Zone</Text>
              <Pressable onPress={onCloseDangerMenu} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-6">
                Permanently remove team data. These actions cannot be undone.
              </Text>

              {/* Erase All Data */}
              <Pressable
                onPress={handleEraseAllData}
                className="bg-orange-500/10 rounded-2xl p-4 mb-3 border border-orange-500/30 active:bg-orange-500/20"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-orange-500/20 p-2 rounded-full">
                      <Trash2 size={20} color="#f97316" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-orange-400 font-semibold">Erase All Data</Text>
                      <Text className="text-slate-400 text-sm">
                        Delete all team data and start fresh
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#f97316" />
                </View>
              </Pressable>

              {/* Delete Team */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  onCloseDangerMenu();
                  setDeleteConfirmText('');
                  onOpenDeleteTeam();
                }}
                className="bg-red-900/30 rounded-2xl p-4 mb-3 border border-red-700/50 active:bg-red-900/50"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-red-700/30 p-2 rounded-full">
                      <AlertTriangle size={20} color="#dc2626" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-red-500 font-semibold">Delete Team</Text>
                      <Text className="text-slate-400 text-sm">
                        Permanently delete team and all accounts
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#dc2626" />
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Erase All Data Confirmation Modal */}
      <Modal
        visible={eraseDataVisible}
        animationType="fade"
        transparent
        onRequestClose={cancelEraseAllData}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-red-500/30">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-red-500/20 items-center justify-center mb-4">
                <AlertTriangle size={32} color="#ef4444" />
              </View>
              <Text className="text-white text-xl font-bold text-center">
                Erase All Data?
              </Text>
              <Text className="text-slate-400 text-center mt-2">
                This will permanently delete all players, games, statistics, photos, chat messages, and payment records.
              </Text>
              <Text className="text-red-400 text-center mt-3 font-medium">
                This action cannot be undone.
              </Text>
            </View>

            {/* Buttons */}
            <View>
              <Pressable
                onPress={confirmEraseAllData}
                className="flex-row items-center justify-center bg-red-500 rounded-xl py-4 mb-3 active:bg-red-600"
              >
                <Trash2 size={18} color="white" />
                <Text className="text-white font-semibold ml-2">Erase Everything</Text>
              </Pressable>

              <Pressable
                onPress={cancelEraseAllData}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Team Confirmation Modal */}
      <Modal
        visible={deleteTeamVisible}
        animationType="fade"
        transparent
        onRequestClose={onCloseDeleteTeam}
      >
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-red-700/50">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-red-900/50 items-center justify-center mb-4">
                <AlertTriangle size={40} color="#dc2626" />
              </View>
              <Text className="text-red-500 text-2xl font-bold text-center">
                Delete Team?
              </Text>
              <Text className="text-slate-300 text-center mt-3">
                This is a permanent, irreversible action that will delete:
              </Text>
              <View className="mt-3 w-full">
                <Text className="text-slate-400 text-sm">• All player accounts and profiles</Text>
                <Text className="text-slate-400 text-sm">• All admin accounts</Text>
                <Text className="text-slate-400 text-sm">• All games and schedules</Text>
                <Text className="text-slate-400 text-sm">• All photos and memories</Text>
                <Text className="text-slate-400 text-sm">• All chat messages</Text>
                <Text className="text-slate-400 text-sm">• All payment records</Text>
                <Text className="text-slate-400 text-sm">• All team settings</Text>
              </View>
              <Text className="text-red-400 text-center mt-4 font-semibold">
                This action CANNOT be undone.
              </Text>
            </View>

            {/* Confirmation Input */}
            <View className="mb-4">
              <Text className="text-slate-300 text-center mb-2">
                Type <Text className="text-red-500 font-bold">DELETE</Text> to confirm:
              </Text>
              <TextInput
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="Type DELETE"
                placeholderTextColor="#64748b"
                className="bg-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-semibold"
                autoCapitalize="characters"
              />
            </View>

            {/* Buttons */}
            <View>
              <Pressable
                onPress={() => {
                  if (deleteConfirmText === 'DELETE') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Use deleteCurrentTeam to only delete this team, not all teams
                    deleteCurrentTeam();
                    onCloseDeleteTeam();
                    setDeleteConfirmText('');
                    // Navigate to login screen after deleting team
                    router.replace('/login');
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE'}
                className={cn(
                  'flex-row items-center justify-center rounded-xl py-4 mb-3',
                  deleteConfirmText === 'DELETE'
                    ? 'bg-red-600 active:bg-red-700'
                    : 'bg-slate-600 opacity-50'
                )}
              >
                <Trash2 size={18} color="white" />
                <Text className="text-white font-semibold ml-2">Delete Everything Forever</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onCloseDeleteTeam();
                  setDeleteConfirmText('');
                }}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
