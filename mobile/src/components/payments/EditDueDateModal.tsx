import { View, Text, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { X, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';
import { parseISO } from 'date-fns';
import { pushPaymentPeriodToSupabase } from '@/lib/realtime-sync';

interface EditDueDateModalProps {
  visible: boolean;
  onClose: () => void;
  periodId: string | null;
}

export function EditDueDateModal({ visible, onClose, periodId }: EditDueDateModalProps) {
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const updatePaymentPeriod = useTeamStore((s) => s.updatePaymentPeriod);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const [editDueDate, setEditDueDate] = useState<Date | null>(null);

  // Wrapper: updates locally AND pushes to Supabase
  const updatePaymentPeriodAndSync = (pid: string, updates: Parameters<typeof updatePaymentPeriod>[1]) => {
    updatePaymentPeriod(pid, updates);
    if (activeTeamId) {
      const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === pid);
      if (updated) {
        pushPaymentPeriodToSupabase({ ...updated, ...updates }, activeTeamId).catch(console.error);
      }
    }
  };

  const handleOpen = () => {
    const period = paymentPeriods.find((p) => p.id === periodId);
    setEditDueDate(period?.dueDate ? parseISO(period.dueDate) : new Date());
  };

  const handleSave = () => {
    if (periodId) {
      updatePaymentPeriodAndSync(periodId, {
        dueDate: editDueDate ? editDueDate.toISOString() : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    handleClose();
  };

  const handleClose = () => {
    setEditDueDate(null);
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
            <Text className="text-white text-lg font-semibold">Due Date</Text>
            <Pressable onPress={handleSave}>
              <Text className="text-cyan-400 font-semibold">Save</Text>
            </Pressable>
          </View>

          <View className="px-5 pt-6">
            {editDueDate ? (
              <>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-slate-400 text-sm">Select Due Date</Text>
                  <Pressable
                    onPress={() => setEditDueDate(null)}
                    className="px-3 py-1.5 bg-slate-800 rounded-lg"
                  >
                    <Text className="text-slate-400 text-sm">Clear</Text>
                  </Pressable>
                </View>
                <View className="bg-slate-800 rounded-xl overflow-hidden items-center">
                  <DateTimePicker
                    value={editDueDate}
                    mode="date"
                    display="inline"
                    onChange={(event, date) => {
                      if (date) setEditDueDate(date);
                    }}
                    themeVariant="dark"
                    accentColor="#22c55e"
                  />
                </View>
              </>
            ) : (
              <View className="items-center py-12">
                <Calendar size={48} color="#64748b" />
                <Text className="text-slate-400 text-center mt-4">No due date set</Text>
                <Pressable
                  onPress={() => setEditDueDate(new Date())}
                  className="mt-4 bg-cyan-500 rounded-xl px-6 py-3"
                >
                  <Text className="text-white font-semibold">Set Due Date</Text>
                </Pressable>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
