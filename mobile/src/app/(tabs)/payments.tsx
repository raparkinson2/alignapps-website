import { View, Text, ScrollView, Pressable, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  DollarSign,
  Plus,
  X,
  ChevronRight,
  CreditCard,
  Users,
  CheckCircle2,
  Circle,
  ExternalLink,
  Info,
  GripVertical,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Modal } from 'react-native';
import { ScrollView as RNScrollView } from 'react-native';
import {
  useTeamStore,
  PaymentPeriod,
  PaymentMethod,
  PaymentApp,
  PaymentEntry,
  getPlayerName,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { format, parseISO, differenceInDays } from 'date-fns';
import { pushPaymentPeriodToSupabase, pushTeamToSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';

// Extracted components
import { SwipeablePeriodRow } from '@/components/payments/SwipeablePeriodRow';
import { PlayerPaymentStatus } from '@/components/payments/PlayerPaymentStatus';
import { AddPaymentMethodModal } from '@/components/payments/AddPaymentMethodModal';
import { NewPaymentPeriodModal } from '@/components/payments/NewPaymentPeriodModal';
import { PaymentPeriodDetailModal } from '@/components/payments/PaymentPeriodDetailModal';
import { EditAmountModal } from '@/components/payments/EditAmountModal';
import { EditTeamTotalModal } from '@/components/payments/EditTeamTotalModal';
import { EditDueDateModal } from '@/components/payments/EditDueDateModal';
import { PaymentInfoModal } from '@/components/payments/PaymentInfoModal';
import { StripeCheckoutModal, StripeDisclosureModal } from '@/components/payments/StripeModals';

const PAYMENT_APP_INFO: Record<PaymentApp, {
  name: string;
  color: string;
  urlScheme: (username: string, amount?: number) => string;
  webFallback?: (username: string) => string;
}> = {
  venmo: {
    name: 'Venmo',
    color: '#3D95CE',
    urlScheme: (username, amount) => `venmo://paycharge?txn=pay&recipients=${username}${amount ? `&amount=${amount}` : ''}`,
    webFallback: (username) => `https://venmo.com/${username.replace('@', '')}`,
  },
  paypal: {
    name: 'PayPal',
    color: '#003087',
    urlScheme: (username) => `https://paypal.me/${username}`,
  },
  zelle: {
    name: 'Zelle',
    color: '#6D1ED4',
    urlScheme: (username) => `zelle://transfer?recipient=${encodeURIComponent(username)}`,
    // Zelle has no web fallback - it's bank-specific
  },
  cashapp: {
    name: 'Cash App',
    color: '#00D632',
    urlScheme: (username, amount) => `cashapp://cash.app/pay/${username.replace('$', '')}${amount ? `?amount=${amount}` : ''}`,
    webFallback: (username) => `https://cash.app/${username.replace('$', '')}`,
  },
  applepay: {
    name: 'Apple Cash',
    color: '#000000',
    urlScheme: (username) => `messages://`,
    // Apple Cash works through Messages app - no direct payment link
  },
};

interface PaymentMethodButtonProps {
  method: PaymentMethod;
  amount?: number;
}

function PaymentMethodButton({ method, amount }: PaymentMethodButtonProps) {
  const info = PAYMENT_APP_INFO[method.app];

  const handlePress = async () => {
    console.log('Payment button pressed:', method.app);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = info.urlScheme(method.username, amount);
    console.log('Opening URL:', url);

    try {
      // For PayPal, always use the HTTPS URL directly (no app scheme)
      if (method.app === 'paypal') {
        await Linking.openURL(url);
        return;
      }

      // For Venmo and Cash App, try app first, then fall back to web
      if (method.app === 'venmo' || method.app === 'cashapp') {
        try {
          // Try to open the app directly
          await Linking.openURL(url);
        } catch {
          // If app fails, use web fallback
          if (info.webFallback) {
            await Linking.openURL(info.webFallback(method.username));
          }
        }
        return;
      }

      // For Zelle, show helpful message with recipient info
      if (method.app === 'zelle') {
        Alert.alert(
          'Zelle Payment',
          `Send payment to: ${method.username}\n\nOpen your bank app and use Zelle to send money to this recipient.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // For Apple Cash, show helpful message with phone number
      if (method.app === 'applepay') {
        Alert.alert(
          'Apple Cash Payment',
          `Send payment to: ${method.username}\n\nOpen Messages and send Apple Cash to this phone number or email.`,
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error) {
      console.log('Error opening payment:', error);
      Alert.alert('Error', `Could not open ${info.name}`);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-1 flex-row items-center justify-center py-2.5 px-3 rounded-lg active:opacity-80"
      style={{ backgroundColor: info.color }}
    >
      <ExternalLink size={12} color="white" />
      <Text className="text-white font-medium text-xs ml-1.5" numberOfLines={1}>{method.displayName || info.name}</Text>
    </Pressable>
  );
}

interface StripePayButtonProps {
  myPaymentStatus: { period: PaymentPeriod; payment: { status: string; amount?: number } | undefined }[];
  isStripeLoading: boolean;
  onPay: (period: PaymentPeriod, playerId: string) => void;
  isSetupComplete: boolean;
  isAdmin: boolean;
}

function StripePayButton({ myPaymentStatus, isStripeLoading, onPay, isSetupComplete, isAdmin }: StripePayButtonProps) {
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const [showPicker, setShowPicker] = useState(false);

  // Not set up yet — show compact inline notice
  if (!isSetupComplete) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}>
        <CreditCard size={14} color="#475569" />
        <Text style={{ color: '#475569', fontSize: 12, marginLeft: 8, flex: 1 }}>
          {isAdmin ? 'Enable in-app payments via Stripe in the Admin panel.' : 'In-app Stripe payments not yet enabled.'}
        </Text>
      </View>
    );
  }

  const unpaidPeriods = myPaymentStatus.filter(
    ({ payment, period }) =>
      payment && payment.status !== 'paid' && (period.amount - (payment.amount ?? 0)) > 0
  );

  if (unpaidPeriods.length === 0) {
    return (
      <View className="flex-row items-center justify-center bg-green-500/10 rounded-xl py-3 px-4 border border-green-500/20">
        <CheckCircle2 size={18} color="#22c55e" />
        <Text className="text-green-400 font-semibold ml-2">All payments up to date</Text>
      </View>
    );
  }

  const handlePress = () => {
    if (!currentPlayerId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (unpaidPeriods.length === 1) {
      onPay(unpaidPeriods[0].period, currentPlayerId);
    } else {
      setShowPicker(true);
    }
  };

  return (
    <>
      <Pressable onPress={handlePress} disabled={isStripeLoading} className="active:opacity-80">
        <LinearGradient
          colors={['#635BFF', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isStripeLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={18} color="white" />
              </View>
            )}
            <View style={{ marginLeft: 12 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Pay with Stripe</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 }}>
                {unpaidPeriods.length === 1
                  ? `$${Math.max(0, unpaidPeriods[0].period.amount - (unpaidPeriods[0].payment?.amount ?? 0))} due · ${unpaidPeriods[0].period.title}`
                  : `${unpaidPeriods.length} payments outstanding`}
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Pay Now</Text>
          </View>
        </LinearGradient>
      </Pressable>

      {/* Period picker when multiple unpaid */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPicker(false)}>
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setShowPicker(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Select Payment</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView className="flex-1 px-5 pt-4">
              <Text className="text-slate-400 text-sm mb-4">Which payment would you like to make?</Text>
              {unpaidPeriods.map(({ period, payment }) => {
                const balance = Math.max(0, period.amount - (payment?.amount ?? 0));
                return (
                  <Pressable
                    key={period.id}
                    onPress={() => {
                      setShowPicker(false);
                      if (currentPlayerId) onPay(period, currentPlayerId);
                    }}
                    className="bg-slate-800 rounded-xl p-4 mb-3 flex-row items-center justify-between active:bg-slate-700 border border-slate-700/50"
                  >
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-base">{period.title}</Text>
                      <Text className="text-slate-400 text-sm mt-0.5">
                        {payment?.status === 'partial' ? `$${(payment.amount ?? 0).toFixed(2)} paid · $${balance.toFixed(2)} remaining` : `$${balance.toFixed(2)} due`}
                      </Text>
                    </View>
                    <LinearGradient
                      colors={['#635BFF', '#7C3AED']}
                      style={{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Pay ${balance.toFixed(2)}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

export default function PaymentsScreen() {
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const removePaymentPeriod = useTeamStore((s) => s.removePaymentPeriod);
  const updatePaymentPeriod = useTeamStore((s) => s.updatePaymentPeriod);
  const reorderPaymentPeriods = useTeamStore((s) => s.reorderPaymentPeriods);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamName = useTeamStore((s) => s.teamName);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const canManageTeam = useTeamStore((s) => s.canManageTeam);

  // Wrapper: updates teamSettings locally AND pushes to Supabase
  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
      }, 50);
    }
  };

  // Wrapper: updates locally AND pushes to Supabase
  const updatePaymentPeriodAndSync = (periodId: string, updates: Parameters<typeof updatePaymentPeriod>[1]) => {
    updatePaymentPeriod(periodId, updates);
    if (activeTeamId) {
      const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === periodId);
      if (updated) {
        pushPaymentPeriodToSupabase({ ...updated, ...updates }, activeTeamId).catch(console.error);
      }
    }
  };

  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isPaymentMethodModalVisible, setIsPaymentMethodModalVisible] = useState(false);
  const [isNewPeriodModalVisible, setIsNewPeriodModalVisible] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  // Edit period amount (from main list)
  const [isEditAmountModalVisible, setIsEditAmountModalVisible] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);

  // Team total amount owed (admin only) - tied to a specific period
  const [isEditTeamTotalModalVisible, setIsEditTeamTotalModalVisible] = useState(false);
  const [editingTeamTotalPeriodId, setEditingTeamTotalPeriodId] = useState<string | null>(null);

  // Edit due date (from main list)
  const [isEditDueDateVisible, setIsEditDueDateVisible] = useState(false);
  const [editingDueDatePeriodId, setEditingDueDatePeriodId] = useState<string | null>(null);

  // Payment info modal
  const [isPaymentInfoModalVisible, setIsPaymentInfoModalVisible] = useState(false);

  // Stripe disclosure modal
  const [isStripeDisclosureVisible, setIsStripeDisclosureVisible] = useState(false);

  // Stripe checkout state
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [stripePaymentContext, setStripePaymentContext] = useState<{ periodId: string; playerId: string; amount: number } | null>(null);

  // Responsive layout for iPad
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

  // Calculate the gross-up amount so admin receives the full balance after all fees
  // Formula: total = (balance + 0.30) / (1 - 0.029 - 0.005)
  // Stripe takes 2.9% + $0.30, platform takes 0.5%
  const calcTotalWithFees = (balance: number) => {
    const total = (balance + 0.30) / (1 - 0.029 - 0.005);
    return Math.ceil(total * 100) / 100; // round up to nearest cent
  };

  // Launch Stripe Checkout in a WebView modal
  const handleStripePayment = async (period: PaymentPeriod, playerId: string) => {
    const balance = period.amount - (period.playerPayments.find(pp => pp.playerId === playerId)?.amount ?? 0);
    if (balance <= 0) return;

    setIsStripeLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const player = players.find(p => p.id === playerId);
      const totalWithFees = calcTotalWithFees(balance);
      const amountInCents = Math.round(totalWithFees * 100);

      const res = await fetch(`${BACKEND_URL}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInCents,
          playerName: player ? getPlayerName(player) : '',
          teamName: teamName ?? '',
          paymentPeriodTitle: period.title,
          paymentPeriodId: period.id,
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
      setStripePaymentContext({ periodId: period.id, playerId, amount: balance });
    } catch (err: any) {
      Alert.alert('Payment Error', err?.message ?? 'Could not start Stripe checkout. Please try again.');
    } finally {
      setIsStripeLoading(false);
    }
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

  // Get current player's payment status across all periods
  const myPaymentStatus = paymentPeriods.map((period) => {
    const myPayment = period.playerPayments.find((pp) => pp.playerId === currentPlayerId);
    return {
      period,
      payment: myPayment,
    };
  }).filter((item) => item.payment);

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="px-5 pt-2 pb-4"
        >
          <Text className="text-white text-3xl font-bold">Team Finances</Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
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

            {(() => {
              const stripeReady = !!(teamSettings?.stripeAccountId && teamSettings?.stripeOnboardingComplete);
              return (
                <View className={stripeReady ? "bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/40" : ""}>
                  <StripePayButton
                    myPaymentStatus={myPaymentStatus}
                    isStripeLoading={isStripeLoading}
                    onPay={handleStripePayment}
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
              );
            })()}
          </Animated.View>

          {/* Section 2: Payment Apps (Venmo, PayPal, etc.) */}
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
                  {isAdmin() ? 'Add Venmo, PayPal, Zelle, etc. with the + button' : 'No payment apps configured'}
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

          {/* Payment Tracking Section - Admin Only */}
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
                  {isAdmin() && paymentPeriods.length > 1 && (
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
                  {isAdmin() && (
                    <Pressable
                      onPress={() => setIsNewPeriodModalVisible(true)}
                      className="bg-green-500 w-10 h-10 rounded-full items-center justify-center active:bg-green-600"
                    >
                      <Plus size={20} color="white" />
                    </Pressable>
                  )}
                </View>
              </View>

              {paymentPeriods.length === 0 ? (
                <View className="bg-slate-800/50 rounded-xl p-6 items-center mb-6">
                  <DollarSign size={32} color="#64748b" />
                  <Text className="text-slate-400 text-center mt-2">
                    {isAdmin() ? 'Create a payment period to track dues' : 'No payment periods'}
                  </Text>
                </View>
              ) : (
                <View className={cn('mb-6', isTablet && columns >= 2 && 'flex-row flex-wrap')} style={isTablet && columns >= 2 ? { marginHorizontal: -6 } : undefined}>
                  {paymentPeriods.map((period, index) => (
                    <Animated.View
                      key={period.id}
                      entering={FadeInDown.delay(200 + index * 50).springify()}
                      style={isTablet && columns >= 2 ? {
                        width: columns >= 3 ? '33.33%' : '50%',
                        paddingHorizontal: 6
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
                              onPress: () => {
                                removePaymentPeriod(period.id);
                              },
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
                  ))}
                </View>
              )}
            </Animated.View>
          )}

          {/* My Payment Status - For non-admin players */}
          {!isAdmin() && myPaymentStatus.length > 0 && (
            <PlayerPaymentStatus
              myPaymentStatus={myPaymentStatus}
              onSelectPeriod={(periodId) => setSelectedPeriodId(periodId)}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        visible={isPaymentMethodModalVisible}
        onClose={() => setIsPaymentMethodModalVisible(false)}
      />

      {/* New Payment Period Modal */}
      <NewPaymentPeriodModal
        visible={isNewPeriodModalVisible}
        onClose={() => setIsNewPeriodModalVisible(false)}
      />

      {/* Payment Period Detail Modal */}
      <PaymentPeriodDetailModal
        visible={selectedPeriodId !== null}
        onClose={() => setSelectedPeriodId(null)}
        periodId={selectedPeriodId}
      />

      {/* Edit Period Amount Modal */}
      <EditAmountModal
        visible={isEditAmountModalVisible}
        onClose={() => {
          setIsEditAmountModalVisible(false);
          setEditingPeriodId(null);
        }}
        periodId={editingPeriodId}
      />

      {/* Edit Team Total Amount Modal */}
      <EditTeamTotalModal
        visible={isEditTeamTotalModalVisible}
        onClose={() => {
          setIsEditTeamTotalModalVisible(false);
          setEditingTeamTotalPeriodId(null);
        }}
        periodId={editingTeamTotalPeriodId}
      />

      {/* Edit Due Date Modal */}
      <EditDueDateModal
        visible={isEditDueDateVisible}
        onClose={() => {
          setIsEditDueDateVisible(false);
          setEditingDueDatePeriodId(null);
        }}
        periodId={editingDueDatePeriodId}
      />

      {/* Payment Info Modal */}
      <PaymentInfoModal
        visible={isPaymentInfoModalVisible}
        onClose={() => setIsPaymentInfoModalVisible(false)}
      />

      {/* Stripe Checkout WebView Modal */}
      <StripeCheckoutModal
        visible={!!stripeCheckoutUrl}
        checkoutUrl={stripeCheckoutUrl}
        paymentContext={stripePaymentContext}
        onClose={() => {
          setStripeCheckoutUrl(null);
          setStripePaymentContext(null);
        }}
        onSuccess={() => setStripePaymentContext(null)}
      />

      {/* Stripe Payment Disclosure Modal */}
      <StripeDisclosureModal
        visible={isStripeDisclosureVisible}
        onClose={() => setIsStripeDisclosureVisible(false)}
      />
    </View>
  );
}
