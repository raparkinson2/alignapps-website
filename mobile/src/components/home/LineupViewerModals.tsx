import { useTeamStore, Game } from '@/lib/store';
import { LineupViewer, hasAssignedPlayers } from '@/components/LineupViewer';
import { BasketballLineupViewer } from '@/components/BasketballLineupViewer';
import { BaseballLineupViewer } from '@/components/BaseballLineupViewer';
import { hasAssignedBaseballPlayers } from '@/components/BaseballLineupEditor';
import { BattingOrderLineupViewer } from '@/components/BattingOrderLineupViewer';
import { hasAssignedBattingOrder } from '@/components/BattingOrderLineupEditor';
import { SoccerLineupViewer } from '@/components/SoccerLineupViewer';
import { hasAssignedSoccerPlayers } from '@/components/SoccerLineupEditor';
import { SoccerDiamondLineupViewer } from '@/components/SoccerDiamondLineupViewer';
import { hasAssignedSoccerDiamondPlayers } from '@/components/SoccerDiamondLineupEditor';
import { LacrosseLineupViewer } from '@/components/LacrosseLineupViewer';
import { hasAssignedLacrossePlayers } from '@/components/LacrosseLineupEditor';

interface LineupViewerModalsProps {
  game: Game | null;
  onClose: () => void;
}

export function LineupViewerModals({ game, onClose }: LineupViewerModalsProps) {
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  if (!game) return null;

  return (
    <>
      {/* Lineup Viewer Modal (Hockey) */}
      {game.lineup && teamSettings.sport === 'hockey' && (
        <LineupViewer
          visible={!!game}
          onClose={onClose}
          lineup={game.lineup}
          players={players}
          opponent={game.opponent}
        />
      )}

      {/* Basketball Lineup Viewer Modal */}
      {game.basketballLineup && teamSettings.sport === 'basketball' && (
        <BasketballLineupViewer
          visible={!!game}
          onClose={onClose}
          lineup={game.basketballLineup}
          players={players}
          opponent={game.opponent}
        />
      )}

      {/* Baseball Field Position Lineup Viewer Modal */}
      {game.baseballLineup && hasAssignedBaseballPlayers(game.baseballLineup) && teamSettings.sport === 'baseball' && (
        <BaseballLineupViewer
          visible={!!game}
          onClose={onClose}
          lineup={game.baseballLineup}
          players={players}
          opponent={game.opponent}
          isSoftball={teamSettings.isSoftball}
        />
      )}

      {/* Baseball/Softball Batting Order Viewer Modal */}
      {game.battingOrderLineup && hasAssignedBattingOrder(game.battingOrderLineup) && (teamSettings.sport === 'baseball' || teamSettings.sport === 'softball') && (
        <BattingOrderLineupViewer
          visible={!!game}
          onClose={onClose}
          lineup={game.battingOrderLineup}
          players={players}
          opponent={game.opponent}
          sport={teamSettings.sport}
        />
      )}

      {/* Soccer Lineup Viewer Modal */}
      {game.soccerLineup && hasAssignedSoccerPlayers(game.soccerLineup) && teamSettings.sport === 'soccer' && (
        <SoccerLineupViewer
          visible={!!game}
          onClose={onClose}
          lineup={game.soccerLineup}
          players={players}
          opponent={game.opponent}
        />
      )}

      {/* Soccer Diamond Lineup Viewer Modal */}
      {game.soccerDiamondLineup && hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup) && teamSettings.sport === 'soccer' && (
        <SoccerDiamondLineupViewer
          visible={!!game}
          onClose={onClose}
          lineup={game.soccerDiamondLineup}
          players={players}
          opponent={game.opponent}
        />
      )}

      {/* Lacrosse Lineup Viewer Modal */}
      {game.lacrosseLineup && hasAssignedLacrossePlayers(game.lacrosseLineup) && teamSettings.sport === 'lacrosse' && (
        <LacrosseLineupViewer
          visible={!!game}
          onClose={onClose}
          lineup={game.lacrosseLineup}
          players={players}
          opponent={game.opponent}
        />
      )}
    </>
  );
}
