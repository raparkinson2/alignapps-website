import { View, Text, Pressable } from 'react-native';
import { ChevronRight, CheckCircle2, Circle, AlertCircle } from 'lucide-react-native';
import { Player, PaymentPeriodType, getPlayerName } from '@/lib/store';
import { cn } from '@/lib/cn';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface PlayerPaymentRowProps {
  player: Player;
  status: 'unpaid' | 'paid' | 'partial';
  paidAmount?: number;
  totalAmount: number;
  periodType: PaymentPeriodType;
  onPress: () => void;
  isOverdue?: boolean;
  daysOverdue?: number;
}

export function PlayerPaymentRow({ player, status, paidAmount, totalAmount, periodType, onPress, isOverdue, daysOverdue }: PlayerPaymentRowProps) {
  const balance = totalAmount - (paidAmount ?? 0);
  const isDuesType = periodType === 'league_dues';
  const progressPercent = totalAmount > 0 ? Math.min(100, ((paidAmount ?? 0) / totalAmount) * 100) : 0;
  const showOverdue = isOverdue && status !== 'paid';

  // For non-dues types, show amount paid instead of balance
  const getStatusText = () => {
    if (isDuesType) {
      // Dues: show balance remaining (emphasis on remaining)
      if (status === 'paid') return `Paid $${(paidAmount ?? totalAmount).toFixed(2)}`;
      if (status === 'partial') return `$${balance.toFixed(2)} remaining · $${(paidAmount ?? 0).toFixed(2)} paid`;
      return `$${totalAmount.toFixed(2)} remaining`;
    } else {
      // Non-dues: show paid vs total
      if (status === 'paid') return `$${(paidAmount ?? totalAmount).toFixed(2)} paid`;
      if (status === 'partial') return `$${(paidAmount ?? 0).toFixed(2)} paid · $${balance.toFixed(2)} remaining`;
      return 'No payment yet';
    }
  };

  // For non-dues types, different styling logic
  const getBackgroundClass = () => {
    if (status === 'paid') return 'bg-green-500/20';
    if (status === 'partial') return 'bg-amber-500/20';
    return 'bg-slate-800/60';
  };

  const getTextClass = () => {
    if (status === 'paid') return 'text-green-400';
    if (showOverdue) return 'text-red-400';
    if (status === 'partial') return 'text-amber-400';
    return 'text-slate-400';
  };

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center p-4 rounded-xl active:opacity-80',
        getBackgroundClass(),
        showOverdue && 'border-l-4 border-l-red-500'
      )}
    >
      <PlayerAvatar player={player} size={44} />
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="text-white font-medium text-base">{getPlayerName(player)}</Text>
          {showOverdue && (
            <View className="ml-2 bg-red-500 rounded px-1.5 py-0.5">
              <Text className="text-white text-xs font-semibold">
                {daysOverdue === 0 ? 'Due Today' : `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`}
              </Text>
            </View>
          )}
        </View>
        <Text className={cn('text-sm mt-0.5', getTextClass())}>
          {getStatusText()}
        </Text>
        {/* Progress bar for partial payments */}
        {status === 'partial' && (
          <View className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
            <View
              className={cn("h-full rounded-full", showOverdue ? "bg-red-500" : "bg-amber-500")}
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        )}
      </View>

      <View className="items-end">
        {status === 'paid' ? (
          <CheckCircle2 size={28} color="#22c55e" />
        ) : showOverdue ? (
          <AlertCircle size={28} color="#ef4444" />
        ) : status === 'partial' ? (
          <AlertCircle size={28} color="#f59e0b" />
        ) : (
          <Circle size={28} color="#64748b" />
        )}
      </View>
      <ChevronRight size={20} color="#64748b" className="ml-2" />
    </Pressable>
  );
}
