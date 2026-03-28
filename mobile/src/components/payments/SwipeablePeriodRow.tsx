import { View, Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { PaymentPeriod } from '@/lib/store';
import { PaymentCardRow } from './PaymentCardRow';

interface SwipeablePeriodRowProps {
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

export function SwipeablePeriodRow({
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
}: SwipeablePeriodRowProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

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

  const cardRow = (
    <PaymentCardRow
      period={period}
      index={index}
      isReorderMode={isReorderMode}
      onPress={onPress}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onEditAmount={onEditAmount}
      onEditTeamTotal={onEditTeamTotal}
      onEditDueDate={onEditDueDate}
      totalPeriods={totalPeriods}
      isAdmin={isAdmin}
    />
  );

  if (!isAdmin || isReorderMode) {
    return cardRow;
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
          {cardRow}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
