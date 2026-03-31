import { View, Text, ScrollView, Modal, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, BarChart3, Trophy, Edit3 } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTeamStore } from '@/lib/store';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface TeamStatsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TeamStatsModal({ visible, onClose }: TeamStatsModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
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
            <Text className="text-white text-lg font-bold">Team Stats</Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
            <Text className="text-slate-400 text-sm mb-6">
              Configure team and player statistics tracking.
            </Text>

            {/* Use Team Stats */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <BarChart3 size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Use Team Stats</Text>
                    <Text className="text-slate-400 text-sm">
                      Track player and team statistics
                    </Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showTeamStats !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showTeamStats: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Sub-options - only show when Use Team Stats is ON */}
            {teamSettings.showTeamStats !== false && (
              <>
                {/* Team Records */}
                <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="bg-amber-500/10 p-2 rounded-full">
                        <Trophy size={18} color="#f59e0b" />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-white font-semibold">Team Records</Text>
                        <Text className="text-slate-400 text-sm">
                          Show all-time team records and leaders
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={teamSettings.showTeamRecords === true}
                      onValueChange={(value) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTeamSettingsAndSync({ showTeamRecords: value });
                      }}
                      trackColor={{ false: '#334155', true: '#22c55e' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>

                {/* Allow Players */}
                <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="bg-emerald-500/10 p-2 rounded-full">
                        <Edit3 size={18} color="#059669" />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-white font-semibold">Allow Players to Manage Own Stats</Text>
                        <Text className="text-slate-400 text-sm">
                          Players can update their game stats
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={teamSettings.allowPlayerSelfStats === true}
                      onValueChange={(value) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTeamSettingsAndSync({ allowPlayerSelfStats: value });
                      }}
                      trackColor={{ false: '#334155', true: '#22c55e' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
