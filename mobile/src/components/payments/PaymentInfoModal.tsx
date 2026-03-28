import { View, Text, Pressable, Modal } from 'react-native';
import { Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface PaymentInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PaymentInfoModal({ visible, onClose }: PaymentInfoModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/70 justify-center items-center px-6"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm"
        >
          <View className="flex-row items-center mb-4">
            <Info size={20} color="#a78bfa" />
            <Text className="text-white font-bold text-lg ml-2">Payment Tracking Notice</Text>
          </View>

          <Text className="text-slate-300 text-sm mb-4">
            ALIGN Sports tracks team balances for record-keeping only. Payments are not processed in-app.
          </Text>

          <Text className="text-slate-300 text-sm mb-4">
            All payments are handled externally (for example, through Venmo or other payment platforms). Payment links are provided for convenience only.
          </Text>

          <Text className="text-slate-300 text-sm font-medium mb-2">
            ALIGN Sports does not collect, process, or store:
          </Text>
          <View className="mb-4 ml-2">
            <Text className="text-slate-300 text-sm">• Credit or debit card numbers</Text>
            <Text className="text-slate-300 text-sm">• Bank account information</Text>
            <Text className="text-slate-300 text-sm">• Payment login credentials</Text>
            <Text className="text-slate-300 text-sm">• Payer financial details</Text>
          </View>

          <Text className="text-slate-300 text-sm mb-4">
            If a payment method is added, only the payee's public username (such as a Venmo handle) is stored. This can be removed at any time in the Payments section of the app.
          </Text>

          <Text className="text-slate-300 text-sm italic mb-4">
            Payer details are never stored by ALIGN Sports.
          </Text>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            className="bg-purple-500 py-3 rounded-xl items-center active:bg-purple-600"
          >
            <Text className="text-white font-semibold">Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
