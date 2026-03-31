import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface TeamSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TeamSettingsModal({ visible, onClose }: TeamSettingsModalProps) {
  const teamName = useTeamStore((s) => s.teamName);
  const setTeamName = useTeamStore((s) => s.setTeamName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  const [editTeamName, setEditTeamName] = useState(teamName);

  // Sync editTeamName when modal opens
  const [lastVisible, setLastVisible] = useState(false);
  if (visible && !lastVisible) {
    setLastVisible(true);
    setEditTeamName(teamName);
  }
  if (!visible && lastVisible) {
    setLastVisible(false);
  }

  const setTeamNameAndSync = (name: string) => {
    setTeamName(name);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, name, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

  const handleSaveTeamName = () => {
    if (!editTeamName.trim()) return;
    setTeamNameAndSync(editTeamName.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

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
            <Text className="text-white text-lg font-bold">Team Settings</Text>
            <View className="flex-row items-center">
              <Pressable onPress={handleSaveTeamName} className="mr-3">
                <Text className="text-cyan-400 font-semibold">Save</Text>
              </Pressable>
              <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
          </View>

          <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Team Name</Text>
              <TextInput
                value={editTeamName}
                onChangeText={setEditTeamName}
                placeholder="Enter team name"
                placeholderTextColor="#64748b"
                autoCapitalize="words"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
