/**
 * Centralized sync error handler.
 *
 * Replaces the pattern `.catch(console.error)` on all fire-and-forget
 * Supabase push/delete calls throughout the app.
 *
 * - Logs errors with structured context (operation name, timestamp)
 * - Optionally enqueues a retry via the mutation queue (pass `retry` arg)
 * - Does NOT re-throw by design — these are optimistic-update mutations
 *   where local state is already updated and we want best-effort syncs.
 */

import { enqueueMutation, MutationType } from './mutation-queue';

type SyncOperation =
  | 'pushTeamToSupabase'
  | 'pushPlayerToSupabase'
  | 'deletePlayerFromSupabase'
  | 'pushGameToSupabase'
  | 'deleteGameFromSupabase'
  | 'pushGameResponseToSupabase'
  | 'deleteGameResponseFromSupabase'
  | 'pushEventToSupabase'
  | 'deleteEventFromSupabase'
  | 'pushEventResponseToSupabase'
  | 'pushEventViewedToSupabase'
  | 'pushGameViewedToSupabase'
  | 'pushChatMessageToSupabase'
  | 'deleteChatMessageFromSupabase'
  | 'pushPaymentPeriodToSupabase'
  | 'deletePaymentPeriodFromSupabase'
  | 'pushNotificationToSupabase'
  | 'markNotificationReadInSupabase'
  | 'pushPollToSupabase'
  | 'deleteSinglePhoto'
  | 'sendPushToPlayers'
  | 'cancelNotifications'
  | string;

export type { MutationType };

type RetryOptions = {
  type: MutationType;
  entityId: string;
  teamId: string;
};

let _failureCount = 0;

/** Returns the total number of sync failures since app launch (for diagnostics). */
export function getSyncFailureCount(): number {
  return _failureCount;
}

/**
 * Call this in a `.catch()` on any fire-and-forget Supabase sync.
 * Pass `retry` to also enqueue the mutation for automatic retry on reconnect.
 *
 * @example — without retry (default):
 *   pushChatMessageToSupabase(msg, teamId).catch(syncError('pushChatMessageToSupabase'));
 *
 * @example — with retry:
 *   pushPlayerToSupabase(player, teamId).catch(
 *     syncError('pushPlayerToSupabase', { type: 'player', entityId: player.id, teamId })
 *   );
 */
export function syncError(
  operation: SyncOperation,
  retry?: RetryOptions,
): (err: unknown) => void {
  return (err: unknown) => {
    _failureCount++;
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[sync-error] ${operation} failed (total failures: ${_failureCount}):`,
      message,
      err
    );
    if (retry) {
      enqueueMutation(retry.type, retry.entityId, retry.teamId).catch(() => {});
    }
  };
}
