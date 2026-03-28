import {
  View, Text, Pressable, ScrollView, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { X, CreditCard, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTeamStore, PaymentPeriod, getPlayerName } from '@/lib/store';
import { StripeCheckoutModal } from './StripeModals';
import { BACKEND_URL } from '@/lib/config';

interface StripePayButtonProps {
  myPaymentStatus: { period: PaymentPeriod; payment: { status: string; amount?: number } | undefined }[];
  isSetupComplete: boolean;
  isAdmin: boolean;
}

export function StripePayButton({ myPaymentStatus, isSetupComplete, isAdmin }: StripePayButtonProps) {
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [stripePaymentContext, setStripePaymentContext] = useState<{ periodId: string; playerId: string; amount: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Gross-up so admin receives the full balance after all fees
  const calcTotalWithFees = (balance: number) => {
    const total = (balance + 0.30) / (1 - 0.029 - 0.005);
    return Math.ceil(total * 100) / 100;
  };

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not start Stripe checkout. Please try again.';
      Alert.alert('Payment Error', message);
    } finally {
      setIsStripeLoading(false);
    }
  };

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
      handleStripePayment(unpaidPeriods[0].period, currentPlayerId);
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
                      if (currentPlayerId) handleStripePayment(period, currentPlayerId);
                    }}
                    className="bg-slate-800 rounded-xl p-4 mb-3 flex-row items-center justify-between active:bg-slate-700 border border-slate-700/50"
                  >
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-base">{period.title}</Text>
                      <Text className="text-slate-400 text-sm mt-0.5">
                        {payment?.status === 'partial'
                          ? `$${(payment.amount ?? 0).toFixed(2)} paid · $${balance.toFixed(2)} remaining`
                          : `$${balance.toFixed(2)} due`}
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
    </>
  );
}
