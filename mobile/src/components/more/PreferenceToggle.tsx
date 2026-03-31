import { View, Text, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface PreferenceToggleProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

export function PreferenceToggle({ label, description, value, onToggle }: PreferenceToggleProps) {
  return (
    <View className="flex-row items-center justify-between py-4 border-b border-slate-800">
      <View className="flex-1 mr-4">
        <Text className="text-white font-medium text-base">{label}</Text>
        <Text className="text-slate-400 text-sm mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(newValue);
        }}
        trackColor={{ false: '#334155', true: '#0891b2' }}
        thumbColor={value ? '#67e8f9' : '#94a3b8'}
      />
    </View>
  );
}
