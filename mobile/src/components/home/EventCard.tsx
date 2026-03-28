import { View, Text, Pressable } from 'react-native';
import { Calendar, Clock, MapPin, Users, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { Event } from '@/lib/store';
import { cn } from '@/lib/cn';

const getDateLabel = (dateString: string): string => {
  const date = parseISO(dateString);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
};

// Event Card Component
export interface EventCardProps {
  event: Event;
  index: number;
  onPress: () => void;
  skipAnimation?: boolean;
  hideDateBadge?: boolean;
}

export function EventCard({ event, index, onPress, skipAnimation = false, hideDateBadge = false }: EventCardProps) {
  const confirmedCount = event.confirmedPlayers?.length ?? 0;
  const declinedCount = event.declinedPlayers?.length ?? 0;
  const invitedCount = event.invitedPlayers?.length ?? 0;
  const pendingCount = invitedCount - confirmedCount - declinedCount;

  // Determine if this is a practice
  const isPractice = event.type === 'practice';

  // Color theming based on type
  const accentColor = isPractice ? '#f97316' : '#3b82f6'; // Orange for practice, blue for event
  const badgeBgClass = isPractice ? 'bg-orange-500/20' : 'bg-blue-500/20';
  const badgeTextClass = isPractice ? 'text-orange-400' : 'text-blue-400';
  const iconColor = isPractice ? '#fb923c' : '#60a5fa';

  const cardContent = (
    <Pressable
      onPress={onPress}
      className={cn('active:scale-[0.98]', !skipAnimation && 'mb-3')}
      style={{ transform: [{ scale: 1 }] }}
    >
      <View className="bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700/50">
        {/* Color Bar based on type */}
        <View style={{ backgroundColor: accentColor, height: 5 }} />

        <View className="p-3">
          {/* Date Badge & Event Title */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center flex-1">
              {!hideDateBadge && (
                <View className={cn(badgeBgClass, 'px-2 py-px rounded-full mr-2')}>
                  <Text className={cn(badgeTextClass, 'text-xs font-medium')}>
                    {getDateLabel(event.date)}
                  </Text>
                </View>
              )}
              <Text className="text-white text-lg font-bold flex-1" numberOfLines={1}>
                {event.title}
              </Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" strokeWidth={2.5} />
          </View>

          {/* Info Grid */}
          <View className="flex-row mb-2">
            <View className="flex-1 flex-row items-center">
              <Clock size={14} color={iconColor} strokeWidth={2} />
              <Text className="text-slate-300 text-sm ml-1.5">{event.time}</Text>
            </View>
            <View className="flex-1 flex-row items-center">
              <Calendar size={14} color={iconColor} strokeWidth={2} />
              <Text className="text-slate-300 text-sm ml-1.5">{isPractice ? 'Practice' : 'Event'}</Text>
            </View>
          </View>

          {/* Location */}
          <View className="flex-row items-center mb-2">
            <MapPin size={14} color={iconColor} strokeWidth={2} />
            <Text className="text-slate-400 text-sm ml-1.5" numberOfLines={1}>{event.location}</Text>
          </View>

          {/* Footer */}
          <View className="flex-row items-center pt-2 border-t border-slate-700/50">
            <View className="flex-row items-center">
              <Users size={14} color="#94a3b8" strokeWidth={2} />
              <View className="flex-row items-center ml-3">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                <Text className="text-slate-400 text-sm">In:</Text>
                <Text className="text-green-400 text-sm font-medium ml-1">{confirmedCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-1" />
                <Text className="text-slate-400 text-sm">Out:</Text>
                <Text className="text-red-400 text-sm font-medium ml-1">{declinedCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-slate-500 mr-1" />
                <Text className="text-slate-400 text-sm">Pending:</Text>
                <Text className="text-slate-500 text-sm font-medium ml-1">{pendingCount}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (skipAnimation) {
    return cardContent;
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      {cardContent}
    </Animated.View>
  );
}
