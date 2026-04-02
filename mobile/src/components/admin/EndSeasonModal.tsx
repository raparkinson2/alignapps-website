import { View, Text, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { X, Check, Archive, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';
import { pushTeamToSupabase, pushPlayerToSupabase, deleteAllTeamGamesFromSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface EndSeasonModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EndSeasonModal({ visible, onClose }: EndSeasonModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const archiveAndStartNewSeason = useTeamStore((s) => s.archiveAndStartNewSeason);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamName = useTeamStore((s) => s.teamName);

  const [endSeasonName, setEndSeasonName] = useState(teamSettings.currentSeasonName || '');
  const [endSeasonStep, setEndSeasonStep] = useState<'name' | 'confirm'>('name');

  // Reset when opening
  const [lastVisible, setLastVisible] = useState(false);
  if (visible && !lastVisible) {
    setLastVisible(true);
    setEndSeasonName(teamSettings.currentSeasonName || '');
    setEndSeasonStep('name');
  }
  if (!visible && lastVisible) {
    setLastVisible(false);
  }

  const handleClose = () => {
    setEndSeasonStep('name');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        setEndSeasonStep('name');
        onClose();
      }}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-lg font-bold">End Season</Text>
            <Pressable
              onPress={() => {
                if (endSeasonStep === 'confirm') {
                  setEndSeasonStep('name');
                } else {
                  handleClose();
                }
              }}
              className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
            >
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>

          {endSeasonStep === 'name' ? (
            // Step 1: Enter season name
            <View className="px-5 pt-6">
              <View className="bg-purple-500/10 p-4 rounded-xl mb-6 border border-purple-500/20">
                <View className="flex-row items-center mb-2">
                  <Archive size={20} color="#a78bfa" />
                  <Text className="text-purple-300 font-semibold ml-2">Archive Season</Text>
                </View>
                <Text className="text-slate-400 text-sm">
                  This will save all current player stats and team records to history, then reset everything for a new season.
                </Text>
              </View>

              <Text className="text-slate-400 text-sm mb-2">Season Name</Text>
              <TextInput
                value={endSeasonName}
                onChangeText={setEndSeasonName}
                placeholder="e.g., 2024-2025"
                placeholderTextColor="#64748b"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg mb-6"
                autoFocus
              />

              <Pressable
                onPress={() => {
                  if (endSeasonName.trim()) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEndSeasonStep('confirm');
                  }
                }}
                disabled={!endSeasonName.trim()}
                className={`rounded-xl py-4 items-center ${
                  endSeasonName.trim() ? 'bg-purple-600 active:bg-purple-700' : 'bg-slate-700'
                }`}
              >
                <Text className={`font-semibold ${endSeasonName.trim() ? 'text-white' : 'text-slate-500'}`}>
                  Continue
                </Text>
              </Pressable>
            </View>
          ) : (
            // Step 2: Confirm and archive
            <View className="px-5 pt-6">
              <View className="bg-amber-500/10 p-4 rounded-xl mb-4 border border-amber-500/20">
                <View className="flex-row items-center mb-2">
                  <AlertTriangle size={20} color="#f59e0b" />
                  <Text className="text-amber-300 font-semibold ml-2">Confirm Archive</Text>
                </View>
                <Text className="text-slate-400 text-sm">
                  You are about to archive season "{endSeasonName}" and reset all stats.
                </Text>
              </View>

              <View className="bg-slate-800/60 rounded-xl p-4 mb-4">
                <Text className="text-slate-300 font-medium mb-3">What will happen:</Text>

                <View className="flex-row items-start mb-2">
                  <Check size={16} color="#22c55e" />
                  <Text className="text-slate-400 text-sm ml-2 flex-1">
                    Current team record ({teamSettings.record?.wins ?? 0}-{teamSettings.record?.losses ?? 0}{teamSettings.record?.ties ? `-${teamSettings.record.ties}` : ''}) will be saved
                  </Text>
                </View>

                <View className="flex-row items-start mb-2">
                  <Check size={16} color="#22c55e" />
                  <Text className="text-slate-400 text-sm ml-2 flex-1">
                    All player stats will be archived to history
                  </Text>
                </View>

                <View className="flex-row items-start mb-2">
                  <Check size={16} color="#22c55e" />
                  <Text className="text-slate-400 text-sm ml-2 flex-1">
                    Best season record will be updated if this is better
                  </Text>
                </View>

                <View className="flex-row items-start">
                  <RefreshCw size={16} color="#67e8f9" />
                  <Text className="text-slate-400 text-sm ml-2 flex-1">
                    All stats will be reset to zero for new season
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  const result = archiveAndStartNewSeason(endSeasonName.trim());
                  if (activeTeamId) {
                    const s = useTeamStore.getState();
                    pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings)
                      .catch(syncError('pushTeamToSupabase'));
                    s.players.forEach(p =>
                      pushPlayerToSupabase(p, activeTeamId).catch(syncError('pushPlayerToSupabase'))
                    );
                    deleteAllTeamGamesFromSupabase(activeTeamId)
                      .catch(syncError('deleteAllTeamGamesFromSupabase'));
                  }
                  handleClose();

                  // Show success message
                  Alert.alert(
                    'Season Archived',
                    result.newBestRecord
                      ? `${endSeasonName} has been archived! This season set a new best record.`
                      : `${endSeasonName} has been archived. All stats have been reset for the new season.`,
                    [{ text: 'OK' }]
                  );
                }}
                className="bg-purple-600 rounded-xl py-4 items-center mb-3 active:bg-purple-700"
              >
                <Text className="text-white font-semibold">Archive Season & Reset Stats</Text>
              </Pressable>

              <Pressable
                onPress={() => setEndSeasonStep('name')}
                className="bg-slate-700 rounded-xl py-4 items-center active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Go Back</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
