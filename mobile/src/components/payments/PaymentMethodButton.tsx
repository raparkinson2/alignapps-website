import { Pressable, Text, Linking, Alert } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { PaymentMethod, PaymentApp } from '@/lib/store';

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
    urlScheme: (_username) => `messages://`,
  },
};

interface PaymentMethodButtonProps {
  method: PaymentMethod;
  amount?: number;
}

export function PaymentMethodButton({ method, amount }: PaymentMethodButtonProps) {
  const info = PAYMENT_APP_INFO[method.app];

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = info.urlScheme(method.username, amount);

    try {
      if (method.app === 'paypal') {
        await Linking.openURL(url);
        return;
      }

      if (method.app === 'venmo' || method.app === 'cashapp') {
        try {
          await Linking.openURL(url);
        } catch {
          if (info.webFallback) {
            await Linking.openURL(info.webFallback(method.username));
          }
        }
        return;
      }

      if (method.app === 'zelle') {
        Alert.alert(
          'Zelle Payment',
          `Send payment to: ${method.username}\n\nOpen your bank app and use Zelle to send money to this recipient.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (method.app === 'applepay') {
        Alert.alert(
          'Apple Cash Payment',
          `Send payment to: ${method.username}\n\nOpen Messages and send Apple Cash to this phone number or email.`,
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error) {
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
      <Text className="text-white font-medium text-xs ml-1.5" numberOfLines={1}>
        {method.displayName || info.name}
      </Text>
    </Pressable>
  );
}
