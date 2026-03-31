import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useCallback } from 'react';
import {
  DollarSign,
  Plus,
  X,
  CreditCard,
  Users,
  ExternalLink,
  Info,
  GripVertical,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { pushPaymentPeriodToSupabase, pushTeamToSupabase } from '@/lib/realtime-sync';
import { toast } from '@/lib/toast';

// Extracted components
import { SwipeablePeriodRow } from '@/components/payments/SwipeablePeriodRow';
import { PlayerPaymentStatus } from '@/components/payments/PlayerPaymentStatus';
import { PaymentMethodButton } from '@/components/payments/PaymentMethodButton';
import { StripePayButton } from '@/components/payments/StripePayButton';
import { AddPaymentMethodModal } from '@/components/payments/AddPaymentMethodModal';
import { NewPaymentPeriodModal } from '@/components/payments/NewPaymentPeriodModal';
import { PaymentPeriodDetailModal } from '@/components/payments/PaymentPeriodDetailModal';
import { EditAmountModal } from '@/components/payments/EditAmountModal';
import { EditTeamTotalModal } from '@/components/payments/EditTeamTotalModal';
import { EditDueDateModal } from '@/components/payments/EditDueDateModal';
import { PaymentInfoModal } from '@/components/payments/PaymentInfoModal';
import { StripeDisclosureModal } from '@/components/payments/StripeModals';

function PaymentsScreen() {
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore(useShallow((s) => s.teamSettings));
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const removePaymentPeriod = useTeamStore((s) => s.removePaymentPeriod);
  const updatePaymentPeriod = useTeamStore((s) => s.updatePaymentPeriod);
  const reorderPaymentPeriods = useTeamStore((s) => s.reorderPaymentPeriods);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  // Debounce ref: prevents rapid taps from firing multiple concurrent Supabase writes
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wrapper: updates teamSettings locally AND pushes to Supabase (debounced)
  const setTeamSettingsAndSync = useCallback((updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch((err) => {
          console.error(err);
          toast.error('Sync failed. Changes saved locally.');
        });
      }, 400);
    }
  }, [activeTeamId, setTeamSettings]);

  // Wrapper: updates locally AND pushes to Supabase
  const updatePaymentPeriodAndSync = useCallback((periodId: string, updates: Parameters<typeof updatePaymentPeriod>[1]) => {
    updatePaymentPeriod(periodId, updates);
    if (activeTeamId) {
      const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === periodId);
      if (updated) {
        pushPaymentPeriodToSupabase({ ...updated, ...updates }, activeTeamId).catch((err) => {
          console.error(err);
          toast.error('Sync failed. Changes saved locally.');
        });
      }
    }
  }, [activeTeamId, updatePaymentPeriod]);

  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isPaymentMethodModalVisible, setIsPaymentMethodModalVisible] = useState(false);
  const [isNewPeriodModalVisible, setIsNewPeriodModalVisible] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const [isEditAmountModalVisible, setIsEditAmountModalVisible] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);

  const [isEditTeamTotalModalVisible, setIsEditTeamTotalModalVisible] = useState(false);
  const [editingTeamTotalPeriodId, setEditingTeamTotalPeriodId] = useState<string | null>(null);

  const [isEditDueDateVisible, setIsEditDueDateVisible] = useState(false);
  const [editingDueDatePeriodId, setEditingDueDatePeriodId] = useState<string | null>(null);

  const [isPaymentInfoModalVisible, setIsPaymentInfoModalVisible] = useState(false);
  const [isStripeDisclosureVisible, setIsStripeDisclosureVisible] = useState(false);

  const { isTablet, columns, containerPadding } = useResponsive();

  const paymentMethods = teamSettings.paymentMethods ?? [];

  const handleRemovePaymentMethod = (index: number) => {
    Alert.alert('Remove Payment Method', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const newMethods = paymentMethods.filter((_, i) => i !== index);
          setTeamSettingsAndSync({ paymentMethods: newMethods });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const movePeriodUp = (index: number) => {
    if (index === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPeriods = [...paymentPeriods];
    [newPeriods[index - 1], newPeriods[index]] = [newPeriods[index], newPeriods[index - 1]];
    reorderPaymentPeriods(newPeriods);
  };

  const movePeriodDown = (index: number) => {
    if (index === paymentPeriods.length - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPeriods = [...paymentPeriods];
    [newPeriods[index], newPeriods[index + 1]] = [newPeriods[index + 1], newPeriods[index]];
    reorderPaymentPeriods(newPeriods);
  };

  const myPaymentStatus = paymentPeriods.map((period) => {
    const myPayment = period.playerPayments.find((pp) => pp.playerId === currentPlayerId);
    return { period, payment: myPayment };
  }).filter((item) => item.payment);

  const stripeReady = !!(teamSettings?.stripeAccountId && teamSettings?.stripeOnboardingComplete);

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-2 pb-4">
          <Text className="text-white text-3xl font-bold">Team Finances</Text>
        </Animated.View>

        <FlatList
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
          data={isAdmin() ? paymentPeriods : []}
          keyExtractor={(period) => period.id}
          renderItem={({ item: period, index }) => (
            <Animated.View
              key={period.id}
              entering={FadeInDown.delay(200 + index * 50).springify()}
              style={isTablet && columns >= 2 ? {
                width: columns >= 3 ? '33.33%' : '50%',
                paddingHorizontal: 6,
              } : undefined}
            >
              <SwipeablePeriodRow
                period={period}
                index={index}
                isReorderMode={isReorderMode}
                onPress={() => setSelectedPeriodId(period.id)}
                onDelete={() => {
                  Alert.alert('Delete Period', 'Are you sure you want to delete this payment period?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => removePaymentPeriod(period.id),
                    },
                  ]);
                }}
                onMoveUp={() => movePeriodUp(index)}
                onMoveDown={() => movePeriodDown(index)}
                onEditAmount={() => {
                  setEditingPeriodId(period.id);
                  setIsEditAmountModalVisible(true);
                }}
                onEditTeamTotal={() => {
                  setEditingTeamTotalPeriodId(period.id);
                  setIsEditTeamTotalModalVisible(true);
                }}
                onEditDueDate={() => {
                  setEditingDueDatePeriodId(period.id);
                  setIsEditDueDateVisible(true);
                }}
                totalPeriods={paymentPeriods.length}
                isAdmin={isAdmin()}
              />
            </Animated.View>
          )}
          numColumns={isTablet && columns >= 3 ? 3 : isTablet && columns >= 2 ? 2 : 1}
          key={isTablet && columns >= 3 ? 'grid3' : isTablet && columns >= 2 ? 'grid2' : 'list'}
          columnWrapperStyle={isTablet && columns >= 2 ? { marginHorizontal: -6 } : undefined}
          ListHeaderComponent={() => (
            <>
              {/* Section 1: Pay with Stripe */}
              <Animated.View entering={FadeInDown.delay(100).springify()} className="mb-5">
                <View className="flex-row items-center mb-3">
                  <CreditCard size={16} color="#635BFF" />
                  <Text className="text-indigo-400 font-semibold ml-2">Pay with Stripe</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsStripeDisclosureVisible(true);
                    }}
                    className="ml-2 p-1.5"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Info size={15} color="#475569" />
                  </Pressable>
                </View>
                <View className={stripeReady ? 'bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/40' : ''}>
                  <StripePayButton
                    myPaymentStatus={myPaymentStatus}
                    isSetupComplete={stripeReady}
                    isAdmin={isAdmin()}
                  />
                  {stripeReady && (
                    <View className="flex-row items-center px-4 py-2.5 border-t border-slate-700/40">
                      <Info size={12} color="#475569" />
                      <Text className="text-slate-500 text-xs ml-2">
                        Stripe processing fee applies · Card info never stored by Align Sports
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* Section 2: Payment Apps */}
              <Animated.View entering={FadeInDown.delay(130).springify()} className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <ExternalLink size={16} color="#67e8f9" />
                    <Text className="text-cyan-400 font-semibold ml-2">Payment Apps</Text>
                  </View>
                  {isAdmin() && (
                    <Pressable
                      onPress={() => setIsPaymentMethodModalVisible(true)}
                      className="bg-green-500 w-10 h-10 rounded-full items-center justify-center active:bg-green-600"
                    >
                      <Plus size={20} color="white" />
                    </Pressable>
                  )}
                </View>
                {paymentMethods.length === 0 ? (
                  <View className="bg-slate-800/50 rounded-2xl p-5 items-center border border-slate-700/40">
                    <ExternalLink size={28} color="#334155" />
                    <Text className="text-slate-500 text-sm text-center mt-2">
                      {isAdmin() ? 'Add Peer to Peer Payment Apps with the + button' : 'No payment apps configured'}
                    </Text>
                  </View>
                ) : (
                  <View className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/40">
                    <Text className="text-slate-500 text-xs mb-3 uppercase tracking-wider font-medium">Tap to pay externally</Text>
                    <View className="flex-row" style={{ gap: 8 }}>
                      {paymentMethods.map((method, index) => (
                        <View key={index} className="relative flex-1" style={{ marginTop: 4 }}>
                          <PaymentMethodButton method={method} />
                          {isAdmin() && (
                            <Pressable
                              onPress={() => handleRemovePaymentMethod(index)}
                              className="absolute -top-2 -right-1 bg-red-500 rounded-full p-1"
                            >
                              <X size={8} color="white" />
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Animated.View>

              {/* Payment Tracking header — admin only */}
              {isAdmin() && (
                <Animated.View entering={FadeInDown.delay(150).springify()}>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <Users size={16} color="#a78bfa" />
                      <Text className="text-purple-400 font-semibold ml-2">Payment Tracking</Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setIsPaymentInfoModalVisible(true);
                        }}
                        className="ml-2 p-1.5"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Info size={16} color="#94a3b8" />
                      </Pressable>
                    </View>
                    <View className="flex-row items-center">
                      {paymentPeriods.length > 1 && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsReorderMode(!isReorderMode);
                          }}
                          className={cn(
                            'rounded-full p-2 mr-2',
                            isReorderMode ? 'bg-purple-500' : 'bg-purple-500/20'
                          )}
                        >
                          <GripVertical size={16} color={isReorderMode ? 'white' : '#a78bfa'} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => setIsNewPeriodModalVisible(true)}
                        className="bg-green-500 w-10 h-10 rounded-full items-center justify-center active:bg-green-600"
                      >
                        <Plus size={20} color="white" />
                      </Pressable>
                    </View>
                  </View>
                  {paymentPeriods.length === 0 && (
                    <View className="bg-slate-800/50 rounded-xl p-6 items-center mb-6">
                      <DollarSign size={32} color="#64748b" />
                      <Text className="text-slate-400 text-center mt-2">Create a payment period to track dues</Text>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* Non-admin: My Payment Status */}
              {!isAdmin() && myPaymentStatus.length > 0 && (
                <PlayerPaymentStatus
                  myPaymentStatus={myPaymentStatus}
                  onSelectPeriod={(periodId) => setSelectedPeriodId(periodId)}
                />
              )}
            </>
          )}
        />
      </SafeAreaView>

      <AddPaymentMethodModal
        visible={isPaymentMethodModalVisible}
        onClose={() => setIsPaymentMethodModalVisible(false)}
      />

      <NewPaymentPeriodModal
        visible={isNewPeriodModalVisible}
        onClose={() => setIsNewPeriodModalVisible(false)}
      />

      <PaymentPeriodDetailModal
        visible={selectedPeriodId !== null}
        onClose={() => setSelectedPeriodId(null)}
        periodId={selectedPeriodId}
      />

      <EditAmountModal
        visible={isEditAmountModalVisible}
        onClose={() => {
          setIsEditAmountModalVisible(false);
          setEditingPeriodId(null);
        }}
        periodId={editingPeriodId}
      />

      <EditTeamTotalModal
        visible={isEditTeamTotalModalVisible}
        onClose={() => {
          setIsEditTeamTotalModalVisible(false);
          setEditingTeamTotalPeriodId(null);
        }}
        periodId={editingTeamTotalPeriodId}
      />

      <EditDueDateModal
        visible={isEditDueDateVisible}
        onClose={() => {
          setIsEditDueDateVisible(false);
          setEditingDueDatePeriodId(null);
        }}
        periodId={editingDueDatePeriodId}
      />

      <PaymentInfoModal
        visible={isPaymentInfoModalVisible}
        onClose={() => setIsPaymentInfoModalVisible(false)}
      />

      <StripeDisclosureModal
        visible={isStripeDisclosureVisible}
        onClose={() => setIsStripeDisclosureVisible(false)}
      />
    </View>
  );
}

export default withErrorBoundary(PaymentsScreen);
