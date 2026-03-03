import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  DollarSign,
  Plus,
  X,
  Check,
  ChevronRight,
  CreditCard,
  Users,
  CheckCircle2,
  Circle,
  AlertCircle,
  Trash2,
  ExternalLink,
  Calendar,
  ChevronLeft,
  Edit3,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Info,
  Zap,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';
import {
  useTeamStore,
  PaymentPeriod,
  PaymentPeriodType,
  PaymentMethod,
  PaymentApp,
  Player,
  PaymentEntry,
  PlayerPayment,
  getPlayerName,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { format, parseISO, differenceInDays } from 'date-fns';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { pushPaymentPeriodToSupabase, pushTeamToSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';

// Helper to calculate correct payment status from actual payment amounts
const calculatePaymentStatus = (paidAmount: number | undefined, periodAmount: number): 'paid' | 'partial' | 'unpaid' => {
  const paid = paidAmount ?? 0;
  if (paid >= periodAmount) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
};

// Helper to get due date color based on urgency
const getDueDateColor = (dueDate: string, allPaid: boolean): { text: string; hex: string } => {
  if (allPaid) {
    return { text: 'text-green-400', hex: '#4ade80' };
  }

  const now = new Date();
  const due = parseISO(dueDate);
  const daysUntilDue = differenceInDays(due, now);

  if (daysUntilDue <= 0) {
    // Past due or due today
    return { text: 'text-red-500', hex: '#ef4444' };
  } else if (daysUntilDue < 15) {
    return { text: 'text-red-500', hex: '#ef4444' };
  } else if (daysUntilDue < 30) {
    return { text: 'text-orange-500', hex: '#f97316' };
  } else if (daysUntilDue < 45) {
    return { text: 'text-yellow-500', hex: '#eab308' };
  }
  return { text: 'text-slate-400', hex: '#94a3b8' };
};

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
      className="flex-row items-center justify-center py-2 px-3 rounded-lg active:opacity-80"
      style={{ backgroundColor: info.color }}
    >
      <ExternalLink size={12} color="white" />
      <Text className="text-white font-medium text-xs ml-1.5">{method.displayName || info.name}</Text>
    </Pressable>
  );
}

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

function PlayerPaymentRow({ player, status, paidAmount, totalAmount, periodType, onPress, isOverdue, daysOverdue }: PlayerPaymentRowProps) {
  const balance = totalAmount - (paidAmount ?? 0);
  const isDuesType = periodType === 'league_dues';
  const progressPercent = totalAmount > 0 ? Math.min(100, ((paidAmount ?? 0) / totalAmount) * 100) : 0;
  const showOverdue = isOverdue && status !== 'paid';

  // For non-dues types, show amount paid instead of balance
  const getStatusText = () => {
    if (isDuesType) {
      // Dues: show balance remaining (emphasis on remaining)
      if (status === 'paid') return `Paid $${paidAmount ?? totalAmount}`;
      if (status === 'partial') return `$${balance} remaining · $${paidAmount ?? 0} paid`;
      return `$${totalAmount} remaining`;
    } else {
      // Non-dues: show paid vs total
      if (status === 'paid') return `$${paidAmount ?? totalAmount} paid`;
      if (status === 'partial') return `$${paidAmount ?? 0} paid · $${balance} remaining`;
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

interface SwipeablePlayerPaymentRowProps extends PlayerPaymentRowProps {
  onDelete?: () => void;
  canDelete?: boolean;
}

function SwipeablePlayerPaymentRow({
  onDelete,
  canDelete = false,
  ...rowProps
}: SwipeablePlayerPaymentRowProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete?.();
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (!canDelete) return;
      // Only allow swiping left (negative values)
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -100);
      } else {
        translateX.value = withSpring(0);
      }
    })
    .onEnd((event) => {
      if (!canDelete) return;
      if (event.translationX < DELETE_THRESHOLD) {
        // Keep it open at delete position
        translateX.value = withSpring(-80);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 40),
  }));

  if (!canDelete) {
    return (
      <View className="mb-2">
        <PlayerPaymentRow {...rowProps} />
      </View>
    );
  }

  return (
    <View className="relative mb-2 overflow-hidden rounded-xl">
      {/* Delete button behind */}
      <Animated.View
        style={[deleteButtonStyle]}
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 items-center justify-center"
      >
        <Pressable
          onPress={handleDelete}
          className="flex-1 w-full items-center justify-center"
        >
          <Trash2 size={24} color="white" />
          <Text className="text-white text-xs font-medium mt-1">Delete</Text>
        </Pressable>
      </Animated.View>

      {/* Swipeable row */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <PlayerPaymentRow {...rowProps} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface SwipeablePaymentPeriodRowProps {
  period: PaymentPeriod;
  index: number;
  isReorderMode: boolean;
  onPress: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEditAmount: () => void;
  onEditTeamTotal: () => void;
  onEditDueDate: () => void;
  totalPeriods: number;
  isAdmin: boolean;
}

function SwipeablePaymentPeriodRow({
  period,
  index,
  isReorderMode,
  onPress,
  onDelete,
  onMoveUp,
  onMoveDown,
  onEditAmount,
  onEditTeamTotal,
  onEditDueDate,
  totalPeriods,
  isAdmin,
}: SwipeablePaymentPeriodRowProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const paidCount = period.playerPayments.filter((pp) => pp.status === 'paid').length;
  const totalCount = period.playerPayments.length;

  // Calculate total collected from all player payments
  const totalCollected = period.playerPayments.reduce((sum, pp) => sum + (pp.amount ?? 0), 0);

  // Always auto-calculate team total based on players × amount per player
  const teamTotalOwed = totalCount * period.amount;
  const remainingBalance = teamTotalOwed - totalCollected;

  const handleDelete = () => {
    translateX.value = withSpring(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  const panGesture = Gesture.Pan()
    .enabled(isAdmin && !isReorderMode)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -100);
      } else {
        translateX.value = withSpring(0);
      }
    })
    .onEnd((event) => {
      if (event.translationX < DELETE_THRESHOLD) {
        translateX.value = withSpring(-80);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 40),
  }));

  const rowContent = (
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

  if (!isAdmin || isReorderMode) {
    return rowContent;
  }

  return (
    <View className="relative overflow-hidden rounded-xl mb-3">
      {/* Delete button behind */}
      <Animated.View
        style={[deleteButtonStyle]}
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 items-center justify-center rounded-r-xl"
      >
        <Pressable
          onPress={handleDelete}
          className="flex-1 w-full items-center justify-center"
        >
          <Trash2 size={24} color="white" />
          <Text className="text-white text-xs font-medium mt-1">Delete</Text>
        </Pressable>
      </Animated.View>

      {/* Swipeable row */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          {rowContent}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface StripePayButtonProps {
  myPaymentStatus: { period: PaymentPeriod; payment: PlayerPayment | undefined }[];
  isStripeLoading: boolean;
  onPay: (period: PaymentPeriod, playerId: string) => void;
}

function StripePayButton({ myPaymentStatus, isStripeLoading, onPay }: StripePayButtonProps) {
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const [showPicker, setShowPicker] = useState(false);

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
                        {payment?.status === 'partial' ? `$${payment.amount ?? 0} paid · $${balance} remaining` : `$${balance} due`}
                      </Text>
                    </View>
                    <LinearGradient
                      colors={['#635BFF', '#7C3AED']}
                      style={{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Pay ${balance}</Text>
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
  const addPaymentPeriod = useTeamStore((s) => s.addPaymentPeriod);
  const removePaymentPeriod = useTeamStore((s) => s.removePaymentPeriod);
  const addPaymentEntry = useTeamStore((s) => s.addPaymentEntry);
  const removePaymentEntry = useTeamStore((s) => s.removePaymentEntry);
  const updatePaymentPeriod = useTeamStore((s) => s.updatePaymentPeriod);
  const reorderPaymentPeriods = useTeamStore((s) => s.reorderPaymentPeriods);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamName = useTeamStore((s) => s.teamName);

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
  const canManageTeam = useTeamStore((s) => s.canManageTeam);

  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isPaymentMethodModalVisible, setIsPaymentMethodModalVisible] = useState(false);
  const [isNewPeriodModalVisible, setIsNewPeriodModalVisible] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  // Add payment entry form
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentDate, setNewPaymentDate] = useState(new Date());
  const [newPaymentNote, setNewPaymentNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Payment method form
  const [selectedApp, setSelectedApp] = useState<PaymentApp>('venmo');
  const [paymentUsername, setPaymentUsername] = useState('');
  const [paymentDisplayName, setPaymentDisplayName] = useState('');

  // New period form
  const [periodTitle, setPeriodTitle] = useState('');
  const [periodAmount, setPeriodAmount] = useState('');
  const [periodType, setPeriodType] = useState<PaymentPeriodType>('league_dues');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [periodDueDate, setPeriodDueDate] = useState<Date | null>(null);
  const [showPeriodDueDatePicker, setShowPeriodDueDatePicker] = useState(false);

  // Edit period amount
  const [isEditAmountModalVisible, setIsEditAmountModalVisible] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editPeriodAmount, setEditPeriodAmount] = useState('');

  // Team total amount owed (admin only) - tied to a specific period
  const [isEditTeamTotalModalVisible, setIsEditTeamTotalModalVisible] = useState(false);
  const [editTeamTotalAmount, setEditTeamTotalAmount] = useState('');
  const [editingTeamTotalPeriodId, setEditingTeamTotalPeriodId] = useState<string | null>(null);

  // Edit due date
  const [isEditDueDateVisible, setIsEditDueDateVisible] = useState(false);
  const [editDueDate, setEditDueDate] = useState<Date | null>(null);
  const [showEditDueDatePicker, setShowEditDueDatePicker] = useState(false);

  // Add player to period modal
  const [isAddPlayerModalVisible, setIsAddPlayerModalVisible] = useState(false);

  // Payment info modal
  const [isPaymentInfoModalVisible, setIsPaymentInfoModalVisible] = useState(false);

  // Stripe disclosure modal
  const [isStripeDisclosureVisible, setIsStripeDisclosureVisible] = useState(false);

  // Stripe checkout state
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [isStripeLoading, setIsStripeLoading] = useState(false);

  // Responsive layout for iPad
  const { isTablet, columns, containerPadding } = useResponsive();

  const paymentMethods = teamSettings.paymentMethods ?? [];

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
    setIsPaymentMethodModalVisible(false);
  };

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

  const handleCreatePeriod = () => {
    if (!periodTitle.trim() || !periodAmount.trim()) return;
    if (selectedPlayerIds.length === 0) {
      Alert.alert('No Players Selected', 'Please select at least one player for this payment period.');
      return;
    }

    const newPeriod: PaymentPeriod = {
      id: Date.now().toString(),
      title: periodTitle.trim(),
      amount: parseFloat(periodAmount),
      type: periodType,
      dueDate: periodDueDate ? periodDueDate.toISOString() : undefined,
      playerPayments: selectedPlayerIds.map((playerId) => ({
        playerId,
        status: 'unpaid' as const,
        entries: [],
      })),
      createdAt: new Date().toISOString(),
    };

    addPaymentPeriod(newPeriod);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushPaymentPeriodToSupabase(newPeriod, activeTeamId).catch(console.error);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPeriodTitle('');
    setPeriodAmount('');
    setPeriodType('league_dues');
    setSelectedPlayerIds([]);
    setPeriodDueDate(null);
    setShowPeriodDueDatePicker(false);
    setIsNewPeriodModalVisible(false);
  };

  const handleUpdatePeriodAmount = () => {
    if (!editingPeriodId || !editPeriodAmount.trim()) return;
    const amount = parseFloat(editPeriodAmount);
    if (isNaN(amount) || amount <= 0) return;

    updatePaymentPeriodAndSync(editingPeriodId, {
      amount,
      dueDate: editDueDate ? editDueDate.toISOString() : undefined
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditAmountModalVisible(false);
    setEditingPeriodId(null);
    setEditPeriodAmount('');
    setEditDueDate(null);
  };

  const handleUpdateTeamTotalAmount = () => {
    if (!editingTeamTotalPeriodId) return;

    if (!editTeamTotalAmount.trim()) {
      // Allow clearing the amount
      updatePaymentPeriodAndSync(editingTeamTotalPeriodId, { teamTotalOwed: undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditTeamTotalModalVisible(false);
      setEditTeamTotalAmount('');
      setEditingTeamTotalPeriodId(null);
      return;
    }
    const amount = parseFloat(editTeamTotalAmount);
    if (isNaN(amount) || amount < 0) return;

    updatePaymentPeriodAndSync(editingTeamTotalPeriodId, { teamTotalOwed: amount });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditTeamTotalModalVisible(false);
    setEditTeamTotalAmount('');
    setEditingTeamTotalPeriodId(null);
  };

  const handleAddPaymentEntry = () => {
    if (!selectedPeriodId || !selectedPlayerId || !newPaymentAmount.trim()) return;
    const amount = parseFloat(newPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const entry: PaymentEntry = {
      id: Date.now().toString(),
      amount,
      date: newPaymentDate.toISOString(),
      note: newPaymentNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    addPaymentEntry(selectedPeriodId, selectedPlayerId, entry);

    // Sync to Supabase so other team members see the update
    if (activeTeamId) {
      // Use a small delay to let the store update first
      setTimeout(() => {
        const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === selectedPeriodId);
        if (updated) {
          pushPaymentPeriodToSupabase(updated, activeTeamId).catch(console.error);
        }
      }, 50);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewPaymentAmount('');
    setNewPaymentNote('');
    setNewPaymentDate(new Date());
  };

  const handleDeletePaymentEntry = (entryId: string) => {
    if (!selectedPeriodId || !selectedPlayerId) return;
    const periodIdSnapshot = selectedPeriodId;
    Alert.alert(
      'Delete Payment',
      'Are you sure you want to delete this payment entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removePaymentEntry(periodIdSnapshot, selectedPlayerId, entryId);
            // Sync to Supabase after removal
            if (activeTeamId) {
              setTimeout(() => {
                const updated = useTeamStore.getState().paymentPeriods.find((p) => p.id === periodIdSnapshot);
                if (updated) {
                  pushPaymentPeriodToSupabase(updated, activeTeamId).catch(console.error);
                }
              }, 50);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Launch Stripe Checkout in a WebView modal
  const handleStripePayment = async (period: PaymentPeriod, playerId: string) => {
    const balance = period.amount - (period.playerPayments.find(pp => pp.playerId === playerId)?.amount ?? 0);
    if (balance <= 0) return;

    setIsStripeLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const player = players.find(p => p.id === playerId);
      const amountInCents = Math.round(balance * 100);

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
          successUrl: 'vibecode://payment-success',
          cancelUrl: 'vibecode://payment-cancel',
        }),
      });

      const data = await res.json() as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Could not create checkout session');
      }

      setStripeCheckoutUrl(data.url);
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

  const selectedPeriod = paymentPeriods.find((p) => p.id === selectedPeriodId);
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const selectedPlayerPayment = selectedPeriod?.playerPayments.find((pp) => pp.playerId === selectedPlayerId);

  const handleAddPlayerToPeriod = (playerId: string) => {
    if (!selectedPeriodId || !selectedPeriod) return;

    // Check if player already in period
    if (selectedPeriod.playerPayments.some((pp) => pp.playerId === playerId)) {
      return;
    }

    const updatedPayments = [
      ...selectedPeriod.playerPayments,
      {
        playerId,
        status: 'unpaid' as const,
        entries: [],
      },
    ];

    updatePaymentPeriodAndSync(selectedPeriodId, { playerPayments: updatedPayments });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemovePlayerFromPeriod = (playerId: string) => {
    if (!selectedPeriodId || !selectedPeriod) return;

    const player = players.find((p) => p.id === playerId);
    const playerPayment = selectedPeriod.playerPayments.find((pp) => pp.playerId === playerId);

    // Warn if player has made payments
    const hasPayments = playerPayment?.entries && playerPayment.entries.length > 0;

    Alert.alert(
      'Remove Player',
      hasPayments
        ? `${getPlayerName(player!)} has payment records. Removing them will delete their payment history for this period. Are you sure?`
        : `Remove ${getPlayerName(player!)} from this payment period?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedPayments = selectedPeriod.playerPayments.filter(
              (pp) => pp.playerId !== playerId
            );
            updatePaymentPeriodAndSync(selectedPeriodId, { playerPayments: updatedPayments });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Get players not in current period
  const playersNotInPeriod = selectedPeriod
    ? players.filter((p) => !selectedPeriod.playerPayments.some((pp) => pp.playerId === p.id))
    : [];

  // Check if current user can view this player's details (admin only for other players)
  const canViewPlayerDetails = (playerId: string) => {
    return isAdmin() || playerId === currentPlayerId;
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
          <View className="flex-row items-center">
            <DollarSign size={20} color="#22c55e" />
            <Text className="text-green-500 text-sm font-medium ml-2">Payments</Text>
          </View>
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

            <View className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/40">
              <StripePayButton
                myPaymentStatus={myPaymentStatus}
                isStripeLoading={isStripeLoading}
                onPay={handleStripePayment}
              />
              {/* Fee disclosure row */}
              <View className="flex-row items-center px-4 py-2.5 border-t border-slate-700/40">
                <Info size={12} color="#475569" />
                <Text className="text-slate-500 text-xs ml-2">
                  Stripe processing fee applies · Card info never stored by Align Sports
                </Text>
              </View>
            </View>
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
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {paymentMethods.map((method, index) => (
                    <View key={index} className="relative" style={{ marginTop: 4 }}>
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
                      <SwipeablePaymentPeriodRow
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
                          setEditPeriodAmount(period.amount.toString());
                          setEditDueDate(period.dueDate ? parseISO(period.dueDate) : null);
                          setIsEditAmountModalVisible(true);
                        }}
                        onEditTeamTotal={() => {
                          setEditingTeamTotalPeriodId(period.id);
                          setEditTeamTotalAmount(period.teamTotalOwed?.toString() || '');
                          setIsEditTeamTotalModalVisible(true);
                        }}
                        onEditDueDate={() => {
                          setSelectedPeriodId(period.id);
                          setEditDueDate(period.dueDate ? parseISO(period.dueDate) : new Date());
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
                      setSelectedPeriodId(period.id);
                      setSelectedPlayerId(currentPlayerId);
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
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add Payment Method Modal */}
      <Modal
        visible={isPaymentMethodModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsPaymentMethodModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsPaymentMethodModalVisible(false)}>
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

      {/* New Payment Period Modal */}
      <Modal
        visible={isNewPeriodModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsNewPeriodModalVisible(false);
          setSelectedPlayerIds([]);
          setPeriodDueDate(null);
          setShowPeriodDueDatePicker(false);
        }}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => {
                setIsNewPeriodModalVisible(false);
                setSelectedPlayerIds([]);
                setPeriodDueDate(null);
                setShowPeriodDueDatePicker(false);
              }}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">New Payment Period</Text>
              <Pressable onPress={handleCreatePeriod}>
                <Text className="text-cyan-400 font-semibold">Create</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
              {/* Payment Type Selector */}
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Payment Type</Text>
                {/* First row - 4 items */}
                <View className="flex-row gap-2 mb-2">
                  {([
                    { value: 'league_dues', label: 'League Dues' },
                    { value: 'substitute', label: 'Substitute' },
                    { value: 'facility_rental', label: 'Facility Rental' },
                    { value: 'equipment', label: 'Equipment' },
                  ] as { value: PaymentPeriodType; label: string }[]).map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPeriodType(option.value);
                      }}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl border items-center',
                        periodType === option.value
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-slate-800 border-slate-700'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium text-xs',
                          periodType === option.value ? 'text-cyan-400' : 'text-slate-400'
                        )}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {/* Second row - 3 items */}
                <View className="flex-row gap-2">
                  {([
                    { value: 'event', label: 'Event' },
                    { value: 'referee', label: 'Referee' },
                    { value: 'misc', label: 'Misc.' },
                  ] as { value: PaymentPeriodType; label: string }[]).map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPeriodType(option.value);
                      }}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl border items-center',
                        periodType === option.value
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-slate-800 border-slate-700'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium text-xs',
                          periodType === option.value ? 'text-cyan-400' : 'text-slate-400'
                        )}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-slate-500 text-xs mt-2">
                  {periodType === 'league_dues'
                    ? 'Dues track balance remaining until fully paid'
                    : 'This type shows total collected without a balance'}
                </Text>
              </View>

              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Title</Text>
                <TextInput
                  value={periodTitle}
                  onChangeText={setPeriodTitle}
                  placeholder="e.g., Season Dues - Spring 2025"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                />
              </View>

              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Amount ($)</Text>
                <TextInput
                  value={periodAmount}
                  onChangeText={setPeriodAmount}
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                />
              </View>

              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Due Date (optional)</Text>
                <Pressable
                  onPress={() => {
                    if (!periodDueDate) {
                      setPeriodDueDate(new Date());
                    }
                    setShowPeriodDueDatePicker(!showPeriodDueDatePicker);
                  }}
                  className="flex-row items-center justify-between bg-slate-800 rounded-xl px-4 py-3"
                >
                  <View className="flex-row items-center">
                    <Calendar size={20} color="#64748b" />
                    <Text className={periodDueDate ? "text-white ml-3" : "text-slate-500 ml-3"}>
                      {periodDueDate ? format(periodDueDate, 'MMM d, yyyy') : 'No due date'}
                    </Text>
                  </View>
                  {periodDueDate && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setPeriodDueDate(null);
                        setShowPeriodDueDatePicker(false);
                      }}
                      className="p-1"
                    >
                      <X size={18} color="#64748b" />
                    </Pressable>
                  )}
                </Pressable>
                {showPeriodDueDatePicker && periodDueDate && (
                  <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                    <DateTimePicker
                      value={periodDueDate}
                      mode="date"
                      display="inline"
                      onChange={(event, date) => {
                        if (date) setPeriodDueDate(date);
                        if (Platform.OS === 'android') setShowPeriodDueDatePicker(false);
                      }}
                      themeVariant="dark"
                      accentColor="#22c55e"
                    />
                  </View>
                )}
              </View>

              {/* Player Selection */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-slate-400 text-sm">Select Players</Text>
                  <Text className="text-cyan-400 text-sm font-medium">
                    {selectedPlayerIds.length} selected
                  </Text>
                </View>

                {/* Quick Select Buttons */}
                <View className="flex-row mb-4">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const activeIds = players.filter((p) => p.status === 'active').map((p) => p.id);
                      setSelectedPlayerIds(activeIds);
                    }}
                    className="bg-green-500/20 rounded-xl px-4 py-2 mr-2"
                  >
                    <Text className="text-green-400 font-medium">All Active</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const reserveIds = players.filter((p) => p.status === 'reserve').map((p) => p.id);
                      setSelectedPlayerIds(reserveIds);
                    }}
                    className="bg-slate-600/50 rounded-xl px-4 py-2 mr-2"
                  >
                    <Text className="text-slate-300 font-medium">All Reserve</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPlayerIds(players.map((p) => p.id));
                    }}
                    className="bg-cyan-500/20 rounded-xl px-4 py-2 mr-2"
                  >
                    <Text className="text-cyan-400 font-medium">All</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedPlayerIds([]);
                    }}
                    className="bg-slate-700/50 rounded-xl px-4 py-2"
                  >
                    <Text className="text-slate-400 font-medium">None</Text>
                  </Pressable>
                </View>

                {/* Player List */}
                {players.map((player) => {
                  const isSelected = selectedPlayerIds.includes(player.id);
                  return (
                    <Pressable
                      key={player.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (isSelected) {
                          setSelectedPlayerIds(selectedPlayerIds.filter((id) => id !== player.id));
                        } else {
                          setSelectedPlayerIds([...selectedPlayerIds, player.id]);
                        }
                      }}
                      className={cn(
                        'flex-row items-center p-3 rounded-xl mb-2 border',
                        isSelected
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-slate-800/60 border-slate-700/50'
                      )}
                    >
                      <PlayerAvatar player={player} size={40} />
                      <View className="flex-1 ml-3">
                        <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                        <Text className={cn(
                          'text-xs',
                          player.status === 'active' ? 'text-green-400' : 'text-slate-400'
                        )}>
                          {player.status === 'active' ? 'Active' : 'Reserve'} · #{player.number}
                        </Text>
                      </View>
                      <View className={cn(
                        'w-6 h-6 rounded-full border-2 items-center justify-center',
                        isSelected ? 'bg-green-500 border-green-500' : 'border-slate-500'
                      )}>
                        {isSelected && <Check size={14} color="white" />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Payment Period Detail Modal */}
      <Modal
        visible={!!selectedPeriodId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (selectedPlayerId) {
            setSelectedPlayerId(null);
          } else {
            setSelectedPeriodId(null);
          }
        }}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            {/* Show Player Detail View OR Period List */}
            {selectedPlayerId && selectedPlayer && selectedPeriod ? (
              <>
                {/* Player Detail Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                  <Pressable onPress={() => setSelectedPlayerId(null)} className="flex-row items-center">
                    <ChevronLeft size={24} color="#64748b" />
                    <Text className="text-slate-400 ml-1">Back</Text>
                  </Pressable>
                  <Text className="text-white text-lg font-semibold">Payment Details</Text>
                  <View style={{ width: 60 }} />
                </View>

                <ScrollView className="flex-1 px-5 pt-6">
                  {/* Player Info */}
                  <View className="items-center mb-6">
                    <PlayerAvatar player={selectedPlayer} size={80} />
                    <Text className="text-white text-xl font-bold mt-3">{getPlayerName(selectedPlayer)}</Text>
                    <Text className="text-slate-400">{selectedPeriod.title}</Text>
                  </View>

                  {/* Balance Summary */}
                  {(() => {
                    const isOverdue = selectedPeriod.dueDate &&
                      selectedPlayerPayment?.status !== 'paid' &&
                      differenceInDays(new Date(), parseISO(selectedPeriod.dueDate)) > 0;
                    const daysOverdue = selectedPeriod.dueDate
                      ? Math.max(0, differenceInDays(new Date(), parseISO(selectedPeriod.dueDate)))
                      : 0;
                    const balance = selectedPeriod.amount - (selectedPlayerPayment?.amount ?? 0);

                    return (
                      <View className={cn(
                        'rounded-xl p-4 mb-6',
                        selectedPlayerPayment?.status === 'paid'
                          ? 'bg-green-500/10 border border-green-500/20'
                          : isOverdue
                            ? 'bg-slate-800/50 border-l-4 border-l-red-500'
                            : selectedPlayerPayment?.status === 'partial'
                              ? 'bg-amber-500/10 border border-amber-500/20'
                              : 'bg-slate-800/50 border border-slate-700/50'
                      )}>
                        {/* Overdue Badge */}
                        {isOverdue && (
                          <View className="flex-row items-center justify-between mb-3">
                            <View className="bg-red-500 rounded px-2 py-1">
                              <Text className="text-white text-xs font-semibold">
                                {daysOverdue === 0 ? 'Due Today' : `${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue`}
                              </Text>
                            </View>
                            {selectedPeriod.dueDate && (
                              <Text className="text-slate-500 text-xs">
                                Due {format(parseISO(selectedPeriod.dueDate), 'MMM d, yyyy')}
                              </Text>
                            )}
                          </View>
                        )}

                        <View className="flex-row justify-between items-center mb-2">
                          <Text className={cn("text-sm", isOverdue ? "text-red-400/70" : "text-slate-500")}>Total Due</Text>
                          <Text className={cn("text-lg font-semibold", isOverdue ? "text-red-400" : "text-white")}>${selectedPeriod.amount}</Text>
                        </View>
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-slate-500 text-sm">Paid</Text>
                          <Text className="text-green-400/90 text-lg font-semibold">${selectedPlayerPayment?.amount ?? 0}</Text>
                        </View>

                        {/* Progress Bar */}
                        <View className="mb-2">
                          <View className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <View
                              className={cn(
                                'h-full rounded-full',
                                selectedPlayerPayment?.status === 'paid'
                                  ? 'bg-green-500'
                                  : isOverdue
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                              )}
                              style={{
                                width: `${selectedPeriod.amount > 0
                                  ? Math.min(100, ((selectedPlayerPayment?.amount ?? 0) / selectedPeriod.amount) * 100)
                                  : 0}%`
                              }}
                            />
                          </View>
                          <Text className="text-slate-600 text-xs text-center mt-1">
                            {selectedPeriod.amount > 0
                              ? Math.round(((selectedPlayerPayment?.amount ?? 0) / selectedPeriod.amount) * 100)
                              : 0}% paid
                          </Text>
                        </View>

                        <View className="h-px bg-slate-700/50 my-2" />
                        <View className="flex-row justify-between items-center">
                          <Text className="text-slate-500 text-sm">Balance</Text>
                          <Text className={cn(
                            'text-lg font-semibold',
                            balance <= 0
                              ? 'text-green-400'
                              : isOverdue
                                ? 'text-red-400'
                                : 'text-amber-400/90'
                          )}>
                            ${Math.max(0, balance)}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Stripe Pay Now Button - visible to the player when unpaid/partial */}
                  {selectedPlayerPayment?.status !== 'paid' && (
                    <Pressable
                      onPress={() => handleStripePayment(selectedPeriod, selectedPlayerId)}
                      disabled={isStripeLoading}
                      className="mb-6 rounded-2xl overflow-hidden active:opacity-85"
                    >
                      <LinearGradient
                        colors={['#635BFF', '#7A73FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {isStripeLoading ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <>
                            <Zap size={18} color="white" />
                            <Text className="text-white font-bold text-base ml-2">
                              Pay ${Math.max(0, selectedPeriod.amount - (selectedPlayerPayment?.amount ?? 0))} with Stripe
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </Pressable>
                  )}

                  {/* Add Payment Section - Admin Only */}
                  {isAdmin() && (
                    <View className="bg-slate-800/60 rounded-xl p-4 mb-6 border border-slate-700/50">
                      <Text className="text-cyan-400 font-semibold mb-3">Add Payment</Text>

                      {/* Amount and Date on one line */}
                      <View className="flex-row mb-3" style={{ gap: 10 }}>
                        <View className="flex-1">
                          <Text className="text-slate-500 text-xs mb-1.5">Amount</Text>
                          <View className="flex-row items-center bg-slate-700 rounded-lg px-3 py-2.5">
                            <Text className="text-white text-base font-semibold mr-1">$</Text>
                            <TextInput
                              value={newPaymentAmount}
                              onChangeText={setNewPaymentAmount}
                              placeholder="0.00"
                              placeholderTextColor="#64748b"
                              keyboardType="decimal-pad"
                              className="flex-1 text-white text-base font-semibold"
                            />
                          </View>
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-500 text-xs mb-1.5">Date</Text>
                          <Pressable
                            onPress={() => setShowDatePicker(!showDatePicker)}
                            className="flex-row items-center bg-slate-700 rounded-lg px-3 py-2.5"
                          >
                            <Calendar size={16} color="#64748b" />
                            <Text className="text-white text-sm ml-2">{format(newPaymentDate, 'MMM d, yyyy')}</Text>
                          </Pressable>
                        </View>
                      </View>

                      {showDatePicker && (
                        <View className="bg-slate-800 rounded-xl mb-3 overflow-hidden items-center">
                          <DateTimePicker
                            value={newPaymentDate}
                            mode="date"
                            display="inline"
                            onChange={(event, date) => {
                              if (date) setNewPaymentDate(date);
                              if (Platform.OS === 'android') setShowDatePicker(false);
                            }}
                            themeVariant="dark"
                            accentColor="#22c55e"
                          />
                        </View>
                      )}

                      {/* Note Input */}
                      <View className="mb-3">
                        <Text className="text-slate-500 text-xs mb-1.5">Note (optional)</Text>
                        <TextInput
                          value={newPaymentNote}
                          onChangeText={setNewPaymentNote}
                          placeholder="e.g., Venmo payment"
                          placeholderTextColor="#64748b"
                          className="bg-slate-700 rounded-lg px-3 py-2.5 text-white text-sm"
                        />
                      </View>

                      {/* Add Button */}
                      <Pressable
                        onPress={handleAddPaymentEntry}
                        className="bg-green-500 rounded-lg py-2.5 active:bg-green-600"
                      >
                        <Text className="text-white text-center font-semibold text-sm">Add Payment</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Payment History */}
                  <View className="mb-6">
                    <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                      Payment History
                    </Text>

                    {(selectedPlayerPayment?.entries ?? []).length === 0 ? (
                      <View className="bg-slate-800/40 rounded-xl p-6 items-center">
                        <DollarSign size={32} color="#64748b" />
                        <Text className="text-slate-400 mt-2">No payments recorded</Text>
                      </View>
                    ) : (
                      (selectedPlayerPayment?.entries ?? [])
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((entry) => (
                          <View
                            key={entry.id}
                            className="flex-row items-center bg-slate-800/60 rounded-xl p-4 mb-2 border border-slate-700/50"
                          >
                            <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center">
                              <DollarSign size={20} color="#22c55e" />
                            </View>
                            <View className="flex-1 ml-3">
                              <Text className="text-white font-semibold">${entry.amount}</Text>
                              <Text className="text-slate-400 text-sm">
                                {format(parseISO(entry.date), 'MMM d, yyyy')}
                                {entry.note && ` • ${entry.note}`}
                              </Text>
                            </View>
                            {isAdmin() && (
                              <Pressable
                                onPress={() => handleDeletePaymentEntry(entry.id)}
                                className="p-2"
                              >
                                <Trash2 size={18} color="#ef4444" />
                              </Pressable>
                            )}
                          </View>
                        ))
                    )}
                  </View>
                </ScrollView>
              </>
            ) : (
              <>
                {/* Period Detail Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                  <Pressable onPress={() => setSelectedPeriodId(null)}>
                    <X size={24} color="#64748b" />
                  </Pressable>
                  <Text className="text-white text-lg font-semibold">
                    {selectedPeriod?.title || 'Payment Period'}
                  </Text>
                  <View style={{ width: 24 }} />
                </View>

                {selectedPeriod && (
                  <ScrollView className="flex-1 px-5 pt-6">
                    {isAdmin() && !isEditAmountModalVisible && (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditingPeriodId(selectedPeriod.id);
                          setEditPeriodAmount(selectedPeriod.amount.toString());
                          setIsEditAmountModalVisible(true);
                        }}
                        className="bg-green-500/20 rounded-xl p-4 mb-6 flex-row items-center justify-between active:bg-green-500/30"
                      >
                        <View>
                          <Text className="text-green-400 text-2xl font-bold">
                            ${selectedPeriod.amount}
                          </Text>
                          <Text className="text-green-300 text-sm">per player</Text>
                        </View>
                        <View className="bg-green-500/30 rounded-lg px-3 py-2 flex-row items-center">
                          <Edit3 size={16} color="#22c55e" />
                          <Text className="text-green-400 text-sm font-medium ml-1.5">Edit</Text>
                        </View>
                      </Pressable>
                    )}
                    {isAdmin() && isEditAmountModalVisible && editingPeriodId === selectedPeriod.id && (
                      <View className="bg-green-500/20 rounded-xl p-4 mb-6 border border-green-500/50">
                        <Text className="text-green-300 text-sm mb-2">Edit Amount Due</Text>
                        <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3 mb-3">
                          <Text className="text-white text-2xl font-bold mr-1">$</Text>
                          <TextInput
                            value={editPeriodAmount}
                            onChangeText={setEditPeriodAmount}
                            placeholder="0.00"
                            placeholderTextColor="#64748b"
                            keyboardType="decimal-pad"
                            autoFocus
                            className="flex-1 text-white text-2xl font-bold"
                          />
                        </View>
                        <View className="flex-row">
                          <Pressable
                            onPress={() => {
                              setIsEditAmountModalVisible(false);
                              setEditingPeriodId(null);
                              setEditPeriodAmount('');
                            }}
                            className="flex-1 bg-slate-700 rounded-xl py-3 mr-2"
                          >
                            <Text className="text-slate-300 text-center font-semibold">Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleUpdatePeriodAmount}
                            className="flex-1 bg-green-500 rounded-xl py-3 ml-2"
                          >
                            <Text className="text-white text-center font-semibold">Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                    {!isAdmin() && (
                      <View className="bg-green-500/20 rounded-xl p-4 mb-6">
                        <Text className="text-green-400 text-2xl font-bold">
                          ${selectedPeriod.amount}
                        </Text>
                        <Text className="text-green-300 text-sm">per player</Text>
                      </View>
                    )}

                    {/* Due Date Section - Admin only */}
                    {isAdmin() && (
                      <View className="mb-6">
                        {!isEditDueDateVisible ? (
                          (() => {
                            const paidCount = selectedPeriod.playerPayments.filter((pp) => pp.status === 'paid').length;
                            const totalCount = selectedPeriod.playerPayments.length;
                            const allPaid = paidCount === totalCount;
                            const dueDateColor = selectedPeriod.dueDate
                              ? getDueDateColor(selectedPeriod.dueDate, allPaid)
                              : { text: 'text-slate-500', hex: '#64748b' };

                            return (
                              <Pressable
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setEditDueDate(selectedPeriod.dueDate ? parseISO(selectedPeriod.dueDate) : new Date());
                                  setIsEditDueDateVisible(true);
                                }}
                                className="bg-slate-800/60 rounded-xl p-4 flex-row items-center justify-between active:bg-slate-700/60 border border-slate-700/50"
                              >
                                <View className="flex-row items-center">
                                  <Calendar size={20} color={dueDateColor.hex} />
                                  <Text className={cn('text-base font-medium ml-3', selectedPeriod.dueDate ? dueDateColor.text : 'text-slate-500')}>
                                    {selectedPeriod.dueDate
                                      ? `Due ${format(parseISO(selectedPeriod.dueDate), 'MMMM d, yyyy')}`
                                      : 'No due date set'}
                                  </Text>
                                </View>
                                <Edit3 size={18} color="#64748b" />
                              </Pressable>
                            );
                          })()
                        ) : (
                          <View className="bg-slate-800/60 rounded-xl p-3 border border-cyan-500/50">
                            <View className="flex-row items-center justify-between mb-3">
                              <Text className="text-cyan-400 text-sm font-medium">Due Date</Text>
                              {editDueDate && (
                                <Pressable
                                  onPress={() => setEditDueDate(null)}
                                  className="px-2 py-1"
                                >
                                  <Text className="text-slate-500 text-xs">Clear</Text>
                                </Pressable>
                              )}
                            </View>
                            {editDueDate && (
                              <View className="bg-slate-800 rounded-xl overflow-hidden items-center mb-3">
                                <DateTimePicker
                                  value={editDueDate}
                                  mode="date"
                                  display="inline"
                                  onChange={(event, date) => {
                                    if (date) setEditDueDate(date);
                                  }}
                                  themeVariant="dark"
                                  accentColor="#22c55e"
                                />
                              </View>
                            )}
                            <View className="flex-row">
                              <Pressable
                                onPress={() => {
                                  setIsEditDueDateVisible(false);
                                  setEditDueDate(null);
                                }}
                                className="flex-1 bg-slate-700 rounded-lg py-2.5 mr-2"
                              >
                                <Text className="text-slate-300 text-center font-medium text-sm">Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  updatePaymentPeriodAndSync(selectedPeriod.id, {
                                    dueDate: editDueDate ? editDueDate.toISOString() : undefined
                                  });
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  setIsEditDueDateVisible(false);
                                  setEditDueDate(null);
                                }}
                                className="flex-1 bg-cyan-500 rounded-lg py-2.5 ml-2"
                              >
                                <Text className="text-white text-center font-medium text-sm">Save</Text>
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    <View className="flex-row items-center justify-between mb-3 mt-4">
                      <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        Players ({selectedPeriod.playerPayments.length})
                      </Text>
                      {isAdmin() && playersNotInPeriod.length > 0 && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsAddPlayerModalVisible(true);
                          }}
                          className="bg-cyan-500/20 rounded-lg px-3 py-1.5 flex-row items-center active:bg-cyan-500/30"
                        >
                          <Plus size={14} color="#67e8f9" />
                          <Text className="text-cyan-400 text-xs font-medium ml-1">Add Player</Text>
                        </Pressable>
                      )}
                    </View>

                    {(() => {
                      // Calculate overdue info
                      const isOverdue = selectedPeriod.dueDate ? differenceInDays(new Date(), parseISO(selectedPeriod.dueDate)) > 0 : false;
                      const daysOverdue = selectedPeriod.dueDate ? Math.max(0, differenceInDays(new Date(), parseISO(selectedPeriod.dueDate))) : 0;

                      // Group players by status: partial/owing first, unpaid second, paid last
                      // Calculate correct status based on actual amounts, not stored status
                      const groupedPayments = [...selectedPeriod.playerPayments]
                        .filter(pp => {
                          const player = players.find(p => p.id === pp.playerId);
                          return player && canViewPlayerDetails(pp.playerId);
                        })
                        .sort((a, b) => {
                          // Sort order: partial (1), unpaid (2), paid (3)
                          const getOrder = (status: string) => {
                            if (status === 'partial') return 1;
                            if (status === 'unpaid') return 2;
                            return 3; // paid
                          };
                          // Calculate actual status for sorting
                          const statusA = calculatePaymentStatus(a.amount, selectedPeriod.amount);
                          const statusB = calculatePaymentStatus(b.amount, selectedPeriod.amount);
                          return getOrder(statusA) - getOrder(statusB);
                        });

                      return groupedPayments.map((pp) => {
                        const player = players.find((p) => p.id === pp.playerId);
                        if (!player) return null;

                        // Calculate correct status based on actual amounts
                        const correctStatus = calculatePaymentStatus(pp.amount, selectedPeriod.amount);

                        return (
                          <SwipeablePlayerPaymentRow
                            key={pp.playerId}
                            player={player}
                            status={correctStatus}
                            paidAmount={pp.amount}
                            totalAmount={selectedPeriod.amount}
                            periodType={selectedPeriod.type ?? 'dues'}
                            isOverdue={isOverdue}
                            daysOverdue={daysOverdue}
                            onPress={() => {
                              setSelectedPlayerId(pp.playerId);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            canDelete={isAdmin()}
                            onDelete={() => handleRemovePlayerFromPeriod(pp.playerId)}
                          />
                        );
                      });
                    })()}
                  </ScrollView>
                )}
              </>
            )}

            {/* Add Player to Period Modal - Nested inside parent modal */}
            <Modal
              visible={isAddPlayerModalVisible}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setIsAddPlayerModalVisible(false)}
            >
              <View className="flex-1 bg-slate-900">
                <SafeAreaView className="flex-1">
                  <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                    <Pressable onPress={() => setIsAddPlayerModalVisible(false)}>
                      <X size={24} color="#64748b" />
                    </Pressable>
                    <Text className="text-white text-lg font-semibold">Add Players</Text>
                    <Pressable onPress={() => setIsAddPlayerModalVisible(false)}>
                      <Text className="text-cyan-400 font-semibold">Done</Text>
                    </Pressable>
                  </View>

                  <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
                    {playersNotInPeriod.length === 0 ? (
                      <View className="items-center py-12">
                        <Users size={48} color="#64748b" />
                        <Text className="text-slate-400 text-center mt-4">
                          All players are already in this payment period
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text className="text-slate-400 text-sm mb-4">
                          Tap a player to add them to this payment period
                        </Text>
                        {playersNotInPeriod.map((player) => (
                          <Pressable
                            key={player.id}
                            onPress={() => {
                              handleAddPlayerToPeriod(player.id);
                            }}
                            className="flex-row items-center p-3 rounded-xl mb-2 bg-slate-800/60 border border-slate-700/50 active:bg-slate-700/60"
                          >
                            <PlayerAvatar player={player} size={44} />
                            <View className="flex-1 ml-3">
                              <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                              <Text className={cn(
                                'text-xs',
                                player.status === 'active' ? 'text-green-400' : 'text-slate-400'
                              )}>
                                {player.status === 'active' ? 'Active' : 'Reserve'} · #{player.number}
                              </Text>
                            </View>
                            <View className="bg-cyan-500/20 rounded-lg px-3 py-1.5">
                              <Plus size={16} color="#67e8f9" />
                            </View>
                          </Pressable>
                        ))}
                      </>
                    )}
                  </ScrollView>
                </SafeAreaView>
              </View>
            </Modal>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Edit Period Modal - Amount and Due Date */}
      <Modal
        visible={isEditAmountModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsEditAmountModalVisible(false);
          setEditingPeriodId(null);
          setEditPeriodAmount('');
          setEditDueDate(null);
          setShowEditDueDatePicker(false);
        }}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => {
                setIsEditAmountModalVisible(false);
                setEditingPeriodId(null);
                setEditPeriodAmount('');
                setEditDueDate(null);
                setShowEditDueDatePicker(false);
              }}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Period</Text>
              <Pressable onPress={handleUpdatePeriodAmount}>
                <Text className="text-cyan-400 font-semibold">Save</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              {/* Amount */}
              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2">Amount per Player ($)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3">
                  <Text className="text-white text-2xl font-bold mr-1">$</Text>
                  <TextInput
                    value={editPeriodAmount}
                    onChangeText={setEditPeriodAmount}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="decimal-pad"
                    className="flex-1 text-white text-2xl font-bold"
                  />
                </View>
                <Text className="text-slate-500 text-xs mt-2">
                  This will update the amount due for all players in this period.
                </Text>
              </View>

              {/* Due Date */}
              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2">Due Date</Text>
                <Pressable
                  onPress={() => {
                    if (!editDueDate) {
                      setEditDueDate(new Date());
                    }
                    setShowEditDueDatePicker(!showEditDueDatePicker);
                  }}
                  className="flex-row items-center justify-between bg-slate-800 rounded-xl px-4 py-3"
                >
                  <View className="flex-row items-center">
                    <Calendar size={20} color="#64748b" />
                    <Text className={editDueDate ? "text-white ml-3 text-lg" : "text-slate-500 ml-3 text-lg"}>
                      {editDueDate ? format(editDueDate, 'MMMM d, yyyy') : 'No due date'}
                    </Text>
                  </View>
                  {editDueDate && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setEditDueDate(null);
                        setShowEditDueDatePicker(false);
                      }}
                      className="p-1"
                    >
                      <X size={18} color="#64748b" />
                    </Pressable>
                  )}
                </Pressable>
                {showEditDueDatePicker && (
                  <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                    <DateTimePicker
                      value={editDueDate || new Date()}
                      mode="date"
                      display="inline"
                      onChange={(event, date) => {
                        if (date) setEditDueDate(date);
                        if (Platform.OS === 'android') setShowEditDueDatePicker(false);
                      }}
                      themeVariant="dark"
                      accentColor="#22c55e"
                    />
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Edit Team Total Amount Modal */}
      <Modal
        visible={isEditTeamTotalModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsEditTeamTotalModalVisible(false);
          setEditTeamTotalAmount('');
          setEditingTeamTotalPeriodId(null);
        }}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => {
                setIsEditTeamTotalModalVisible(false);
                setEditTeamTotalAmount('');
                setEditingTeamTotalPeriodId(null);
              }}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Team Total Owed</Text>
              <Pressable onPress={handleUpdateTeamTotalAmount}>
                <Text className="text-cyan-400 font-semibold">Save</Text>
              </Pressable>
            </View>

            <View className="px-5 pt-6">
              <Text className="text-slate-400 text-sm mb-2">Total Amount ($)</Text>
              <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3">
                <Text className="text-white text-2xl font-bold mr-1">$</Text>
                <TextInput
                  value={editTeamTotalAmount}
                  onChangeText={setEditTeamTotalAmount}
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  autoFocus
                  className="flex-1 text-white text-2xl font-bold"
                />
              </View>
              <Text className="text-slate-500 text-sm mt-3">
                Enter the total amount owed by the team for this payment period. Player payments will automatically subtract from this total. Leave empty to clear.
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Edit Due Date Modal */}
      <Modal
        visible={isEditDueDateVisible && !selectedPlayerId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsEditDueDateVisible(false);
          setEditDueDate(null);
        }}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => {
                setIsEditDueDateVisible(false);
                setEditDueDate(null);
              }}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Due Date</Text>
              <Pressable onPress={() => {
                if (selectedPeriodId) {
                  updatePaymentPeriodAndSync(selectedPeriodId, {
                    dueDate: editDueDate ? editDueDate.toISOString() : undefined
                  });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setIsEditDueDateVisible(false);
                setEditDueDate(null);
                setSelectedPeriodId(null);
              }}>
                <Text className="text-cyan-400 font-semibold">Save</Text>
              </Pressable>
            </View>

            <View className="px-5 pt-6">
              {editDueDate ? (
                <>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-slate-400 text-sm">Select Due Date</Text>
                    <Pressable
                      onPress={() => setEditDueDate(null)}
                      className="px-3 py-1.5 bg-slate-800 rounded-lg"
                    >
                      <Text className="text-slate-400 text-sm">Clear</Text>
                    </Pressable>
                  </View>
                  <View className="bg-slate-800 rounded-xl overflow-hidden items-center">
                    <DateTimePicker
                      value={editDueDate}
                      mode="date"
                      display="inline"
                      onChange={(event, date) => {
                        if (date) setEditDueDate(date);
                      }}
                      themeVariant="dark"
                      accentColor="#22c55e"
                    />
                  </View>
                </>
              ) : (
                <View className="items-center py-12">
                  <Calendar size={48} color="#64748b" />
                  <Text className="text-slate-400 text-center mt-4">No due date set</Text>
                  <Pressable
                    onPress={() => setEditDueDate(new Date())}
                    className="mt-4 bg-cyan-500 rounded-xl px-6 py-3"
                  >
                    <Text className="text-white font-semibold">Set Due Date</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Payment Info Modal */}
      <Modal
        visible={isPaymentInfoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPaymentInfoModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center items-center px-6"
          onPress={() => setIsPaymentInfoModalVisible(false)}
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
                setIsPaymentInfoModalVisible(false);
              }}
              className="bg-purple-500 py-3 rounded-xl items-center active:bg-purple-600"
            >
              <Text className="text-white font-semibold">Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Stripe Checkout WebView Modal */}
      <Modal
        visible={!!stripeCheckoutUrl}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStripeCheckoutUrl(null)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setStripeCheckoutUrl(null)} className="p-1">
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

            {stripeCheckoutUrl && (
              <WebView
                source={{ uri: stripeCheckoutUrl }}
                style={{ flex: 1, backgroundColor: '#0f172a' }}
                onNavigationStateChange={(navState) => {
                  const url = navState.url ?? '';
                  // Handle success/cancel deep links from Stripe
                  if (url.startsWith('vibecode://payment-success') || url.includes('payment-success')) {
                    setStripeCheckoutUrl(null);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert(
                      'Payment Submitted',
                      'Your payment is being processed. Your payment status will update shortly.',
                      [{ text: 'Done' }]
                    );
                  } else if (url.startsWith('vibecode://payment-cancel') || url.includes('payment-cancel')) {
                    setStripeCheckoutUrl(null);
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

      {/* Stripe Payment Disclosure Modal */}
      <Modal
        visible={isStripeDisclosureVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsStripeDisclosureVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center px-6"
          onPress={() => setIsStripeDisclosureVisible(false)}
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
                Align Sports does not collect, store, or have access to your card number, CVV, or any other payment credentials. All sensitive financial data is handled exclusively by Stripe.
              </Text>
              <Text className="text-slate-400 text-xs leading-5">
                By completing a payment, you agree to Stripe's{' '}
                <Text
                  className="text-cyan-400 underline"
                  onPress={() => {
                    Linking.openURL('https://stripe.com/legal/consumer');
                    setIsStripeDisclosureVisible(false);
                  }}
                >
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text
                  className="text-cyan-400 underline"
                  onPress={() => {
                    Linking.openURL('https://stripe.com/privacy');
                    setIsStripeDisclosureVisible(false);
                  }}
                >
                  Privacy Policy
                </Text>
                .
              </Text>

              <Pressable
                onPress={() => setIsStripeDisclosureVisible(false)}
                className="mt-5 bg-slate-700 rounded-xl py-3 items-center active:bg-slate-600"
              >
                <Text className="text-white font-semibold">Got it</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
