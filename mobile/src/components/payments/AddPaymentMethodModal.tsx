import { View, Text, Pressable, TextInput, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTeamStore, PaymentApp, PaymentMethod } from '@/lib/store';
import { cn } from '@/lib/cn';
import { pushTeamToSupabase } from '@/lib/realtime-sync';

const PAYMENT_APP_INFO: Record<PaymentApp, { name: string; color: string }> = {
  venmo: { name: 'Venmo', color: '#3D95CE' },
  paypal: { name: 'PayPal', color: '#003087' },
  zelle: { name: 'Zelle', color: '#6D1ED4' },
  cashapp: { name: 'Cash App', color: '#00D632' },
  applepay: { name: 'Apple Cash', color: '#000000' },
};

interface AddPaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddPaymentMethodModal({ visible, onClose }: AddPaymentMethodModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const [selectedApp, setSelectedApp] = useState<PaymentApp>('venmo');
  const [paymentUsername, setPaymentUsername] = useState('');
  const [paymentDisplayName, setPaymentDisplayName] = useState('');

  const paymentMethods = teamSettings.paymentMethods ?? [];

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

  const handleAddPaymentMethod = () => {
    if (!paymentUsername.trim()) {
      Alert.alert('Missing Info', 'Please enter the username, email, or phone number for this payment method.');
      return;
    }

    const newMethod: PaymentMethod = {
      app: selectedApp,
      username: paymentUsername.trim(),
      displayName: paymentDisplayName.trim() || PAYMENT_APP_INFO[selectedApp].name,
    };

    setTeamSettingsAndSync({
      paymentMethods: [...paymentMethods, newMethod],
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPaymentUsername('');
    setPaymentDisplayName('');
    onClose();
  };

  const handleClose = () => {
    setPaymentUsername('');
    setPaymentDisplayName('');
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
            <Text className="text-white text-lg font-semibold">Add Payment Method</Text>
            <Pressable onPress={handleAddPaymentMethod}>
              <Text className="text-cyan-400 font-semibold">Add</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 pt-6">
            <Text className="text-slate-400 text-sm mb-3">Select App</Text>
            <View className="flex-row mb-6">
              {(Object.keys(PAYMENT_APP_INFO) as PaymentApp[]).map((app) => (
                <Pressable
                  key={app}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedApp(app);
                  }}
                  className={cn(
                    'flex-1 py-3 rounded-xl mr-2 items-center border',
                    selectedApp === app
                      ? 'border-cyan-500'
                      : 'bg-slate-800 border-slate-700'
                  )}
                  style={selectedApp === app ? { backgroundColor: PAYMENT_APP_INFO[app].color + '30' } : undefined}
                >
                  <Text
                    className={cn('font-medium', selectedApp === app ? 'text-white' : 'text-slate-400')}
                  >
                    {PAYMENT_APP_INFO[app].name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">
                {selectedApp === 'venmo' ? 'Venmo Username' :
                 selectedApp === 'paypal' ? 'PayPal.me Username' :
                 selectedApp === 'cashapp' ? 'Cash App $Cashtag' :
                 selectedApp === 'applepay' ? 'Phone Number or Email' :
                 'Zelle Email/Phone'}<Text className="text-red-400">*</Text>
              </Text>
              <TextInput
                value={paymentUsername}
                onChangeText={setPaymentUsername}
                placeholder={selectedApp === 'zelle' ? 'email@example.com' : selectedApp === 'cashapp' ? '$username' : selectedApp === 'applepay' ? '+1 555-123-4567' : '@username'}
                placeholderTextColor="#64748b"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                autoCapitalize="none"
              />
            </View>

            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Display Name (Optional)</Text>
              <TextInput
                value={paymentDisplayName}
                onChangeText={setPaymentDisplayName}
                placeholder="e.g., Team Treasurer"
                placeholderTextColor="#64748b"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
              />
            </View>

            <Text className="text-slate-500 text-xs mb-3"><Text className="text-red-400">*</Text> Required</Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
