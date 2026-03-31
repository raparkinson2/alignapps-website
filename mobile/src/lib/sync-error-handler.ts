/**
 * Centralized sync error handler.
 *
 * Replaces the pattern `.catch(console.error)` on all fire-and-forget
 * Supabase push/delete calls throughout the app.
 *
 * - Logs errors with structured context (operation name, timestamp)
 * - Easy to extend: swap the body here to send to Sentry, Datadog, etc.
 * - Does NOT re-throw by design — these are optimistic-update mutations
 *   where local state is already updated and we want best-effort syncs.
 */

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
  | string; // allow ad-hoc strings for call sites not yet typed

let _failureCount = 0;

/** Returns the total number of sync failures since app launch (for diagnostics). */
export function getSyncFailureCount(): number {
  return _failureCount;
}

/**
 * Call this in a `.catch()` on any fire-and-forget Supabase sync.
 *
 * @example
 *   pushPlayerToSupabase(player, teamId).catch(syncError('pushPlayerToSupabase'));
 */
export function syncError(operation: SyncOperation): (err: unknown) => void {
  return (err: unknown) => {
    _failureCount++;
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[sync-error] ${operation} failed (total failures: ${_failureCount}):`,
      message,
      err
    );
  };
}
