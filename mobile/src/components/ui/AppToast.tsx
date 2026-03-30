import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '@/lib/toast';

type ToastType = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const TOAST_DURATION = 3200;

function SingleToast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    opacity.value = withSpring(1, { damping: 18, stiffness: 200 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 200 });

    timerRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
      translateY.value = withTiming(-8, { duration: 250 });
    }, TOAST_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const bgColor =
    item.type === 'error'
      ? 'rgba(220,38,38,0.92)'
      : item.type === 'success'
      ? 'rgba(22,163,74,0.92)'
      : 'rgba(30,41,59,0.95)';

  const borderColor =
    item.type === 'error'
      ? 'rgba(248,113,113,0.4)'
      : item.type === 'success'
      ? 'rgba(74,222,128,0.4)'
      : 'rgba(100,116,139,0.4)';

  return (
    <Animated.View
      style={[
        animStyle,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 11,
          marginBottom: 8,
          maxWidth: 340,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 6,
        },
      ]}
    >
      <Text style={{ color: '#f8fafc', fontSize: 14, fontWeight: '500', lineHeight: 20 }}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

let _counter = 0;

export function AppToast() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    toast.register((message, type = 'info') => {
      const id = ++_counter;
      setToasts((prev) => [...prev, { id, message, type }]);
    });
  }, []);

  const remove = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((item) => (
        <SingleToast key={item.id} item={item} onDone={() => remove(item.id)} />
      ))}
    </View>
  );
}
