/**
 * Offline Mutation Retry Queue
 *
 * When a Supabase sync call fails (network offline, timeout, etc.) the mutation
 * is persisted here and retried automatically the next time the app returns to the
 * foreground or reconnects.
 *
 * Design principles:
 * - Key = `${type}:${entityId}` — same-entity updates are deduplicated; only the
 *   most-recent intent is kept, so we never push stale state.
 * - At drain time we read the *current* entity from the store, not a saved snapshot,
 *   so the payload is always fresh.
 * - Max 50 entries to bound storage. Oldest entries are evicted if the cap is hit.
 * - No max retry counter — operations are idempotent upserts, so we keep trying.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@align/mutation_queue_v1';
const MAX_QUEUE_SIZE = 50;

export type MutationType = 'player' | 'team' | 'game' | 'event' | 'poll';

type QueueEntry = {
  key: string;       // dedup key: `${type}:${entityId}`
  type: MutationType;
  entityId: string;
  teamId: string;
  addedAt: number;
};

// ─── Internal helpers ────────────────────────────────────────────────────────

async function loadQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueueEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {}
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Persist a failed mutation so it can be retried later.
 * If an entry with the same key already exists it is replaced (keep latest).
 */
export async function enqueueMutation(
  type: MutationType,
  entityId: string,
  teamId: string,
): Promise<void> {
  try {
    const queue = await loadQueue();
    const key = `${type}:${entityId}`;
    // Remove existing entry for this entity, then append the fresh one.
    const filtered = queue.filter((e) => e.key !== key);
    // If at cap, evict the oldest entry to make room.
    const trimmed = filtered.length >= MAX_QUEUE_SIZE
      ? filtered.slice(filtered.length - (MAX_QUEUE_SIZE - 1))
      : filtered;
    await saveQueue([...trimmed, { key, type, entityId, teamId, addedAt: Date.now() }]);
  } catch {}
}

/**
 * Process all queued mutations against their current store state.
 * Successfully replayed entries are removed; failed ones stay for the next drain.
 */
export async function drainMutationQueue(): Promise<void> {
  const queue = await loadQueue();
  if (queue.length === 0) return;

  // Lazy imports to avoid circular-dependency at module load time.
  const [{ useTeamStore }, syncModule] = await Promise.all([
    import('./store') as Promise<{ useTeamStore: any }>,
    import('./realtime-sync') as Promise<{
      pushPlayerToSupabase: Function;
      pushTeamToSupabase: Function;
      pushGameToSupabase: Function;
      pushEventToSupabase: Function;
      pushPollToSupabase: Function;
    }>,
  ]);

  const {
    pushPlayerToSupabase,
    pushTeamToSupabase,
    pushGameToSupabase,
    pushEventToSupabase,
    pushPollToSupabase,
  } = syncModule;

  const store = useTeamStore.getState();
  const succeeded: string[] = [];

  for (const entry of queue) {
    const { type, entityId, teamId } = entry;
    try {
      switch (type) {
        case 'player': {
          const player = store.players.find((p: any) => p.id === entityId);
          if (player) await pushPlayerToSupabase(player, teamId);
          // If player is gone from store it was deleted — treat as done.
          break;
        }
        case 'team': {
          // Only drain if this is still the active team.
          if (teamId === store.activeTeamId) {
            await pushTeamToSupabase(teamId, store.teamName, store.teamSettings);
          }
          break;
        }
        case 'game': {
          const game = store.games.find((g: any) => g.id === entityId);
          if (game) await pushGameToSupabase(game, teamId);
          break;
        }
        case 'event': {
          const event = store.events.find((e: any) => e.id === entityId);
          if (event) await pushEventToSupabase(event, teamId);
          break;
        }
        case 'poll': {
          const poll = store.polls.find((p: any) => p.id === entityId);
          if (poll) await pushPollToSupabase(poll, teamId);
          break;
        }
      }
      succeeded.push(entry.key);
    } catch {
      // Leave in queue — will retry on next drain.
    }
  }

  const remaining = queue.filter((e) => !succeeded.includes(e.key));
  await saveQueue(remaining);

  if (succeeded.length > 0) {
    console.log(`[mutation-queue] Replayed ${succeeded.length} queued mutation(s), ${remaining.length} remaining`);
  }
}
