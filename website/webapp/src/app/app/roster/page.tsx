'use client';

import React, { useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import PlayerCard from '@/components/roster/PlayerCard';
import { cn } from '@/lib/utils';
import type { Player, Sport } from '@/lib/types';
import { isCoachOrParent } from '@/lib/types';
import AddEditPlayerModal from '@/components/admin/AddEditPlayerModal';
import { useRouter } from 'next/navigation';

// Position groupings by sport
type PositionGroup = { label: string; positions: string[] };

const SPORT_GROUPS: Record<Sport, PositionGroup[]> = {
  hockey: [
    { label: 'Forwards', positions: ['C', 'LW', 'RW'] },
    { label: 'Defense', positions: ['LD', 'RD'] },
    { label: 'Goalies', positions: ['G'] },
  ],
  baseball: [
    { label: 'Pitchers', positions: ['P'] },
    { label: 'Catchers', positions: ['C'] },
    { label: 'Infield', positions: ['1B', '2B', '3B', 'SS', 'DH'] },
    { label: 'Outfield', positions: ['LF', 'CF', 'RF'] },
  ],
  softball: [
    { label: 'Pitchers', positions: ['P'] },
    { label: 'Catchers', positions: ['C'] },
    { label: 'Infield', positions: ['1B', '2B', '3B', 'SS', 'DH'] },
    { label: 'Outfield', positions: ['LF', 'CF', 'RF', 'SF'] },
  ],
  basketball: [
    { label: 'Guards', positions: ['PG', 'SG'] },
    { label: 'Forwards', positions: ['SF', 'PF'] },
    { label: 'Centers', positions: ['C'] },
  ],
  soccer: [
    { label: 'Goalkeepers', positions: ['GK'] },
    { label: 'Defenders', positions: ['DEF'] },
    { label: 'Midfielders', positions: ['MID'] },
    { label: 'Forwards', positions: ['FWD'] },
  ],
  lacrosse: [
    { label: 'Goalies', positions: ['G'] },
    { label: 'Attackers', positions: ['A'] },
    { label: 'Midfielders', positions: ['M'] },
    { label: 'Defenders', positions: ['D'] },
  ],
};

function getPlayerPositionList(player: Player): string[] {
  if (player.positions && player.positions.length > 0) return player.positions;
  return player.position ? [player.position] : [];
}

export default function RosterPage() {
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const { isAdmin } = usePermissions();
  const router = useRouter();

  const [showReserve, setShowReserve] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const sport = teamSettings.sport;
  const groups = SPORT_GROUPS[sport] ?? SPORT_GROUPS.hockey;

  const activePlayers = players.filter((p) => p.status === 'active' && !isCoachOrParent(p));
  const reservePlayers = players.filter((p) => p.status === 'reserve' && !isCoachOrParent(p));
  const coachesAndStaff = players.filter((p) => isCoachOrParent(p));

  // Group active players by position
  const groupedPlayers: Array<{ label: string; players: Player[] }> = groups.map((group) => ({
    label: group.label,
    players: activePlayers.filter((p) => {
      const positions = getPlayerPositionList(p);
      return positions.some((pos) => group.positions.includes(pos));
    }),
  })).filter((g) => g.players.length > 0);

  // Players who don't match any group
  const allGroupedIds = new Set(groupedPlayers.flatMap((g) => g.players.map((p) => p.id)));
  const ungroupedPlayers = activePlayers.filter((p) => !allGroupedIds.has(p.id));

  const handleEdit = (player: Player) => {
    setEditingPlayer(player);
    setShowAddPlayer(true);
  };

  const handleCardClick = (player: Player) => {
    router.push(`/app/player-profile/${player.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-100">
          Roster <span className="text-slate-500 font-normal text-base">({activePlayers.length})</span>
        </h1>
        {isAdmin && (
          <button
            onClick={() => { setEditingPlayer(null); setShowAddPlayer(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-sm font-medium hover:bg-[#67e8f9]/20 transition-all"
          >
            <Plus size={15} />
            Add Player
          </button>
        )}
      </div>

      {/* Active players by position group */}
      <div className="space-y-6">
        {groupedPlayers.map((group) => (
          <section key={group.label}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {group.label} ({group.players.length})
            </h2>
            <div className="space-y-2">
              {group.players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isAdmin={isAdmin}
                  onEdit={handleEdit}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Ungrouped active players */}
        {ungroupedPlayers.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Players ({ungroupedPlayers.length})
            </h2>
            <div className="space-y-2">
              {ungroupedPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isAdmin={isAdmin}
                  onEdit={handleEdit}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </section>
        )}

        {activePlayers.length === 0 && (
          <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">No active players on the roster yet</p>
          </div>
        )}

        {/* Reserve section (collapsible) */}
        {reservePlayers.length > 0 && (
          <section>
            <button
              onClick={() => setShowReserve(!showReserve)}
              className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors mb-2"
            >
              <ChevronDown size={16} className={cn('transition-transform', showReserve && 'rotate-180')} />
              Reserve ({reservePlayers.length})
            </button>
            {showReserve && (
              <div className="space-y-2 opacity-70">
                {reservePlayers.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isAdmin={isAdmin}
                    onEdit={handleEdit}
                    onClick={handleCardClick}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Coaches & Staff section */}
        {coachesAndStaff.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Coaches &amp; Staff ({coachesAndStaff.length})
            </h2>
            <div className="space-y-2 opacity-80">
              {coachesAndStaff.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isAdmin={isAdmin}
                  onEdit={handleEdit}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Add/edit modal */}
      <AddEditPlayerModal
        isOpen={showAddPlayer}
        onClose={() => { setShowAddPlayer(false); setEditingPlayer(null); }}
        player={editingPlayer}
      />
    </div>
  );
}
