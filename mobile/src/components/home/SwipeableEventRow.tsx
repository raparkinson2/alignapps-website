import { View, Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, cancelAnimation } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { EventCard, EventCardProps } from '@/components/home/EventCard';

interface SwipeableEventCardProps extends EventCardProps {
  onDelete: () => void;
  canDelete: boolean;
}

export function SwipeableEventRow({
  onDelete,
  canDelete,
  event,
  index,
  onPress,
}: SwipeableEventCardProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  useEffect(() => {
    return () => { cancelAnimation(translateX); };
  }, []);

  const handleDelete = () => {
    translateX.value = withSpring(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  const panGesture = Gesture.Pan()
    .enabled(canDelete)
    .activeOffsetX([-10, 10])
    .onUpdate((evt) => {
      if (evt.translationX < 0) {
        translateX.value = Math.max(evt.translationX, -100);
      } else {
        translateX.value = withSpring(0);
      }
    })
    .onEnd((evt) => {
      if (evt.translationX < DELETE_THRESHOLD) {
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
    return <EventCard event={event} index={index} onPress={onPress} />;
  }

  return (
    <View className="relative mb-4 overflow-hidden rounded-2xl">
      {/* Delete button behind */}
      <Animated.View
        style={[deleteButtonStyle, { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 16, borderBottomRightRadius: 16 }]}
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
          <EventCard event={event} index={index} onPress={onPress} skipAnimation />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
