import { View, Text, Pressable } from 'react-native';
import {
  Calendar,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Edit3,
} from 'lucide-react-native';
import { PaymentPeriod } from '@/lib/store';
import { cn } from '@/lib/cn';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { getDueDateColor } from './paymentUtils';

interface PaymentCardRowProps {
  period: PaymentPeriod;
  index: number;
  isReorderMode: boolean;
  onPress: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEditAmount: () => void;
  onEditTeamTotal: () => void;
  onEditDueDate: () => void;
  totalPeriods: number;
  isAdmin: boolean;
}

export function PaymentCardRow({
  period,
  index,
  isReorderMode,
  onPress,
  onMoveUp,
  onMoveDown,
  onEditAmount,
  onEditTeamTotal,
  onEditDueDate,
  totalPeriods,
  isAdmin,
}: PaymentCardRowProps) {
  const paidCount = period.playerPayments.filter((pp) => pp.status === 'paid').length;
  const totalCount = period.playerPayments.length;

  // Calculate total collected from all player payments
  const totalCollected = period.playerPayments.reduce((sum, pp) => sum + (pp.amount ?? 0), 0);

  // Always auto-calculate team total based on players × amount per player
  const teamTotalOwed = totalCount * period.amount;
  const remainingBalance = teamTotalOwed - totalCollected;

  return (
    <View className="flex-row items-center mb-3">
      {/* Reorder controls */}
      {isReorderMode && (
        <View className="mr-3 items-center">
          <Pressable
            onPress={onMoveUp}
            className={cn(
              'p-1.5 rounded-lg mb-1',
              index === 0 ? 'opacity-30' : 'bg-slate-700 active:bg-slate-600'
            )}
            disabled={index === 0}
          >
            <ChevronUp size={18} color="#a78bfa" />
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            className={cn(
              'p-1.5 rounded-lg',
              index === totalPeriods - 1 ? 'opacity-30' : 'bg-slate-700 active:bg-slate-600'
            )}
            disabled={index === totalPeriods - 1}
          >
            <ChevronDown size={18} color="#a78bfa" />
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={() => !isReorderMode && onPress()}
        className={cn(
          'flex-1 bg-slate-800/80 rounded-xl p-4 border border-slate-700/50',
          !isReorderMode && 'active:bg-slate-700/80'
        )}
      >
        {/* Title and Due Date Row */}
        <View className="flex-row items-start justify-between mb-3">
          <Text className="text-white font-semibold text-lg">{period.title}</Text>
          {isAdmin && !isReorderMode && (
            period.dueDate ? (() => {
              const allPaid = paidCount === totalCount;
              const dueDateColor = getDueDateColor(period.dueDate, allPaid);
              return (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onEditDueDate();
                  }}
                  className="flex-row items-center py-1 active:opacity-70"
                >
                  <Calendar size={14} color={dueDateColor.hex} />
                  <Text className={cn('text-sm font-medium ml-1.5', dueDateColor.text)}>
                    Due {format(parseISO(period.dueDate), 'MMMM d, yyyy')}
                  </Text>
                </Pressable>
              );
            })() : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onEditDueDate();
                }}
                className="flex-row items-center py-1 active:opacity-70"
              >
                <Calendar size={14} color="#64748b" />
                <Text className="text-slate-500 text-sm ml-1.5">Add due date</Text>
              </Pressable>
            )
          )}
          {!isAdmin && period.dueDate && (() => {
            const allPaid = paidCount === totalCount;
            const dueDateColor = getDueDateColor(period.dueDate, allPaid);
            return (
              <View className="flex-row items-center">
                <Calendar size={14} color={dueDateColor.hex} />
                <Text className={cn('text-sm font-medium ml-1.5', dueDateColor.text)}>
                  Due {format(parseISO(period.dueDate), 'MMMM d, yyyy')}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Team Total Owed - Admin Only */}
        {isAdmin && !isReorderMode && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onEditTeamTotal();
            }}
            className={cn(
              "rounded-lg p-3.5 mb-3 border active:opacity-80",
              remainingBalance <= 0
                ? "bg-green-500/10 border-green-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            )}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className={cn(
                  "text-sm",
                  remainingBalance <= 0 ? "text-green-400/70" : "text-amber-400/70"
                )}>Team Total</Text>
                <Text className={cn(
                  "text-lg font-semibold",
                  remainingBalance <= 0 ? "text-green-400" : "text-amber-400"
                )}>${teamTotalOwed.toLocaleString()}</Text>
              </View>
              <View>
                <Text className="text-slate-500 text-sm">Collected</Text>
                <Text className="text-green-400/90 text-lg font-semibold">${totalCollected.toLocaleString()}</Text>
              </View>
              <View>
                <Text className="text-slate-500 text-sm">Remaining</Text>
                <Text className={cn(
                  'text-lg font-semibold',
                  remainingBalance <= 0 ? 'text-green-400' : 'text-red-400/90'
                )}>
                  ${Math.max(0, remainingBalance).toLocaleString()}
                </Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Amount and Progress Row */}
        <View className="flex-row items-center justify-between">
          <View>
            <View className="flex-row items-center">
              <Text className="text-green-400 font-bold">${period.amount}</Text>
              <Text className="text-slate-500 text-xs ml-1">per player</Text>
            </View>
            {isAdmin && !isReorderMode && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onEditAmount();
                }}
                className="mt-2 rounded-lg py-1 flex-row items-center"
              >
                <Edit3 size={12} color="#22c55e" />
                <Text className="text-green-500 text-xs ml-1">Edit</Text>
              </Pressable>
            )}
          </View>
          <View className="items-end">
            <View className="flex-row items-center">
              <Text className="text-slate-400 text-sm mr-2">
                {paidCount}/{totalCount} paid
              </Text>
              {!isReorderMode && <ChevronRight size={18} color="#64748b" />}
            </View>
            <View className="w-24 h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
              <View
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${totalCount > 0 ? (paidCount / totalCount) * 100 : 0}%` }}
              />
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
