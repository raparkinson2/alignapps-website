import { View, Text, Pressable, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTeamStore, TeamRecord, Sport } from '@/lib/store';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

// Format team record based on sport
const formatTeamRecord = (record: TeamRecord | undefined, sport: Sport): string => {
  if (!record) return '';

  switch (sport) {
    case 'hockey':
      // Hockey: W-L-T-OTL
      return `${record.wins}-${record.losses}-${record.ties ?? 0}-${record.otLosses ?? 0}`;
    case 'basketball':
      // Basketball: W-L
      return `${record.wins}-${record.losses}`;
    case 'soccer':
      // Soccer: W-L-T
      return `${record.wins}-${record.losses}-${record.ties ?? 0}`;
    case 'baseball':
      // Baseball: W-L
      return `${record.wins}-${record.losses}`;
    default:
      return `${record.wins}-${record.losses}`;
  }
};

// Get record label based on sport
const getRecordLabel = (sport: Sport): string => {
  switch (sport) {
    case 'hockey':
      return 'W-L-T-OTL';
    case 'basketball':
    case 'baseball':
      return 'W-L';
    case 'soccer':
      return 'W-L-T';
    default:
      return 'W-L';
  }
};

interface EditRecordModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EditRecordModal({ visible, onClose }: EditRecordModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const sport: Sport = teamSettings?.sport ?? 'hockey';

  // Record editing state — initialised from current store values each render so
  // opening the modal always shows the current record (the modal is mounted once,
  // so we derive initial values from props but let the user edit from there).
  const [recordWins, setRecordWins] = useState(teamSettings?.record?.wins?.toString() ?? '0');
  const [recordLosses, setRecordLosses] = useState(teamSettings?.record?.losses?.toString() ?? '0');
  const [recordTies, setRecordTies] = useState(teamSettings?.record?.ties?.toString() ?? '0');
  const [recordOtLosses, setRecordOtLosses] = useState(teamSettings?.record?.otLosses?.toString() ?? '0');

  // Reset fields to current store values whenever the modal becomes visible
  // (mirrors the pattern used in the original screen: setRecord* called right before setIsRecordModalVisible(true))
  const handleOpen = () => {
    setRecordWins(teamSettings?.record?.wins?.toString() ?? '0');
    setRecordLosses(teamSettings?.record?.losses?.toString() ?? '0');
    setRecordTies(teamSettings?.record?.ties?.toString() ?? '0');
    setRecordOtLosses(teamSettings?.record?.otLosses?.toString() ?? '0');
  };

  const handleSave = () => {
    const newRecord: TeamRecord = {
      wins: parseInt(recordWins, 10) || 0,
      losses: parseInt(recordLosses, 10) || 0,
      ties: (sport === 'hockey' || sport === 'soccer') ? (parseInt(recordTies, 10) || 0) : undefined,
      otLosses: sport === 'hockey' ? (parseInt(recordOtLosses, 10) || 0) : undefined,
      // Preserve existing streak and goals values (edited in Stats & Analytics)
      longestWinStreak: teamSettings.record?.longestWinStreak,
      longestLosingStreak: teamSettings.record?.longestLosingStreak,
      teamGoals: teamSettings.record?.teamGoals,
    };
    setTeamSettings({ record: newRecord });
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const handleClear = () => {
    setTeamSettings({ record: undefined });
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Team Record</Text>
            <Pressable onPress={handleSave}>
              <Text className="text-cyan-400 font-semibold">Save</Text>
            </Pressable>
          </View>

          <View className="px-5 pt-6">
            <Text className="text-slate-400 text-sm mb-4">
              Format: {getRecordLabel(sport)}
            </Text>

            <View className="flex-row flex-wrap">
              {/* Wins */}
              <View className="w-1/2 pr-2 mb-4">
                <Text className="text-slate-400 text-sm mb-2">Wins</Text>
                <TextInput
                  value={recordWins}
                  onChangeText={setRecordWins}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                />
              </View>

              {/* Losses */}
              <View className="w-1/2 pl-2 mb-4">
                <Text className="text-slate-400 text-sm mb-2">Losses</Text>
                <TextInput
                  value={recordLosses}
                  onChangeText={setRecordLosses}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                />
              </View>

              {/* Ties (Hockey, Soccer) */}
              {(sport === 'hockey' || sport === 'soccer') && (
                <View className="w-1/2 pr-2 mb-4">
                  <Text className="text-slate-400 text-sm mb-2">Ties</Text>
                  <TextInput
                    value={recordTies}
                    onChangeText={setRecordTies}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                  />
                </View>
              )}

              {/* OT Losses (Hockey only) */}
              {sport === 'hockey' && (
                <View className="w-1/2 pl-2 mb-4">
                  <Text className="text-slate-400 text-sm mb-2">OT Losses</Text>
                  <TextInput
                    value={recordOtLosses}
                    onChangeText={setRecordOtLosses}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-xl text-center font-bold"
                  />
                </View>
              )}
            </View>

            {/* Clear record button */}
            {teamSettings.record && (
              <Pressable
                onPress={handleClear}
                className="mt-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10"
              >
                <Text className="text-red-400 text-center font-medium">Clear Record</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
