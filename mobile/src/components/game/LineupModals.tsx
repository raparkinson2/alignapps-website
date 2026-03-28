import { useTeamStore, HockeyLineup, BasketballLineup, BaseballLineup, SoccerLineup, SoccerDiamondLineup, LacrosseLineup, BattingOrderLineup } from '@/lib/store';
import { LineupEditor } from '@/components/LineupEditor';
import { BasketballLineupEditor } from '@/components/BasketballLineupEditor';
import { BaseballLineupEditor } from '@/components/BaseballLineupEditor';
import { BattingOrderLineupEditor } from '@/components/BattingOrderLineupEditor';
import { SoccerLineupEditor } from '@/components/SoccerLineupEditor';
import { SoccerDiamondLineupEditor } from '@/components/SoccerDiamondLineupEditor';
import { LacrosseLineupEditor } from '@/components/LacrosseLineupEditor';
import { pushGameToSupabase } from '@/lib/realtime-sync';

interface LineupModalsProps {
  gameId: string;
  // Hockey
  isLineupModalVisible: boolean;
  onCloseLineup: () => void;
  // Basketball
  isBasketballLineupModalVisible: boolean;
  onCloseBasketballLineup: () => void;
  // Baseball
  isBaseballLineupModalVisible: boolean;
  onCloseBaseballLineup: () => void;
  // Soccer 4-4-2
  isSoccerLineupModalVisible: boolean;
  onCloseSoccerLineup: () => void;
  // Soccer Diamond
  isSoccerDiamondLineupModalVisible: boolean;
  onCloseSoccerDiamondLineup: () => void;
  // Lacrosse
  isLacrosseLineupModalVisible: boolean;
  onCloseLacrosseLineup: () => void;
  // Batting Order (baseball + softball)
  isBattingOrderModalVisible: boolean;
  onCloseBattingOrder: () => void;
}

export function LineupModals({
  gameId,
  isLineupModalVisible,
  onCloseLineup,
  isBasketballLineupModalVisible,
  onCloseBasketballLineup,
  isBaseballLineupModalVisible,
  onCloseBaseballLineup,
  isSoccerLineupModalVisible,
  onCloseSoccerLineup,
  isSoccerDiamondLineupModalVisible,
  onCloseSoccerDiamondLineup,
  isLacrosseLineupModalVisible,
  onCloseLacrosseLineup,
  isBattingOrderModalVisible,
  onCloseBattingOrder,
}: LineupModalsProps) {
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const updateGame = useTeamStore((s) => s.updateGame);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const game = games.find((g) => g.id === gameId);

  // Helper: exclude coaches/parents
  const isCoachOrParent = (p: typeof players[0]) =>
    p.position === 'Coach' || p.position === 'Parent' ||
    p.roles?.includes('coach') || p.roles?.includes('parent');
  const uniquePlayers = players.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);
  const eligiblePlayers = uniquePlayers.filter((p) => !isCoachOrParent(p));
  const checkedInPlayers = game
    ? eligiblePlayers.filter((p) => game.checkedInPlayers?.includes(p.id))
    : [];

  const updateGameAndSync = (updates: Parameters<typeof updateGame>[1]) => {
    if (!game) return;
    updateGame(game.id, updates);
    if (activeTeamId) {
      const currentGame = useTeamStore.getState().games.find((g) => g.id === gameId);
      if (currentGame) {
        pushGameToSupabase({ ...currentGame, ...updates } as any, activeTeamId).catch(console.error);
      }
    }
  };

  const handleSaveLineup = (lineup: HockeyLineup) => {
    updateGameAndSync({ lineup });
    onCloseLineup();
  };

  const handleSaveBasketballLineup = (basketballLineup: BasketballLineup) => {
    updateGameAndSync({ basketballLineup });
    onCloseBasketballLineup();
  };

  const handleSaveBaseballLineup = (baseballLineup: BaseballLineup) => {
    updateGameAndSync({ baseballLineup });
    onCloseBaseballLineup();
  };

  const handleSaveSoccerLineup = (soccerLineup: SoccerLineup) => {
    updateGameAndSync({ soccerLineup });
    onCloseSoccerLineup();
  };

  const handleSaveSoccerDiamondLineup = (soccerDiamondLineup: SoccerDiamondLineup) => {
    updateGameAndSync({ soccerDiamondLineup });
    onCloseSoccerDiamondLineup();
  };

  const handleSaveLacrosseLineup = (lacrosseLineup: LacrosseLineup) => {
    updateGameAndSync({ lacrosseLineup });
    onCloseLacrosseLineup();
  };

  const handleSaveBattingOrderLineup = (battingOrderLineup: BattingOrderLineup) => {
    updateGameAndSync({ battingOrderLineup });
    onCloseBattingOrder();
  };

  if (!game) return null;

  return (
    <>
      {/* Lineup Editor Modal (Hockey) */}
      <LineupEditor
        visible={isLineupModalVisible}
        onClose={onCloseLineup}
        onSave={handleSaveLineup}
        initialLineup={game.lineup}
        availablePlayers={checkedInPlayers}
      />

      {/* Basketball Lineup Editor Modal */}
      <BasketballLineupEditor
        visible={isBasketballLineupModalVisible}
        onClose={onCloseBasketballLineup}
        onSave={handleSaveBasketballLineup}
        initialLineup={game.basketballLineup}
        availablePlayers={checkedInPlayers}
      />

      {/* Baseball Lineup Editor Modal */}
      <BaseballLineupEditor
        visible={isBaseballLineupModalVisible}
        onClose={onCloseBaseballLineup}
        onSave={handleSaveBaseballLineup}
        initialLineup={game.baseballLineup}
        players={checkedInPlayers}
        isSoftball={teamSettings.isSoftball}
      />

      {/* Soccer Lineup Editor Modal */}
      <SoccerLineupEditor
        visible={isSoccerLineupModalVisible}
        onClose={onCloseSoccerLineup}
        onSave={handleSaveSoccerLineup}
        initialLineup={game.soccerLineup}
        players={checkedInPlayers}
      />

      {/* Soccer Diamond Lineup Editor Modal */}
      <SoccerDiamondLineupEditor
        visible={isSoccerDiamondLineupModalVisible}
        onClose={onCloseSoccerDiamondLineup}
        onSave={handleSaveSoccerDiamondLineup}
        initialLineup={game.soccerDiamondLineup}
        players={checkedInPlayers}
      />

      {/* Lacrosse Lineup Editor Modal */}
      <LacrosseLineupEditor
        visible={isLacrosseLineupModalVisible}
        onClose={onCloseLacrosseLineup}
        onSave={handleSaveLacrosseLineup}
        initialLineup={game.lacrosseLineup}
        availablePlayers={checkedInPlayers}
      />

      {/* Batting Order Lineup Editor Modal (Baseball + Softball) */}
      {(teamSettings.sport === 'baseball' || teamSettings.sport === 'softball') && (
        <BattingOrderLineupEditor
          visible={isBattingOrderModalVisible}
          onClose={onCloseBattingOrder}
          onSave={handleSaveBattingOrderLineup}
          initialLineup={game.battingOrderLineup}
          availablePlayers={checkedInPlayers}
          sport={teamSettings.sport}
        />
      )}
    </>
  );
}
