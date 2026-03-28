import { View, Text, Pressable } from 'react-native';
import { Shield, ChevronRight, Trash2, UserCog } from 'lucide-react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Player, getPlayerName } from '@/lib/store';
import { cn } from '@/lib/cn';
import { PlayerAvatar } from '@/components/PlayerAvatar';

export interface PlayerManageCardProps {
  player: Player;
  index: number;
  onPress: () => void;
  isCurrentUser: boolean;
}

export function PlayerManageCard({ player, index, onPress, isCurrentUser }: PlayerManageCardProps) {
  const roles = player.roles ?? [];

  return (
    <Pressable
      onPress={onPress}
      className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 active:bg-slate-700/80"
    >
      <View className="flex-row items-center">
        <PlayerAvatar player={player} size={44} />
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text className="text-white font-semibold">{getPlayerName(player)}</Text>
            {isCurrentUser && (
              <View className="ml-2 bg-cyan-500/20 rounded-full px-2 py-0.5">
                <Text className="text-cyan-400 text-xs">You</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center mt-1 flex-wrap">
            {roles.includes('admin') && (
              <View className="flex-row items-center bg-purple-500/20 rounded-full px-2 py-0.5 mr-2">
                <Shield size={10} color="#a78bfa" />
                <Text className="text-purple-400 text-xs ml-1">Admin</Text>
              </View>
            )}
            {roles.includes('captain') && (
              <View className="flex-row items-center bg-amber-500/20 rounded-full px-2 py-0.5 mr-2">
                <View className="w-3 h-3 rounded-full bg-amber-500/30 items-center justify-center">
                  <Text className="text-amber-500 text-[8px] font-black">C</Text>
                </View>
                <Text className="text-amber-400 text-xs ml-1">Captain</Text>
              </View>
            )}
            <View className={cn(
              'rounded-full px-2 py-0.5',
              player.status === 'active' ? 'bg-green-500/20' : 'bg-slate-600/50'
            )}>
              <Text className={cn(
                'text-xs',
                player.status === 'active' ? 'text-green-400' : 'text-slate-400'
              )}>
                {player.status === 'active' ? 'Active' : 'Reserve'}
              </Text>
            </View>
          </View>
        </View>
        <ChevronRight size={20} color="#64748b" />
      </View>
    </Pressable>
  );
}

export interface SwipeablePlayerManageCardProps extends PlayerManageCardProps {
  onDelete: () => void;
  canDelete: boolean;
}

export function SwipeablePlayerManageCard({
  onDelete,
  canDelete,
  ...cardProps
}: SwipeablePlayerManageCardProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const handleDelete = () => {
    translateX.value = withSpring(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  const panGesture = Gesture.Pan()
    .enabled(canDelete)
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

  if (!canDelete) {
    return (
      <Animated.View entering={FadeInDown.delay(cardProps.index * 50).springify()} className="mb-2">
        <PlayerManageCard {...cardProps} />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(cardProps.index * 50).springify()}>
      <View className="relative mb-2 overflow-hidden rounded-xl">
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
            <PlayerManageCard {...cardProps} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
