import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  DollarSign,
  ChevronRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Calendar,
} from 'lucide-react-native';
import { useTeamStore, PaymentPeriod, PlayerPayment, getPlayerName } from '@/lib/store';
import { cn } from '@/lib/cn';
import { getDueDateColor } from './paymentUtils';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';

interface PlayerPaymentStatusProps {
  myPaymentStatus: { period: PaymentPeriod; payment: PlayerPayment | undefined }[];
  onSelectPeriod: (periodId: string) => void;
}

export function PlayerPaymentStatus({ myPaymentStatus, onSelectPeriod }: PlayerPaymentStatusProps) {
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  return (
    <Animated.View entering={FadeInDown.delay(150).springify()}>
      <View className="flex-row items-center mb-3">
        <DollarSign size={16} color="#22c55e" />
        <Text className="text-green-400 font-semibold ml-2">My Payment Status</Text>
      </View>

      {myPaymentStatus.map(({ period, payment }, index) => (
        <Animated.View
          key={period.id}
          entering={FadeInDown.delay(200 + index * 50).springify()}
        >
          <Pressable
            onPress={() => {
              onSelectPeriod(period.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={cn(
              'rounded-xl p-4 mb-3 border active:opacity-80',
              payment?.status === 'paid' ? 'bg-green-500/20 border-green-500/30' :
              payment?.status === 'partial' ? 'bg-amber-500/20 border-amber-500/30' :
              'bg-slate-800/80 border-slate-700/50'
            )}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white font-semibold text-lg">{period.title}</Text>
                <Text className="text-slate-400 text-sm">Amount Due: ${period.amount}</Text>
                {period.dueDate && (() => {
                  const allPaid = payment?.status === 'paid';
                  const dueDateColor = getDueDateColor(period.dueDate, allPaid);
                  return (
                    <View className="flex-row items-center mt-1">
                      <Calendar size={14} color={dueDateColor.hex} />
                      <Text className={cn('text-sm font-medium ml-1.5', dueDateColor.text)}>
                        Due {format(parseISO(period.dueDate), 'MMMM d, yyyy')}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <View className="items-end">
                {payment?.status === 'paid' ? (
                  <>
                    <CheckCircle2 size={28} color="#22c55e" />
                    <Text className="text-green-400 font-semibold mt-1">Paid</Text>
                  </>
                ) : payment?.status === 'partial' ? (
                  <>
                    <AlertCircle size={28} color="#f59e0b" />
                    <Text className="text-amber-400 font-semibold mt-1">
                      ${payment.amount ?? 0} / ${period.amount}
                    </Text>
                  </>
                ) : (
                  <>
                    <Circle size={28} color="#64748b" />
                    <Text className="text-slate-400 font-semibold mt-1">Unpaid</Text>
                  </>
                )}
              </View>
              <ChevronRight size={20} color="#64748b" className="ml-2" />
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </Animated.View>
  );
}
