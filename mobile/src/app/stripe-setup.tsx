import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { ChevronLeft, CreditCard, CheckCircle2, AlertCircle, X, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';

export default function StripeSetupScreen() {
  const router = useRouter();
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamName = useTeamStore((s) => s.teamName);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  const [isLoading, setIsLoading] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);

  const isConnected = !!(teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete);

  const setTeamSettingsAndSync = (updates: Partial<typeof teamSettings>) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
      }, 50);
    }
  };

  const handleConnect = async () => {
    if (!activeTeamId || !currentPlayerId) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/payments/connect/onboard?teamId=${activeTeamId}&adminId=${currentPlayerId}`
      );
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not start Stripe onboarding');
      setWebViewUrl(data.url);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not start Stripe setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Stripe',
      'Players will no longer be able to pay via Stripe in the app. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/payments/connect/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: activeTeamId }),
              });
              setTeamSettingsAndSync({ stripeAccountId: undefined, stripeOnboardingComplete: false });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert('Error', 'Failed to disconnect Stripe.');
            }
          },
        },
      ]
    );
  };

  // WebView open — Stripe onboarding flow
  if (webViewUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
            <Pressable onPress={() => setWebViewUrl(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color="#94a3b8" />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#635BFF', borderRadius: 6, padding: 5, marginRight: 8 }}>
                <CreditCard size={14} color="white" />
              </View>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Connect with Stripe</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
          <WebView
            source={{ uri: webViewUrl }}
            style={{ flex: 1, backgroundColor: '#0f172a' }}
            onShouldStartLoadWithRequest={(request) => {
              const url = request.url ?? '';
              if (url.startsWith('alignsports://') || url.includes('stripe-connect-success') || url.includes('stripe-connect-cancel')) {
                if (url.includes('stripe-connect-success')) {
                  const match = url.match(/accountId=([^&]+)/);
                  const accountId = match?.[1];
                  setWebViewUrl(null);
                  if (accountId) {
                    setTeamSettingsAndSync({ stripeAccountId: accountId, stripeOnboardingComplete: true });
                  }
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Stripe Connected!', 'Your Stripe account is linked. Players can now pay dues directly in the app.', [{ text: 'Done' }]);
                } else if (url.includes('stripe-connect-cancel')) {
                  setWebViewUrl(null);
                }
                return false; // Block the WebView from navigating to the deep link
              }
              return true;
            }}
            onNavigationStateChange={(navState) => {
              const url = navState.url ?? '';
              if (url.includes('stripe-connect-success')) {
                const match = url.match(/accountId=([^&]+)/);
                const accountId = match?.[1];
                setWebViewUrl(null);
                if (accountId) {
                  setTeamSettingsAndSync({ stripeAccountId: accountId, stripeOnboardingComplete: true });
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Stripe Connected!', 'Your Stripe account is linked. Players can now pay dues directly in the app.', [{ text: 'Done' }]);
              } else if (url.includes('stripe-connect-cancel')) {
                setWebViewUrl(null);
              }
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator color="#635BFF" size="large" />
                <Text style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>Loading Stripe...</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 'auto' }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color="#94a3b8" />
            <Text style={{ color: '#94a3b8', fontSize: 16, marginLeft: 2 }}>Admin</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 8, flex: 1 }}>
          {/* Title block */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: '#635BFF20', borderRadius: 12, padding: 10, marginRight: 14 }}>
              <CreditCard size={26} color="#635BFF" />
            </View>
            <View>
              <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Stripe Payments</Text>
              <Text style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>{teamName}</Text>
            </View>
          </View>

          {/* Status banner */}
          {isConnected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#22c55e18', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 20, marginBottom: 8, borderWidth: 1, borderColor: '#22c55e30' }}>
              <CheckCircle2 size={20} color="#22c55e" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#22c55e', fontWeight: '600', fontSize: 15 }}>Stripe Connected</Text>
                <Text style={{ color: '#4ade80', fontSize: 12, marginTop: 2 }}>{teamSettings.stripeAccountId}</Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f59e0b18', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 20, marginBottom: 8, borderWidth: 1, borderColor: '#f59e0b30' }}>
              <AlertCircle size={20} color="#f59e0b" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#f59e0b', fontWeight: '600', fontSize: 15 }}>Setup Required</Text>
                <Text style={{ color: '#fbbf24', fontSize: 12, marginTop: 2 }}>Connect a Stripe account to accept payments</Text>
              </View>
            </View>
          )}

          {/* Info rows */}
          <View style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginTop: 20, marginBottom: 24, borderWidth: 1, borderColor: '#334155' }}>
            {[
              { label: 'Players pay dues directly in the app', sub: 'No more chasing payments' },
              { label: 'Funds deposited to your bank account', sub: 'Via your connected Stripe account' },
              { label: 'Stripe processing fee applies', sub: '2.9% + 30¢ per transaction, billed by Stripe' },
              { label: 'Small platform fee', sub: '0.5% per transaction' },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < 3 ? 14 : 0 }}>
                <Zap size={14} color="#635BFF" style={{ marginTop: 2 }} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '500' }}>{item.label}</Text>
                  <Text style={{ color: '#64748b', fontSize: 12, marginTop: 1 }}>{item.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          {isConnected ? (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={handleConnect}
                disabled={isLoading}
                style={{ borderRadius: 16, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={['#635BFF', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                >
                  {isLoading ? <ActivityIndicator color="white" size="small" /> : (
                    <>
                      <CreditCard size={17} color="white" />
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>Re-connect Stripe Account</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={handleDisconnect}
                style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: '#ef444415', borderWidth: 1, borderColor: '#ef444430' }}
              >
                <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 15 }}>Disconnect Stripe</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleConnect}
              disabled={isLoading}
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#635BFF', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
              >
                {isLoading ? <ActivityIndicator color="white" size="small" /> : (
                  <>
                    <CreditCard size={17} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>Connect with Stripe</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
