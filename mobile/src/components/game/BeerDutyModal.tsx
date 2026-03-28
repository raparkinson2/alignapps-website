import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle2, Beer } from 'lucide-react-native';
import { useTeamStore, getPlayerName } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { cn } from '@/lib/cn';

interface BeerDutyModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  onSelectPlayer: (playerId: string | undefined) => void;
}

export function BeerDutyModal({ visible, onClose, gameId, onSelectPlayer }: BeerDutyModalProps) {
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  const game = games.find((g) => g.id === gameId);

  // Build the full roster (active + reserve), excluding coaches/parents
  const isCoachOrParent = (p: typeof players[0]) =>
    p.position === 'Coach' || p.position === 'Parent' ||
    p.roles?.includes('coach') || p.roles?.includes('parent');

  const uniquePlayers = players.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);
  const eligiblePlayers = uniquePlayers.filter((p) => !isCoachOrParent(p));
  const activePlayers = eligiblePlayers.filter((p) => p.status === 'active');
  const reservePlayers = eligiblePlayers.filter((p) => p.status === 'reserve');
  const allRosterPlayers = [...activePlayers, ...reservePlayers];

  if (!game) return null;

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
            <Text className="text-white text-lg font-semibold">
              {teamSettings.sport === 'hockey' && teamSettings.refreshmentDutyIs21Plus !== false
                ? 'Assign Post Game Beer Duty'
                : 'Assign Refreshment Duty'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView className="flex-1 px-5 pt-4">
            {/* None option to clear selection */}
            <Pressable
              onPress={() => onSelectPlayer(undefined)}
              className={cn(
                'flex-row items-center p-4 rounded-xl mb-2 border',
                !game.beerDutyPlayerId
                  ? 'bg-slate-600/30 border-slate-500/50'
                  : 'bg-slate-800/60 border-slate-700/50'
              )}
            >
              <View className="w-11 h-11 rounded-full bg-slate-700 items-center justify-center">
                <X size={20} color="#94a3b8" />
              </View>
              <Text className="text-slate-300 font-semibold ml-3 flex-1">None</Text>
              {!game.beerDutyPlayerId && (
                <CheckCircle2 size={24} color="#94a3b8" />
              )}
            </Pressable>

            {allRosterPlayers.map((player) => (
              <Pressable
                key={player.id}
                onPress={() => onSelectPlayer(player.id)}
                className={cn(
                  'flex-row items-center p-4 rounded-xl mb-2 border',
                  game.beerDutyPlayerId === player.id
                    ? 'bg-amber-500/20 border-amber-500/50'
                    : 'bg-slate-800/60 border-slate-700/50'
                )}
              >
                <PlayerAvatar player={player} size={44} />
                <View className="flex-1 ml-3">
                  <Text className="text-white font-semibold">{getPlayerName(player)}</Text>
                  {player.status === 'reserve' && (
                    <Text className="text-slate-400 text-xs">Reserve</Text>
                  )}
                </View>
                {game.beerDutyPlayerId === player.id && (
                  <CheckCircle2 size={24} color="#f59e0b" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
