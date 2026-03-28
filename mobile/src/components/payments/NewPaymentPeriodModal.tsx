import { View, Text, Pressable, TextInput, ScrollView, Modal, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { X, Calendar, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useTeamStore, PaymentPeriod, PaymentPeriodType } from '@/lib/store';
import { cn } from '@/lib/cn';
import { format } from 'date-fns';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { getPlayerName } from '@/lib/store';
import { pushPaymentPeriodToSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';

interface NewPaymentPeriodModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NewPaymentPeriodModal({ visible, onClose }: NewPaymentPeriodModalProps) {
  const players = useTeamStore((s) => s.players);
  const addPaymentPeriod = useTeamStore((s) => s.addPaymentPeriod);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  // New period form
  const [periodTitle, setPeriodTitle] = useState('');
  const [periodAmount, setPeriodAmount] = useState('');
  const [periodType, setPeriodType] = useState<PaymentPeriodType>('league_dues');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [periodDueDate, setPeriodDueDate] = useState<Date | null>(null);
  const [showPeriodDueDatePicker, setShowPeriodDueDatePicker] = useState(false);

  const handleCreatePeriod = () => {
    if (!periodTitle.trim() || !periodAmount.trim()) return;
    if (selectedPlayerIds.length === 0) {
      Alert.alert('No Players Selected', 'Please select at least one player for this payment period.');
      return;
    }

    const newPeriod: PaymentPeriod = {
      id: Date.now().toString(),
      title: periodTitle.trim(),
      amount: parseFloat(periodAmount),
      type: periodType,
      dueDate: periodDueDate ? periodDueDate.toISOString() : undefined,
      playerPayments: selectedPlayerIds.map((playerId) => ({
        playerId,
        status: 'unpaid' as const,
        entries: [],
      })),
      createdAt: new Date().toISOString(),
    };

    addPaymentPeriod(newPeriod);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushPaymentPeriodToSupabase(newPeriod, activeTeamId).catch(console.error);
    }

    // Send creation notification to all assigned players via backend
    if (activeTeamId && selectedPlayerIds.length > 0) {
      fetch(`${BACKEND_URL}/api/payments/reminders/on-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: newPeriod.id,
          teamId: activeTeamId,
          playerIds: selectedPlayerIds,
          title: newPeriod.title,
          amount: newPeriod.amount,
          dueDate: newPeriod.dueDate || null,
        }),
      }).catch(console.error);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPeriodTitle('');
    setPeriodAmount('');
    setPeriodType('league_dues');
    setSelectedPlayerIds([]);
    setPeriodDueDate(null);
    setShowPeriodDueDatePicker(false);
    onClose();
  };

  const handleClose = () => {
    setSelectedPlayerIds([]);
    setPeriodDueDate(null);
    setShowPeriodDueDatePicker(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={handleClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">New Payment Period</Text>
            <Pressable onPress={handleCreatePeriod}>
              <Text className="text-cyan-400 font-semibold">Create</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
            {/* Payment Type Selector */}
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Payment Type</Text>
              {/* First row - 4 items */}
              <View className="flex-row gap-2 mb-2">
                {([
                  { value: 'league_dues', label: 'League Dues' },
                  { value: 'substitute', label: 'Substitute' },
                  { value: 'facility_rental', label: 'Facility Rental' },
                  { value: 'equipment', label: 'Equipment' },
                ] as { value: PaymentPeriodType; label: string }[]).map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPeriodType(option.value);
                    }}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl border items-center',
                      periodType === option.value
                        ? 'bg-cyan-500/20 border-cyan-500/50'
                        : 'bg-slate-800 border-slate-700'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-medium text-xs',
                        periodType === option.value ? 'text-cyan-400' : 'text-slate-400'
                      )}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Second row - 3 items */}
              <View className="flex-row gap-2">
                {([
                  { value: 'event', label: 'Event' },
                  { value: 'referee', label: 'Referee' },
                  { value: 'misc', label: 'Misc.' },
                ] as { value: PaymentPeriodType; label: string }[]).map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPeriodType(option.value);
                    }}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl border items-center',
                      periodType === option.value
                        ? 'bg-cyan-500/20 border-cyan-500/50'
                        : 'bg-slate-800 border-slate-700'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-medium text-xs',
                        periodType === option.value ? 'text-cyan-400' : 'text-slate-400'
                      )}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="text-slate-500 text-xs mt-2">
                {periodType === 'league_dues'
                  ? 'Dues track balance remaining until fully paid'
                  : 'This type shows total collected without a balance'}
              </Text>
            </View>

            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Title</Text>
              <TextInput
                value={periodTitle}
                onChangeText={setPeriodTitle}
                placeholder="e.g., Season Dues - Spring 2025"
                placeholderTextColor="#64748b"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
              />
            </View>

            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Amount ($)</Text>
              <TextInput
                value={periodAmount}
                onChangeText={setPeriodAmount}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
              />
            </View>

            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Due Date (optional)</Text>
              <Pressable
                onPress={() => {
                  if (!periodDueDate) {
                    setPeriodDueDate(new Date());
                  }
                  setShowPeriodDueDatePicker(!showPeriodDueDatePicker);
                }}
                className="flex-row items-center justify-between bg-slate-800 rounded-xl px-4 py-3"
              >
                <View className="flex-row items-center">
                  <Calendar size={20} color="#64748b" />
                  <Text className={periodDueDate ? "text-white ml-3" : "text-slate-500 ml-3"}>
                    {periodDueDate ? format(periodDueDate, 'MMM d, yyyy') : 'No due date'}
                  </Text>
                </View>
                {periodDueDate && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setPeriodDueDate(null);
                      setShowPeriodDueDatePicker(false);
                    }}
                    className="p-1"
                  >
                    <X size={18} color="#64748b" />
                  </Pressable>
                )}
              </Pressable>
              {showPeriodDueDatePicker && periodDueDate && (
                <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                  <DateTimePicker
                    value={periodDueDate}
                    mode="date"
                    display="inline"
                    onChange={(event, date) => {
                      if (date) setPeriodDueDate(date);
                      if (Platform.OS === 'android') setShowPeriodDueDatePicker(false);
                    }}
                    themeVariant="dark"
                    accentColor="#22c55e"
                  />
                </View>
              )}
            </View>

            {/* Player Selection */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-slate-400 text-sm">Select Players</Text>
                <Text className="text-cyan-400 text-sm font-medium">
                  {selectedPlayerIds.length} selected
                </Text>
              </View>

              {/* Quick Select Buttons */}
              <View className="flex-row mb-4">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const activeIds = players.filter((p) => p.status === 'active').map((p) => p.id);
                    setSelectedPlayerIds(activeIds);
                  }}
                  className="bg-green-500/20 rounded-xl px-4 py-2 mr-2"
                >
                  <Text className="text-green-400 font-medium">All Active</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const reserveIds = players.filter((p) => p.status === 'reserve').map((p) => p.id);
                    setSelectedPlayerIds(reserveIds);
                  }}
                  className="bg-slate-600/50 rounded-xl px-4 py-2 mr-2"
                >
                  <Text className="text-slate-300 font-medium">All Reserve</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlayerIds(players.map((p) => p.id));
                  }}
                  className="bg-cyan-500/20 rounded-xl px-4 py-2 mr-2"
                >
                  <Text className="text-cyan-400 font-medium">All</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlayerIds([]);
                  }}
                  className="bg-slate-700/50 rounded-xl px-4 py-2"
                >
                  <Text className="text-slate-400 font-medium">None</Text>
                </Pressable>
              </View>

              {/* Player List */}
              {players.map((player) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                  <Pressable
                    key={player.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (isSelected) {
                        setSelectedPlayerIds(selectedPlayerIds.filter((id) => id !== player.id));
                      } else {
                        setSelectedPlayerIds([...selectedPlayerIds, player.id]);
                      }
                    }}
                    className={cn(
                      'flex-row items-center p-3 rounded-xl mb-2 border',
                      isSelected
                        ? 'bg-green-500/20 border-green-500/50'
                        : 'bg-slate-800/60 border-slate-700/50'
                    )}
                  >
                    <PlayerAvatar player={player} size={40} />
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                      <Text className={cn(
                        'text-xs',
                        player.status === 'active' ? 'text-green-400' : 'text-slate-400'
                      )}>
                        {player.status === 'active' ? 'Active' : 'Reserve'} · #{player.number}
                      </Text>
                    </View>
                    <View className={cn(
                      'w-6 h-6 rounded-full border-2 items-center justify-center',
                      isSelected ? 'bg-green-500 border-green-500' : 'border-slate-500'
                    )}>
                      {isSelected && <Check size={14} color="white" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
