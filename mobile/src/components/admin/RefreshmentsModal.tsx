import { View, Text, ScrollView, Modal, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { Beer } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { pushTeamToSupabase } from '@/lib/realtime-sync';

interface RefreshmentsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RefreshmentsModal({ visible, onClose }: RefreshmentsModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
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
            <Text className="text-white text-lg font-bold">Refreshments</Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
            <Text className="text-slate-400 text-sm mb-6">
              Configure refreshment duty assignments for your team.
            </Text>

            {/* Enable Refreshments */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <JuiceBoxIcon size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Enable Refreshment Duty</Text>
                    <Text className="text-slate-400 text-sm">
                      Assign players to bring refreshments
                    </Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showRefreshmentDuty !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showRefreshmentDuty: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* 21+ Beverages - only show when refreshments is enabled */}
            {teamSettings.showRefreshmentDuty !== false && (
              <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-amber-500/10 p-2 rounded-full">
                      <Beer size={18} color="#d97706" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">21+ Beverages</Text>
                      <Text className="text-slate-400 text-sm">
                        Show beer mug icon instead
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={teamSettings.refreshmentDutyIs21Plus === true}
                    onValueChange={(value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTeamSettingsAndSync({ refreshmentDutyIs21Plus: value });
                    }}
                    trackColor={{ false: '#334155', true: '#22c55e' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
