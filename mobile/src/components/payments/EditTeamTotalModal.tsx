import { View, Text, Pressable, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';
import { pushPaymentPeriodToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface EditTeamTotalModalProps {
  visible: boolean;
  onClose: () => void;
  periodId: string | null;
}

export function EditTeamTotalModal({ visible, onClose, periodId }: EditTeamTotalModalProps) {
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const updatePaymentPeriod = useTeamStore((s) => s.updatePaymentPeriod);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const [editTeamTotalAmount, setEditTeamTotalAmount] = useState('');

  // Wrapper: updates locally AND pushes to Supabase
  const updatePaymentPeriodAndSync = (pid: string, updates: Parameters<typeof updatePaymentPeriod>[1]) => {
    updatePaymentPeriod(pid, updates);
    if (activeTeamId) {
      const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === pid);
      if (updated) {
        pushPaymentPeriodToSupabase({ ...updated, ...updates }, activeTeamId).catch(syncError('sync'));
      }
    }
  };

  const handleOpen = () => {
    const period = paymentPeriods.find((p) => p.id === periodId);
    setEditTeamTotalAmount(period?.teamTotalOwed?.toString() || '');
  };

  const handleSave = () => {
    if (!periodId) return;

    if (!editTeamTotalAmount.trim()) {
      // Allow clearing the amount
      updatePaymentPeriodAndSync(periodId, { teamTotalOwed: undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
      return;
    }
    const amount = parseFloat(editTeamTotalAmount);
    if (isNaN(amount) || amount < 0) return;

    updatePaymentPeriodAndSync(periodId, { teamTotalOwed: amount });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  };

  const handleClose = () => {
    setEditTeamTotalAmount('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      onShow={handleOpen}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={handleClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Team Total Owed</Text>
            <Pressable onPress={handleSave}>
              <Text className="text-cyan-400 font-semibold">Save</Text>
            </Pressable>
          </View>

          <View className="px-5 pt-6">
            <Text className="text-slate-400 text-sm mb-2">Total Amount ($)</Text>
            <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3">
              <Text className="text-white text-2xl font-bold mr-1">$</Text>
              <TextInput
                value={editTeamTotalAmount}
                onChangeText={setEditTeamTotalAmount}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
                autoFocus
                className="flex-1 text-white text-2xl font-bold"
              />
            </View>
            <Text className="text-slate-500 text-sm mt-3">
              Enter the total amount owed by the team for this payment period. Player payments will automatically subtract from this total. Leave empty to clear.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
