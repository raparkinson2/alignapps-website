import { View, Text, Pressable, Modal, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CreditCard, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { useTeamStore, PaymentEntry } from '@/lib/store';
import { pushPaymentPeriodToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

// ─── Stripe Checkout WebView Modal ───────────────────────────────────────────

interface StripeCheckoutModalProps {
  visible: boolean;
  checkoutUrl: string | null;
  paymentContext: { periodId: string; playerId: string; amount: number } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function StripeCheckoutModal({
  visible,
  checkoutUrl,
  paymentContext,
  onClose,
  onSuccess,
}: StripeCheckoutModalProps) {
  const addPaymentEntry = useTeamStore((s) => s.addPaymentEntry);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose} className="p-1">
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

          {checkoutUrl && (
            <WebView
              source={{ uri: checkoutUrl }}
              style={{ flex: 1, backgroundColor: '#0f172a' }}
              onNavigationStateChange={(navState) => {
                const url = navState.url ?? '';
                // Handle success/cancel deep links from Stripe
                if (url.startsWith('alignsports://payment-success') || url.includes('payment-success')) {
                  onClose();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  // Record the payment locally and sync to Supabase
                  if (paymentContext) {
                    const { periodId, playerId, amount } = paymentContext;
                    const entry: PaymentEntry = {
                      id: Date.now().toString(),
                      amount,
                      date: new Date().toISOString(),
                      note: 'Paid via Stripe',
                      createdAt: new Date().toISOString(),
                    };
                    addPaymentEntry(periodId, playerId, entry);
                    if (activeTeamId) {
                      setTimeout(() => {
                        const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === periodId);
                        if (updated) {
                          pushPaymentPeriodToSupabase(updated, activeTeamId).catch(syncError('sync'));
                        }
                      }, 50);
                    }
                    onSuccess();
                  }
                  Alert.alert('Payment Recorded', 'Your payment has been recorded successfully.', [{ text: 'Done' }]);
                } else if (url.startsWith('alignsports://payment-cancel') || url.includes('payment-cancel')) {
                  onClose();
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
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Stripe Payment Disclosure Modal ─────────────────────────────────────────

interface StripeDisclosureModalProps {
  visible: boolean;
  onClose: () => void;
}

export function StripeDisclosureModal({ visible, onClose }: StripeDisclosureModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/60 items-center justify-center px-6"
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-slate-800 rounded-2xl p-6 border border-slate-700/60" style={{ maxWidth: 360 }}>
            {/* Header */}
            <View className="flex-row items-center mb-4">
              <View style={{ backgroundColor: '#635BFF20', borderRadius: 10, padding: 8 }}>
                <CreditCard size={20} color="#635BFF" />
              </View>
              <Text className="text-white font-bold text-lg ml-3">Payment Processing</Text>
            </View>

            {/* Body */}
            <Text className="text-slate-300 text-sm leading-6 mb-3">
              All payments are securely processed by <Text className="text-white font-semibold">Stripe</Text>, a certified PCI-DSS Level 1 payment processor.
            </Text>
            <Text className="text-slate-300 text-sm leading-6 mb-3">
              A processing fee (2.9% + $0.30) is added to your total so your team receives the full amount owed.
            </Text>
            <Text className="text-slate-300 text-sm leading-6 mb-3">
              Align Sports does not collect, store, or have access to your card number, CVV, or any other payment credentials. All sensitive financial data is handled exclusively by Stripe.
            </Text>
            <Text className="text-slate-400 text-xs leading-5">
              By completing a payment, you agree to Stripe's{' '}
              <Text
                className="text-cyan-400 underline"
                onPress={() => {
                  Linking.openURL('https://stripe.com/legal/consumer');
                  onClose();
                }}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text
                className="text-cyan-400 underline"
                onPress={() => {
                  Linking.openURL('https://stripe.com/privacy');
                  onClose();
                }}
              >
                Privacy Policy
              </Text>
              .
            </Text>

            <Pressable
              onPress={onClose}
              className="mt-5 bg-slate-700 rounded-xl py-3 items-center active:bg-slate-600"
            >
              <Text className="text-white font-semibold">Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
