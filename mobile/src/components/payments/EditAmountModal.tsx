import { View, Text, Pressable, TextInput, ScrollView, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { X, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';
import { format, parseISO } from 'date-fns';
import { pushPaymentPeriodToSupabase } from '@/lib/realtime-sync';

interface EditAmountModalProps {
  visible: boolean;
  onClose: () => void;
  periodId: string | null;
}

export function EditAmountModal({ visible, onClose, periodId }: EditAmountModalProps) {
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const updatePaymentPeriod = useTeamStore((s) => s.updatePaymentPeriod);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const period = paymentPeriods.find((p) => p.id === periodId);

  const [editPeriodAmount, setEditPeriodAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState<Date | null>(null);
  const [showEditDueDatePicker, setShowEditDueDatePicker] = useState(false);

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
    if (period) {
      setEditPeriodAmount(period.amount.toString());
      setEditDueDate(period.dueDate ? parseISO(period.dueDate) : null);
    }
  };

  const handleSave = () => {
    if (!periodId || !editPeriodAmount.trim()) return;
    const amount = parseFloat(editPeriodAmount);
    if (isNaN(amount) || amount <= 0) return;

    updatePaymentPeriodAndSync(periodId, {
      amount,
      dueDate: editDueDate ? editDueDate.toISOString() : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  };

  const handleClose = () => {
    setEditPeriodAmount('');
    setEditDueDate(null);
    setShowEditDueDatePicker(false);
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
            <Text className="text-white text-lg font-semibold">Edit Period</Text>
            <Pressable onPress={handleSave}>
              <Text className="text-cyan-400 font-semibold">Save</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 pt-6">
            {/* Amount */}
            <View className="mb-6">
              <Text className="text-slate-400 text-sm mb-2">Amount per Player ($)</Text>
              <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3">
                <Text className="text-white text-2xl font-bold mr-1">$</Text>
                <TextInput
                  value={editPeriodAmount}
                  onChangeText={setEditPeriodAmount}
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  className="flex-1 text-white text-2xl font-bold"
                />
              </View>
              <Text className="text-slate-500 text-xs mt-2">
                This will update the amount due for all players in this period.
              </Text>
            </View>

            {/* Due Date */}
            <View className="mb-6">
              <Text className="text-slate-400 text-sm mb-2">Due Date</Text>
              <Pressable
                onPress={() => {
                  if (!editDueDate) {
                    setEditDueDate(new Date());
                  }
                  setShowEditDueDatePicker(!showEditDueDatePicker);
                }}
                className="flex-row items-center justify-between bg-slate-800 rounded-xl px-4 py-3"
              >
                <View className="flex-row items-center">
                  <Calendar size={20} color="#64748b" />
                  <Text className={editDueDate ? "text-white ml-3 text-lg" : "text-slate-500 ml-3 text-lg"}>
                    {editDueDate ? format(editDueDate, 'MMMM d, yyyy') : 'No due date'}
                  </Text>
                </View>
                {editDueDate && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setEditDueDate(null);
                      setShowEditDueDatePicker(false);
                    }}
                    className="p-1"
                  >
                    <X size={18} color="#64748b" />
                  </Pressable>
                )}
              </Pressable>
              {showEditDueDatePicker && (
                <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                  <DateTimePicker
                    value={editDueDate || new Date()}
                    mode="date"
                    display="inline"
                    onChange={(event, date) => {
                      if (date) setEditDueDate(date);
                      if (Platform.OS === 'android') setShowEditDueDatePicker(false);
                    }}
                    themeVariant="dark"
                    accentColor="#22c55e"
                  />
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
