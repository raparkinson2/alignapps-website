import {
  View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import {
  X, ChevronLeft, DollarSign, Bell, Plus, Users, Calendar, Edit3, Trash2, ChevronRight, Zap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  useTeamStore,
  PaymentEntry,
  getPlayerName,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { SwipeablePaymentRow } from './SwipeablePaymentRow';
import { calculatePaymentStatus, getDueDateColor } from './paymentUtils';
import { pushPaymentPeriodToSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL, adminHeaders } from '@/lib/config';
import { syncError } from '@/lib/sync-error-handler';

interface PaymentPeriodDetailModalProps {
  visible: boolean;
  onClose: () => void;
  periodId: string | null;
}

export function PaymentPeriodDetailModal({ visible, onClose, periodId }: PaymentPeriodDetailModalProps) {
  const players = useTeamStore((s) => s.players);
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const addPaymentEntry = useTeamStore((s) => s.addPaymentEntry);
  const removePaymentEntry = useTeamStore((s) => s.removePaymentEntry);
  const updatePaymentPeriod = useTeamStore((s) => s.updatePaymentPeriod);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isAddPlayerModalVisible, setIsAddPlayerModalVisible] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Add payment entry form
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(new Date());
  const [newPaymentNote, setNewPaymentNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Inline due-date editing inside the period list view
  const [isEditDueDateVisible, setIsEditDueDateVisible] = useState(false);
  const [editDueDate, setEditDueDate] = useState<Date | null>(null);

  // Inline amount editing inside the period list view
  const [isEditAmountInline, setIsEditAmountInline] = useState(false);
  const [editPeriodAmountInline, setEditPeriodAmountInline] = useState('');

  // Stripe checkout state
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [stripePaymentContext, setStripePaymentContext] = useState<{ periodId: string; playerId: string; amount: number } | null>(null);

  // Fee config from backend — keeps display in sync with actual charges
  const [feeConfig, setFeeConfig] = useState({ platformFeePercent: 1.0, stripeFeePercent: 2.9, stripeFixedFee: 0.30 });
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/payments/fee-config`)
      .then(r => r.json())
      .then((data: { platformFeePercent: number; stripeFeePercent: number; stripeFixedFee: number }) => setFeeConfig(data))
      .catch(() => {}); // silently keep defaults on failure
  }, []);

  const selectedPeriod = paymentPeriods.find((p) => p.id === periodId);
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const selectedPlayerPayment = selectedPeriod?.playerPayments.find((pp) => pp.playerId === selectedPlayerId);

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

  // Launch Stripe Checkout in a WebView modal
  const handleStripePayment = async (pid: string, playerId: string) => {
    if (!selectedPeriod) return;
    const balance = selectedPeriod.amount - (selectedPeriod.playerPayments.find(pp => pp.playerId === playerId)?.amount ?? 0);
    if (balance <= 0) return;

    setIsStripeLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const player = players.find(p => p.id === playerId);

      const res = await fetch(`${BACKEND_URL}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balanceCents: Math.round(balance * 100),
          playerName: player ? getPlayerName(player) : '',
          teamName: teamName ?? '',
          paymentPeriodTitle: selectedPeriod.title,
          paymentPeriodId: selectedPeriod.id,
          playerId,
          successUrl: 'alignsports://payment-success',
          cancelUrl: 'alignsports://payment-cancel',
          teamStripeAccountId: teamSettings?.stripeAccountId ?? undefined,
        }),
      });

      const data = await res.json() as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Could not create checkout session');
      }

      setStripeCheckoutUrl(data.url);
      setStripePaymentContext({ periodId: pid, playerId, amount: balance });
    } catch (err: any) {
      Alert.alert('Payment Error', err?.message ?? 'Could not start Stripe checkout. Please try again.');
    } finally {
      setIsStripeLoading(false);
    }
  };

  const handleAddPaymentEntry = () => {
    if (!periodId || !selectedPlayerId || !newPaymentAmount.trim()) return;
    const amount = parseFloat(newPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const entry: PaymentEntry = {
      id: Date.now().toString(),
      amount,
      date: newPaymentDate.toISOString(),
      note: newPaymentNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    addPaymentEntry(periodId, selectedPlayerId, entry);

    // Sync to Supabase so other team members see the update
    if (activeTeamId) {
      // Use a small delay to let the store update first
      setTimeout(() => {
        const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === periodId);
        if (updated) {
          pushPaymentPeriodToSupabase(updated, activeTeamId).catch(syncError('sync'));
        }
      }, 50);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewPaymentAmount('');
    setNewPaymentNote('');
    setNewPaymentDate(new Date());
  };

  const handleDeletePaymentEntry = (entryId: string) => {
    if (!periodId || !selectedPlayerId) return;
    const periodIdSnapshot = periodId;
    Alert.alert(
      'Delete Payment',
      'Are you sure you want to delete this payment entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removePaymentEntry(periodIdSnapshot, selectedPlayerId, entryId);
            // Sync to Supabase after removal
            if (activeTeamId) {
              setTimeout(() => {
                const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === periodIdSnapshot);
                if (updated) {
                  pushPaymentPeriodToSupabase(updated, activeTeamId).catch(syncError('sync'));
                }
              }, 50);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleAddPlayerToPeriod = (playerId: string) => {
    if (!periodId || !selectedPeriod) return;

    // Check if player already in period
    if (selectedPeriod.playerPayments.some((pp) => pp.playerId === playerId)) {
      return;
    }

    const updatedPayments = [
      ...selectedPeriod.playerPayments,
      {
        playerId,
        status: 'unpaid' as const,
        entries: [],
      },
    ];

    updatePaymentPeriodAndSync(periodId, { playerPayments: updatedPayments });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemovePlayerFromPeriod = (playerId: string) => {
    if (!periodId || !selectedPeriod) return;

    const player = players.find((p) => p.id === playerId);
    const playerPayment = selectedPeriod.playerPayments.find((pp) => pp.playerId === playerId);

    // Warn if player has made payments
    const hasPayments = playerPayment?.entries && playerPayment.entries.length > 0;

    Alert.alert(
      'Remove Player',
      hasPayments
        ? `${getPlayerName(player!)} has payment records. Removing them will delete their payment history for this period. Are you sure?`
        : `Remove ${getPlayerName(player!)} from this payment period?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedPayments = selectedPeriod.playerPayments.filter(
              (pp) => pp.playerId !== playerId
            );
            updatePaymentPeriodAndSync(periodId, { playerPayments: updatedPayments });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleSendManualReminder = async () => {
    if (!activeTeamId || !selectedPeriod) return;
    setIsSendingReminder(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/reminders/send-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ periodId: selectedPeriod.id, teamId: activeTeamId }),
      });
      const data = await res.json() as { message?: string; sent?: number };
      Alert.alert(
        'Reminder Sent',
        data.sent === 0
          ? 'All players have already paid — no reminders were sent.'
          : `Reminder sent to ${data.sent} unpaid player${data.sent !== 1 ? 's' : ''}.`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to send reminder. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Check if current user can view this player's details (admin only for other players)
  const canViewPlayerDetails = (playerId: string) => {
    return isAdmin() || playerId === currentPlayerId;
  };

  // Get players not in current period, excluding coaches and parents/guardians
  const playersNotInPeriod = selectedPeriod
    ? players.filter((p) =>
        !selectedPeriod.playerPayments.some((pp) => pp.playerId === p.id) &&
        !p.roles.some((r) => r === 'coach' || r === 'parent')
      )
    : [];

  const handleClose = () => {
    setSelectedPlayerId(null);
    setIsEditDueDateVisible(false);
    setEditDueDate(null);
    setIsEditAmountInline(false);
    setEditPeriodAmountInline('');
    onClose();
  };

  const handleBackFromPlayer = () => {
    setSelectedPlayerId(null);
  };

  const handleRequestClose = () => {
    if (selectedPlayerId) {
      setSelectedPlayerId(null);
    } else {
      handleClose();
    }
  };

  const stripeReady = !!(teamSettings?.stripeAccountId && teamSettings?.stripeOnboardingComplete);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleRequestClose}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            {/* Show Player Detail View OR Period List */}
            {selectedPlayerId && selectedPlayer && selectedPeriod ? (
              <>
                {/* Player Detail Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                  <Pressable onPress={handleBackFromPlayer} className="flex-row items-center">
                    <ChevronLeft size={24} color="#64748b" />
                    <Text className="text-slate-400 ml-1">Back</Text>
                  </Pressable>
                  <Text className="text-white text-lg font-semibold">Payment Details</Text>
                  <View style={{ width: 60 }} />
                </View>

                <ScrollView className="flex-1 px-5 pt-6">
                  {/* Player Info */}
                  <View className="items-center mb-6">
                    <PlayerAvatar player={selectedPlayer} size={80} />
                    <Text className="text-white text-xl font-bold mt-3">{getPlayerName(selectedPlayer)}</Text>
                    <Text className="text-slate-400">{selectedPeriod.title}</Text>
                  </View>

                  {/* Balance Summary */}
                  {(() => {
                    const isOverdue = selectedPeriod.dueDate &&
                      selectedPlayerPayment?.status !== 'paid' &&
                      differenceInDays(new Date(), parseISO(selectedPeriod.dueDate)) > 0;
                    const daysOverdue = selectedPeriod.dueDate
                      ? Math.max(0, differenceInDays(new Date(), parseISO(selectedPeriod.dueDate)))
                      : 0;
                    const balance = selectedPeriod.amount - (selectedPlayerPayment?.amount ?? 0);

                    return (
                      <View className={cn(
                        'rounded-xl p-4 mb-6',
                        selectedPlayerPayment?.status === 'paid'
                          ? 'bg-green-500/10 border border-green-500/20'
                          : isOverdue
                            ? 'bg-slate-800/50 border-l-4 border-l-red-500'
                            : selectedPlayerPayment?.status === 'partial'
                              ? 'bg-amber-500/10 border border-amber-500/20'
                              : 'bg-slate-800/50 border border-slate-700/50'
                      )}>
                        {/* Overdue Badge */}
                        {isOverdue && (
                          <View className="flex-row items-center justify-between mb-3">
                            <View className="bg-red-500 rounded px-2 py-1">
                              <Text className="text-white text-xs font-semibold">
                                {daysOverdue === 0 ? 'Due Today' : `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`}
                              </Text>
                            </View>
                            {selectedPeriod.dueDate && (
                              <Text className="text-slate-500 text-xs">
                                Due {format(parseISO(selectedPeriod.dueDate), 'MMM d, yyyy')}
                              </Text>
                            )}
                          </View>
                        )}

                        <View className="flex-row justify-between items-center mb-2">
                          <Text className={cn("text-sm", isOverdue ? "text-red-400/70" : "text-slate-500")}>Total Due</Text>
                          <Text className={cn("text-lg font-semibold", isOverdue ? "text-red-400" : "text-white")}>${selectedPeriod.amount}</Text>
                        </View>
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-slate-500 text-sm">Paid</Text>
                          <Text className="text-green-400/90 text-lg font-semibold">${selectedPlayerPayment?.amount ?? 0}</Text>
                        </View>

                        {/* Progress Bar */}
                        <View className="mb-2">
                          <View className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <View
                              className={cn(
                                'h-full rounded-full',
                                selectedPlayerPayment?.status === 'paid'
                                  ? 'bg-green-500'
                                  : isOverdue
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                              )}
                              style={{
                                width: `${selectedPeriod.amount > 0
                                  ? Math.min(100, ((selectedPlayerPayment?.amount ?? 0) / selectedPeriod.amount) * 100)
                                  : 0}%`
                              }}
                            />
                          </View>
                          <Text className="text-slate-600 text-xs text-center mt-1">
                            {selectedPeriod.amount > 0
                              ? Math.round(((selectedPlayerPayment?.amount ?? 0) / selectedPeriod.amount) * 100)
                              : 0}% paid
                          </Text>
                        </View>

                        <View className="h-px bg-slate-700/50 my-2" />
                        <View className="flex-row justify-between items-center">
                          <Text className="text-slate-500 text-sm">Balance</Text>
                          <Text className={cn(
                            'text-lg font-semibold',
                            balance <= 0
                              ? 'text-green-400'
                              : isOverdue
                                ? 'text-red-400'
                                : 'text-amber-400/90'
                          )}>
                            ${Math.max(0, balance).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Stripe Pay Now Button - visible to the player when unpaid/partial */}
                  {selectedPlayerPayment?.status !== 'paid' && stripeReady && (
                    <Pressable
                      onPress={() => handleStripePayment(selectedPeriod.id, selectedPlayerId)}
                      disabled={isStripeLoading}
                      className="mb-6 rounded-2xl overflow-hidden active:opacity-85"
                    >
                      <LinearGradient
                        colors={['#635BFF', '#7A73FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {isStripeLoading ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <>
                            <Zap size={18} color="white" />
                            <Text className="text-white font-bold text-base ml-2">
                              Pay ${(Math.ceil(((Math.max(0, selectedPeriod.amount - (selectedPlayerPayment?.amount ?? 0)) + feeConfig.stripeFixedFee) / (1 - feeConfig.stripeFeePercent / 100 - feeConfig.platformFeePercent / 100)) * 100) / 100).toFixed(2)} with Stripe
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                      {(() => {
                        const balance = Math.max(0, selectedPeriod.amount - (selectedPlayerPayment?.amount ?? 0));
                        const total = Math.ceil(((balance + feeConfig.stripeFixedFee) / (1 - feeConfig.stripeFeePercent / 100 - feeConfig.platformFeePercent / 100)) * 100) / 100;
                        const fee = Math.round((total - balance) * 100) / 100;
                        return (
                          <View style={{ backgroundColor: '#4a44cc', paddingVertical: 6, alignItems: 'center' }}>
                            <Text style={{ color: '#c7c4ff', fontSize: 12 }}>
                              ${balance.toFixed(2)} due + ${fee.toFixed(2)} processing fee
                            </Text>
                          </View>
                        );
                      })()}
                    </Pressable>
                  )}

                  {/* Add Payment Section - Admin Only */}
                  {isAdmin() && (
                    <View className="bg-slate-800/60 rounded-xl p-4 mb-6 border border-slate-700/50">
                      <Text className="text-cyan-400 font-semibold mb-3">Add Payment</Text>

                      {/* Amount and Date on one line */}
                      <View className="flex-row mb-3" style={{ gap: 10 }}>
                        <View className="flex-1">
                          <Text className="text-slate-500 text-xs mb-1.5">Amount</Text>
                          <View className="flex-row items-center bg-slate-700 rounded-lg px-3 py-2.5">
                            <Text className="text-white text-base font-semibold mr-1">$</Text>
                            <TextInput
                              value={newPaymentAmount}
                              onChangeText={setNewPaymentAmount}
                              placeholder="0.00"
                              placeholderTextColor="#64748b"
                              keyboardType="decimal-pad"
                              className="flex-1 text-white text-base font-semibold"
                            />
                          </View>
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-500 text-xs mb-1.5">Date</Text>
                          <Pressable
                            onPress={() => setShowDatePicker(!showDatePicker)}
                            className="flex-row items-center bg-slate-700 rounded-lg px-3 py-2.5"
                          >
                            <Calendar size={16} color="#64748b" />
                            <Text className="text-white text-sm ml-2">{format(newPaymentDate, 'MMM d, yyyy')}</Text>
                          </Pressable>
                        </View>
                      </View>

                      {showDatePicker && (
                        <View className="bg-slate-800 rounded-xl mb-3 overflow-hidden items-center">
                          <DateTimePicker
                            value={newPaymentDate}
                            mode="date"
                            display="inline"
                            onChange={(event, date) => {
                              if (date) setNewPaymentDate(date);
                              if (Platform.OS === 'android') setShowDatePicker(false);
                            }}
                            themeVariant="dark"
                            accentColor="#22c55e"
                          />
                        </View>
                      )}

                      {/* Note Input */}
                      <View className="mb-3">
                        <Text className="text-slate-500 text-xs mb-1.5">Note (optional)</Text>
                        <TextInput
                          value={newPaymentNote}
                          onChangeText={setNewPaymentNote}
                          placeholder="e.g., Venmo payment"
                          placeholderTextColor="#64748b"
                          className="bg-slate-700 rounded-lg px-3 py-2.5 text-white text-sm"
                        />
                      </View>

                      {/* Add Button */}
                      <Pressable
                        onPress={handleAddPaymentEntry}
                        className="bg-green-500 rounded-lg py-2.5 active:bg-green-600"
                      >
                        <Text className="text-white text-center font-semibold text-sm">Add Payment</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Payment History */}
                  <View className="mb-6">
                    <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                      Payment History
                    </Text>

                    {(selectedPlayerPayment?.entries ?? []).length === 0 ? (
                      <View className="bg-slate-800/40 rounded-xl p-6 items-center">
                        <DollarSign size={32} color="#64748b" />
                        <Text className="text-slate-400 mt-2">No payments recorded</Text>
                      </View>
                    ) : (
                      (selectedPlayerPayment?.entries ?? [])
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((entry) => (
                          <View
                            key={entry.id}
                            className="flex-row items-center bg-slate-800/60 rounded-xl p-4 mb-2 border border-slate-700/50"
                          >
                            <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center">
                              <DollarSign size={20} color="#22c55e" />
                            </View>
                            <View className="flex-1 ml-3">
                              <Text className="text-white font-semibold">${entry.amount}</Text>
                              <Text className="text-slate-400 text-sm">
                                {format(parseISO(entry.date), 'MMM d, yyyy')}
                                {entry.note && ` • ${entry.note}`}
                              </Text>
                            </View>
                            {isAdmin() && (
                              <Pressable
                                onPress={() => handleDeletePaymentEntry(entry.id)}
                                className="p-2"
                              >
                                <Trash2 size={18} color="#ef4444" />
                              </Pressable>
                            )}
                          </View>
                        ))
                    )}
                  </View>
                </ScrollView>
              </>
            ) : (
              <>
                {/* Period Detail Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                  <Pressable onPress={handleClose}>
                    <X size={24} color="#64748b" />
                  </Pressable>
                  <Text className="text-white text-lg font-semibold">
                    {selectedPeriod?.title || 'Payment Period'}
                  </Text>
                  <View style={{ width: 24 }} />
                </View>

                {selectedPeriod && (
                  <ScrollView className="flex-1 px-5 pt-6">
                    {isAdmin() && !isEditAmountInline && (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditPeriodAmountInline(selectedPeriod.amount.toString());
                          setIsEditAmountInline(true);
                        }}
                        className="bg-green-500/20 rounded-xl p-4 mb-6 flex-row items-center justify-between active:bg-green-500/30"
                      >
                        <View>
                          <Text className="text-green-400 text-2xl font-bold">
                            ${selectedPeriod.amount}
                          </Text>
                          <Text className="text-green-300 text-sm">per player</Text>
                        </View>
                        <View className="bg-green-500/30 rounded-lg px-3 py-2 flex-row items-center">
                          <Edit3 size={16} color="#22c55e" />
                          <Text className="text-green-400 text-sm font-medium ml-1.5">Edit</Text>
                        </View>
                      </Pressable>
                    )}
                    {isAdmin() && isEditAmountInline && (
                      <View className="bg-green-500/20 rounded-xl p-4 mb-6 border border-green-500/50">
                        <Text className="text-green-300 text-sm mb-2">Edit Amount Due</Text>
                        <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3 mb-3">
                          <Text className="text-white text-2xl font-bold mr-1">$</Text>
                          <TextInput
                            value={editPeriodAmountInline}
                            onChangeText={setEditPeriodAmountInline}
                            placeholder="0.00"
                            placeholderTextColor="#64748b"
                            keyboardType="decimal-pad"
                            autoFocus
                            className="flex-1 text-white text-2xl font-bold"
                          />
                        </View>
                        <View className="flex-row">
                          <Pressable
                            onPress={() => {
                              setIsEditAmountInline(false);
                              setEditPeriodAmountInline('');
                            }}
                            className="flex-1 bg-slate-700 rounded-xl py-3 mr-2"
                          >
                            <Text className="text-slate-300 text-center font-semibold">Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              const amount = parseFloat(editPeriodAmountInline);
                              if (isNaN(amount) || amount <= 0) return;
                              updatePaymentPeriodAndSync(selectedPeriod.id, { amount });
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              setIsEditAmountInline(false);
                              setEditPeriodAmountInline('');
                            }}
                            className="flex-1 bg-green-500 rounded-xl py-3 ml-2"
                          >
                            <Text className="text-white text-center font-semibold">Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                    {!isAdmin() && (
                      <View className="bg-green-500/20 rounded-xl p-4 mb-6">
                        <Text className="text-green-400 text-2xl font-bold">
                          ${selectedPeriod.amount}
                        </Text>
                        <Text className="text-green-300 text-sm">per player</Text>
                      </View>
                    )}

                    {/* Due Date Section - Admin only */}
                    {isAdmin() && (
                      <View className="mb-6">
                        {!isEditDueDateVisible ? (
                          (() => {
                            const paidCount = selectedPeriod.playerPayments.filter((pp) => pp.status === 'paid').length;
                            const totalCount = selectedPeriod.playerPayments.length;
                            const allPaid = paidCount === totalCount;
                            const dueDateColor = selectedPeriod.dueDate
                              ? getDueDateColor(selectedPeriod.dueDate, allPaid)
                              : { text: 'text-slate-500', hex: '#64748b' };

                            return (
                              <Pressable
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setEditDueDate(selectedPeriod.dueDate ? parseISO(selectedPeriod.dueDate) : new Date());
                                  setIsEditDueDateVisible(true);
                                }}
                                className="bg-slate-800/60 rounded-xl p-4 flex-row items-center justify-between active:bg-slate-700/60 border border-slate-700/50"
                              >
                                <View className="flex-row items-center">
                                  <Calendar size={20} color={dueDateColor.hex} />
                                  <Text className={cn('text-base font-medium ml-3', selectedPeriod.dueDate ? dueDateColor.text : 'text-slate-500')}>
                                    {selectedPeriod.dueDate
                                      ? `Due ${format(parseISO(selectedPeriod.dueDate), 'MMMM d, yyyy')}`
                                      : 'No due date set'}
                                  </Text>
                                </View>
                                <Edit3 size={18} color="#64748b" />
                              </Pressable>
                            );
                          })()
                        ) : (
                          <View className="bg-slate-800/60 rounded-xl p-3 border border-cyan-500/50">
                            <View className="flex-row items-center justify-between mb-3">
                              <Text className="text-cyan-400 text-sm font-medium">Due Date</Text>
                              {editDueDate && (
                                <Pressable
                                  onPress={() => setEditDueDate(null)}
                                  className="px-2 py-1"
                                >
                                  <Text className="text-slate-500 text-xs">Clear</Text>
                                </Pressable>
                              )}
                            </View>
                            {editDueDate && (
                              <View className="bg-slate-800 rounded-xl overflow-hidden items-center mb-3">
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
                            )}
                            <View className="flex-row">
                              <Pressable
                                onPress={() => {
                                  setIsEditDueDateVisible(false);
                                  setEditDueDate(null);
                                }}
                                className="flex-1 bg-slate-700 rounded-lg py-2.5 mr-2"
                              >
                                <Text className="text-slate-300 text-center font-medium text-sm">Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  updatePaymentPeriodAndSync(selectedPeriod.id, {
                                    dueDate: editDueDate ? editDueDate.toISOString() : undefined
                                  });
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  setIsEditDueDateVisible(false);
                                  setEditDueDate(null);
                                }}
                                className="flex-1 bg-cyan-500 rounded-lg py-2.5 ml-2"
                              >
                                <Text className="text-white text-center font-medium text-sm">Save</Text>
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Send Reminder Button - Admin only */}
                    {isAdmin() && (
                      <Pressable
                        onPress={handleSendManualReminder}
                        disabled={isSendingReminder}
                        className="bg-amber-500/10 rounded-xl p-3.5 mb-4 flex-row items-center justify-between border border-amber-500/20 active:bg-amber-500/20"
                      >
                        <View className="flex-row items-center">
                          <Bell size={16} color="#f59e0b" />
                          <View className="ml-2.5">
                            <Text className="text-amber-400 font-semibold text-sm">Send Reminder</Text>
                            <Text className="text-amber-300/60 text-xs">Notify all unpaid players</Text>
                          </View>
                        </View>
                        {isSendingReminder ? (
                          <ActivityIndicator color="#f59e0b" size="small" />
                        ) : (
                          <ChevronRight size={16} color="#f59e0b" />
                        )}
                      </Pressable>
                    )}

                    <View className="flex-row items-center justify-between mb-3 mt-4">
                      <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        Players ({selectedPeriod.playerPayments.length})
                      </Text>
                      {isAdmin() && playersNotInPeriod.length > 0 && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsAddPlayerModalVisible(true);
                          }}
                          className="bg-cyan-500/20 rounded-lg px-3 py-1.5 flex-row items-center active:bg-cyan-500/30"
                        >
                          <Plus size={14} color="#67e8f9" />
                          <Text className="text-cyan-400 text-xs font-medium ml-1">Add Player</Text>
                        </Pressable>
                      )}
                    </View>

                    {(() => {
                      // Calculate overdue info
                      const isOverdue = selectedPeriod.dueDate ? differenceInDays(new Date(), parseISO(selectedPeriod.dueDate)) > 0 : false;
                      const daysOverdue = selectedPeriod.dueDate ? Math.max(0, differenceInDays(new Date(), parseISO(selectedPeriod.dueDate))) : 0;

                      // Group players by status: partial/owing first, unpaid second, paid last
                      // Calculate correct status based on actual amounts, not stored status
                      const groupedPayments = [...selectedPeriod.playerPayments]
                        .filter(pp => {
                          const player = players.find(p => p.id === pp.playerId);
                          return player && canViewPlayerDetails(pp.playerId);
                        })
                        .sort((a, b) => {
                          // Sort order: partial (1), unpaid (2), paid (3)
                          const getOrder = (status: string) => {
                            if (status === 'partial') return 1;
                            if (status === 'unpaid') return 2;
                            return 3; // paid
                          };
                          // Calculate actual status for sorting
                          const statusA = calculatePaymentStatus(a.amount, selectedPeriod.amount);
                          const statusB = calculatePaymentStatus(b.amount, selectedPeriod.amount);
                          return getOrder(statusA) - getOrder(statusB);
                        });

                      return groupedPayments.map((pp) => {
                        const player = players.find((p) => p.id === pp.playerId);
                        if (!player) return null;

                        // Calculate correct status based on actual amounts
                        const correctStatus = calculatePaymentStatus(pp.amount, selectedPeriod.amount);

                        return (
                          <SwipeablePaymentRow
                            key={pp.playerId}
                            player={player}
                            status={correctStatus}
                            paidAmount={pp.amount}
                            totalAmount={selectedPeriod.amount}
                            periodType={selectedPeriod.type ?? 'dues'}
                            isOverdue={isOverdue}
                            daysOverdue={daysOverdue}
                            onPress={() => {
                              setSelectedPlayerId(pp.playerId);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            canDelete={isAdmin()}
                            onDelete={() => handleRemovePlayerFromPeriod(pp.playerId)}
                          />
                        );
                      });
                    })()}
                  </ScrollView>
                )}
              </>
            )}

            {/* Add Player to Period Modal - Nested inside parent modal */}
            <Modal
              visible={isAddPlayerModalVisible}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setIsAddPlayerModalVisible(false)}
            >
              <View className="flex-1 bg-slate-900">
                <SafeAreaView className="flex-1">
                  <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                    <Pressable onPress={() => setIsAddPlayerModalVisible(false)}>
                      <X size={24} color="#64748b" />
                    </Pressable>
                    <Text className="text-white text-lg font-semibold">Add Players</Text>
                    <Pressable onPress={() => setIsAddPlayerModalVisible(false)}>
                      <Text className="text-cyan-400 font-semibold">Done</Text>
                    </Pressable>
                  </View>

                  <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
                    {playersNotInPeriod.length === 0 ? (
                      <View className="items-center py-12">
                        <Users size={48} color="#64748b" />
                        <Text className="text-slate-400 text-center mt-4">
                          All players are already in this payment period
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text className="text-slate-400 text-sm mb-4">
                          Tap a player to add them to this payment period
                        </Text>
                        {playersNotInPeriod.map((player) => (
                          <Pressable
                            key={player.id}
                            onPress={() => {
                              handleAddPlayerToPeriod(player.id);
                            }}
                            className="flex-row items-center p-3 rounded-xl mb-2 bg-slate-800/60 border border-slate-700/50 active:bg-slate-700/60"
                          >
                            <PlayerAvatar player={player} size={44} />
                            <View className="flex-1 ml-3">
                              <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                              <Text className={cn(
                                'text-xs',
                                player.status === 'active' ? 'text-green-400' : 'text-slate-400'
                              )}>
                                {player.status === 'active' ? 'Active' : 'Reserve'} · #{player.number}
                              </Text>
                            </View>
                            <View className="bg-cyan-500/20 rounded-lg px-3 py-1.5">
                              <Plus size={16} color="#67e8f9" />
                            </View>
                          </Pressable>
                        ))}
                      </>
                    )}
                  </ScrollView>
                </SafeAreaView>
              </View>
            </Modal>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Stripe Checkout WebView Modal - nested here so it shares the stripe state */}
      {stripeCheckoutUrl && (
        <Modal
          visible={!!stripeCheckoutUrl}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setStripeCheckoutUrl(null)}
        >
          <View className="flex-1 bg-slate-900">
            <SafeAreaView className="flex-1">
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <Pressable onPress={() => setStripeCheckoutUrl(null)} className="p-1">
                  <X size={24} color="#94a3b8" />
                </Pressable>
                <View className="flex-row items-center">
                  <View
                    style={{ backgroundColor: '#635BFF' }}
                    className="w-6 h-6 rounded-md items-center justify-center mr-2"
                  >
                    <Zap size={14} color="white" />
                  </View>
                  <Text className="text-white font-semibold text-base">Secure Checkout</Text>
                </View>
                <View style={{ width: 32 }} />
              </View>

              {/* WebView imported lazily to avoid pulling it into the main bundle unnecessarily */}
              {(() => {
                const { WebView } = require('react-native-webview');
                return (
                  <WebView
                    source={{ uri: stripeCheckoutUrl }}
                    style={{ flex: 1, backgroundColor: '#0f172a' }}
                    onNavigationStateChange={(navState: { url?: string }) => {
                      const url = navState.url ?? '';
                      // Handle success/cancel deep links from Stripe
                      if (url.startsWith('alignsports://payment-success') || url.includes('payment-success')) {
                        setStripeCheckoutUrl(null);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        // Record the payment locally and sync to Supabase
                        if (stripePaymentContext) {
                          const { periodId: ctxPeriodId, playerId, amount } = stripePaymentContext;
                          const entry: PaymentEntry = {
                            id: Date.now().toString(),
                            amount,
                            date: new Date().toISOString(),
                            note: 'Paid via Stripe',
                            createdAt: new Date().toISOString(),
                          };
                          addPaymentEntry(ctxPeriodId, playerId, entry);
                          if (activeTeamId) {
                            setTimeout(() => {
                              const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === ctxPeriodId);
                              if (updated) {
                                pushPaymentPeriodToSupabase(updated, activeTeamId).catch(syncError('sync'));
                              }
                            }, 50);
                          }
                          setStripePaymentContext(null);
                        }
                        Alert.alert('Payment Recorded', 'Your payment has been recorded successfully.', [{ text: 'Done' }]);
                      } else if (url.startsWith('alignsports://payment-cancel') || url.includes('payment-cancel')) {
                        setStripeCheckoutUrl(null);
                        setStripePaymentContext(null);
                      }
                    }}
                    startInLoadingState
                    renderLoading={() => (
                      <View className="absolute inset-0 items-center justify-center bg-slate-900">
                        <ActivityIndicator color="#635BFF" size="large" />
                        <Text className="text-slate-400 mt-3 text-sm">Loading Stripe Checkout...</Text>
                      </View>
                    )}
                  />
                );
              })()}
            </SafeAreaView>
          </View>
        </Modal>
      )}
    </>
  );
}
