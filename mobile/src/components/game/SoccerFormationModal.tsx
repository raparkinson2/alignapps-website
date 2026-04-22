import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';
import { hasAssignedSoccerPlayers } from '@/components/SoccerLineupEditor';
import { hasAssignedSoccerDiamondPlayers } from '@/components/SoccerDiamondLineupEditor';
import { cn } from '@/lib/cn';

interface SoccerFormationModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  onSelectFormation: (formation: '442' | 'diamond') => void;
}

export function SoccerFormationModal({ visible, onClose, gameId, onSelectFormation }: SoccerFormationModalProps) {
  const games = useTeamStore((s) => s.games);
  const game = games.find((g) => g.id === gameId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Choose Formation</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView className="flex-1 px-5 pt-6">
            {/* 4-4-2 Formation */}
            <Pressable
              onPress={() => onSelectFormation('442')}
              className={cn(
                'rounded-2xl p-5 mb-4 border',
                game && hasAssignedSoccerPlayers(game.soccerLineup)
                  ? 'bg-emerald-500/20 border-emerald-500/50'
                  : 'bg-slate-800/60 border-slate-700/50'
              )}
            >
              <Text className="text-white text-lg font-semibold mb-2">Custom Formation</Text>
              <Text className="text-slate-400 text-sm mb-4">
                Build your own — set defenders, midfielders, and forwards
              </Text>
              {/* Visual representation */}
              <View className="bg-slate-700/30 rounded-xl p-4">
                {/* Strikers */}
                <View className="flex-row justify-center gap-6 mb-3">
                  <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                    <Text className="text-emerald-400 text-[10px]">ST</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                    <Text className="text-emerald-400 text-[10px]">ST</Text>
                  </View>
                </View>
                {/* Midfield */}
                <View className="flex-row justify-around mb-3">
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[10px]">LM</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[10px]">CM</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[10px]">CM</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[10px]">RM</Text>
                  </View>
                </View>
                {/* Defense */}
                <View className="flex-row justify-around mb-3">
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">LB</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">CB</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">CB</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">RB</Text>
                  </View>
                </View>
                {/* GK */}
                <View className="items-center">
                  <View className="w-10 h-10 rounded-full bg-purple-500/40 items-center justify-center">
                    <Text className="text-purple-400 text-[10px]">GK</Text>
                  </View>
                </View>
              </View>
              {game && hasAssignedSoccerPlayers(game.soccerLineup) && (
                <Text className="text-emerald-400 text-sm mt-3 text-center">Currently configured</Text>
              )}
            </Pressable>

            {/* Diamond 4-1-2-1-2 Formation */}
            <Pressable
              onPress={() => onSelectFormation('diamond')}
              className={cn(
                'rounded-2xl p-5 mb-4 border',
                game && hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup)
                  ? 'bg-emerald-500/20 border-emerald-500/50'
                  : 'bg-slate-800/60 border-slate-700/50'
              )}
            >
              <Text className="text-white text-lg font-semibold mb-2">Diamond 4-1-2-1-2</Text>
              <Text className="text-slate-400 text-sm mb-4">
                Diamond midfield with CDM, LM, RM, and CAM
              </Text>
              {/* Visual representation */}
              <View className="bg-slate-700/30 rounded-xl p-4">
                {/* Strikers */}
                <View className="flex-row justify-center gap-6 mb-3">
                  <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                    <Text className="text-emerald-400 text-[10px]">ST</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-emerald-500/40 items-center justify-center">
                    <Text className="text-emerald-400 text-[10px]">ST</Text>
                  </View>
                </View>
                {/* CAM */}
                <View className="items-center mb-3">
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[8px]">CAM</Text>
                  </View>
                </View>
                {/* LM / RM */}
                <View className="flex-row justify-around mb-3">
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[10px]">LM</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[10px]">RM</Text>
                  </View>
                </View>
                {/* CDM */}
                <View className="items-center mb-3">
                  <View className="w-8 h-8 rounded-full bg-cyan-500/40 items-center justify-center">
                    <Text className="text-cyan-400 text-[8px]">CDM</Text>
                  </View>
                </View>
                {/* Defense */}
                <View className="flex-row justify-around mb-3">
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">LB</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">CB</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">CB</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-amber-500/40 items-center justify-center">
                    <Text className="text-amber-400 text-[10px]">RB</Text>
                  </View>
                </View>
                {/* GK */}
                <View className="items-center">
                  <View className="w-10 h-10 rounded-full bg-purple-500/40 items-center justify-center">
                    <Text className="text-purple-400 text-[10px]">GK</Text>
                  </View>
                </View>
              </View>
              {game && hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup) && (
                <Text className="text-emerald-400 text-sm mt-3 text-center">Currently configured</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
