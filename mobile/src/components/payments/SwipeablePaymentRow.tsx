import { View, Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Player, PaymentPeriodType } from '@/lib/store';
import { PlayerPaymentRow } from './PlayerPaymentRow';

interface SwipeablePaymentRowProps {
  player: Player;
  status: 'unpaid' | 'paid' | 'partial';
  paidAmount?: number;
  totalAmount: number;
  periodType: PaymentPeriodType;
  onPress: () => void;
  isOverdue?: boolean;
  daysOverdue?: number;
  onDelete?: () => void;
  canDelete?: boolean;
}

export function SwipeablePaymentRow({
  onDelete,
  canDelete = false,
  ...rowProps
}: SwipeablePaymentRowProps) {
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
