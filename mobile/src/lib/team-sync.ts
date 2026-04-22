import { supabase } from './supabase';
import type { Team, Player, Game, Event, Photo, TeamSettings } from './store';
import { uploadPhotoToStorage, uploadPhotoToStorageBase64 } from './photo-storage';
import { adaptLegacySoccerLineup } from './soccer-lineup-adapter';

/**
 * Team Sync Service
 * Handles syncing team data between local store and Supabase
 * Used for cross-device team invitations
 */

export interface SyncResult {
  success: boolean;
  error?: string;
  teamId?: string;
}

/**
 * Upload team data to Supabase when inviting a player
 * This ensures the invited player can access the team's games, events, etc.
 */
export async function uploadTeamToSupabase(team: Team): Promise<SyncResult> {
  try {
    console.log('TEAM_SYNC: Uploading team to Supabase:', team.teamName);

    // First, check if this team already exists in Supabase (by local ID stored in metadata)
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('id', team.id)
      .maybeSingle();

    let supabaseTeamId = existingTeam?.id;

    if (!supabaseTeamId) {
      // Create the team in Supabase
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          id: team.id, // Use local ID as Supabase ID for consistency
          name: team.teamName,
          sport: team.teamSettings?.sport || 'hockey',
          show_team_stats: team.teamSettings?.showTeamStats ?? true,
          show_payments: team.teamSettings?.showPayments ?? true,
          show_team_chat: team.teamSettings?.showTeamChat ?? true,
          show_photos: team.teamSettings?.showPhotos ?? true,
          show_refreshment_duty: team.teamSettings?.showRefreshmentDuty ?? true,
          refreshment_duty_is_21_plus: team.teamSettings?.refreshmentDutyIs21Plus ?? true,
          show_lineups: team.teamSettings?.showLineups ?? true,
          jersey_colors: team.teamSettings?.jerseyColors || [],
          payment_methods: team.teamSettings?.paymentMethods || [],
        })
        .select('id')
        .single();

      if (teamError) {
        // If team already exists with this ID, that's OK - we'll update it
        if (teamError.code === '23505') { // Unique violation
          console.log('TEAM_SYNC: Team already exists, will update');
          supabaseTeamId = team.id;
        } else {
          console.error('TEAM_SYNC: Error creating team:', teamError);
          return { success: false, error: teamError.message };
        }
      } else {
        supabaseTeamId = newTeam?.id;
      }
    }

    console.log('TEAM_SYNC: Team ID in Supabase:', supabaseTeamId);

    // Upload players (upsert to handle updates)
    if (team.players && team.players.length > 0) {
      const playersToUpload = team.players.map(player => ({
        id: player.id,
        team_id: supabaseTeamId,
        first_name: player.firstName,
        last_name: player.lastName,
        email: player.email,
        phone: player.phone,
        jersey_number: player.number,
        position: player.position,
        positions: player.positions || [],
        avatar: player.avatar,
        roles: player.roles || [],
        status: player.status || 'active',
        is_injured: player.isInjured || false,
        is_suspended: player.isSuspended || false,
        stats: player.stats || {},
        goalie_stats: player.goalieStats || {},
        pitcher_stats: player.pitcherStats || {},
        game_logs: player.gameLogs || [],
      }));

      const { error: playersError } = await supabase
        .from('players')
        .upsert(playersToUpload, { onConflict: 'id' });

      if (playersError) {
        console.error('TEAM_SYNC: Error uploading players:', playersError);
        // Continue anyway - players might have constraint issues
      } else {
        console.log('TEAM_SYNC: Uploaded', playersToUpload.length, 'players');
      }
    }

    // Upload games (upsert to handle updates)
    if (team.games && team.games.length > 0) {
      const gamesToUpload = team.games.map(game => ({
        id: game.id,
        team_id: supabaseTeamId,
        opponent: game.opponent,
        date: game.date,
        time: game.time,
        location: game.location,
        address: game.address,
        jersey_color: game.jerseyColor,
        notes: game.notes,
        show_beer_duty: game.showBeerDuty || false,
        beer_duty_player_id: game.beerDutyPlayerId,
        hockey_lineup: game.lineup,
        basketball_lineup: game.basketballLineup,
        baseball_lineup: game.baseballLineup,
        soccer_lineup: game.soccerLineup,
        soccer_diamond_lineup: game.soccerDiamondLineup,
        invite_release_option: game.inviteReleaseOption || 'now',
        invite_release_date: game.inviteReleaseDate,
        invites_sent: game.invitesSent || false,
      }));

      const { error: gamesError } = await supabase
        .from('games')
        .upsert(gamesToUpload, { onConflict: 'id' });

      if (gamesError) {
        console.error('TEAM_SYNC: Error uploading games:', gamesError);
      } else {
        console.log('TEAM_SYNC: Uploaded', gamesToUpload.length, 'games');
      }

      // Upload game responses (checkedIn = 'in', checkedOut = 'out', invited = 'invited')
      for (const game of team.games) {
        const responsesToUpload: { game_id: string; player_id: string; response: string }[] = [];

        // Add checked in players
        for (const playerId of game.checkedInPlayers || []) {
          responsesToUpload.push({ game_id: game.id, player_id: playerId, response: 'in' });
        }

        // Add checked out players
        for (const playerId of game.checkedOutPlayers || []) {
          responsesToUpload.push({ game_id: game.id, player_id: playerId, response: 'out' });
        }

        // Add invited players (only those not already in/out)
        const respondedPlayers = new Set([...(game.checkedInPlayers || []), ...(game.checkedOutPlayers || [])]);
        for (const playerId of game.invitedPlayers || []) {
          if (!respondedPlayers.has(playerId)) {
            responsesToUpload.push({ game_id: game.id, player_id: playerId, response: 'invited' });
          }
        }

        if (responsesToUpload.length > 0) {
          const { error: responsesError } = await supabase
            .from('game_responses')
            .upsert(responsesToUpload, { onConflict: 'game_id,player_id' });

          if (responsesError) {
            console.error('TEAM_SYNC: Error uploading game responses:', responsesError);
          }
        }
      }
    }

    // Upload events (upsert to handle updates)
    if (team.events && team.events.length > 0) {
      const eventsToUpload = team.events.map(event => ({
        id: event.id,
        team_id: supabaseTeamId,
        title: event.title,
        type: event.type || 'other',
        date: event.date,
        time: event.time,
        location: event.location,
        address: event.address,
        notes: event.notes,
      }));

      const { error: eventsError } = await supabase
        .from('events')
        .upsert(eventsToUpload, { onConflict: 'id' });

      if (eventsError) {
        console.error('TEAM_SYNC: Error uploading events:', eventsError);
      } else {
        console.log('TEAM_SYNC: Uploaded', eventsToUpload.length, 'events');
      }
    }

    // Upload photos (upload to storage first, then save metadata)
    if (team.photos && team.photos.length > 0) {
      console.log('TEAM_SYNC: Uploading', team.photos.length, 'photos');

      for (const photo of team.photos) {
        try {
          // Upload photo to Supabase Storage if it's a local file
          let cloudUri = photo.uri;
          if (photo.uri.startsWith('file://') || photo.uri.startsWith('data:')) {
            const uploadResult = await uploadPhotoToStorage(photo.uri, supabaseTeamId!, photo.id);
            if (uploadResult.success && uploadResult.url) {
              cloudUri = uploadResult.url;
            } else {
              console.error('TEAM_SYNC: Failed to upload photo to storage:', photo.id);
              continue; // Skip this photo if storage upload fails
            }
          }

          // Save photo metadata to database
          const { error: photoError } = await supabase
            .from('photos')
            .upsert({
              id: photo.id,
              team_id: supabaseTeamId,
              game_id: photo.gameId || null,
              uri: cloudUri,
              uploaded_by: photo.uploadedBy || null,
              uploaded_at: photo.uploadedAt,
            }, { onConflict: 'id' });

          if (photoError) {
            console.error('TEAM_SYNC: Error saving photo metadata:', photoError);
          }
        } catch (photoErr) {
          console.error('TEAM_SYNC: Exception uploading photo:', photo.id, photoErr);
        }
      }

      console.log('TEAM_SYNC: Photos upload complete');
    }

    console.log('TEAM_SYNC: Team upload complete');
    return { success: true, teamId: supabaseTeamId };
  } catch (err: any) {
    console.error('TEAM_SYNC: Exception during upload:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to sync team' };
  }
}

/**
 * Download team data from Supabase for a new player joining
 * Returns the full team data that can be merged into local store
 */
export async function downloadTeamFromSupabase(teamId: string): Promise<{
  success: boolean;
  team?: Partial<Team>;
  error?: string;
}> {
  try {
    console.log('TEAM_SYNC: Downloading team from Supabase:', teamId);

    // Fetch team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !teamData) {
      console.error('TEAM_SYNC: Error fetching team:', teamError);
      return { success: false, error: teamError?.message || 'Team not found' };
    }

    console.log('TEAM_SYNC: Found team:', teamData.name);

    // Fetch players
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId);

    if (playersError) {
      console.error('TEAM_SYNC: Error fetching players:', playersError);
    }

    // Fetch games
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('team_id', teamId);

    if (gamesError) {
      console.error('TEAM_SYNC: Error fetching games:', gamesError);
    }

    // Fetch game responses for each game
    const gameIds = gamesData?.map(g => g.id) || [];
    const gameResponses: Record<string, { checkedIn: string[]; checkedOut: string[]; invited: string[] }> = {};

    if (gameIds.length > 0) {
      const { data: responsesData } = await supabase
        .from('game_responses')
        .select('*')
        .in('game_id', gameIds);

      if (responsesData) {
        for (const response of responsesData) {
          if (!gameResponses[response.game_id]) {
            gameResponses[response.game_id] = { checkedIn: [], checkedOut: [], invited: [] };
          }
          if (response.response === 'in') {
            gameResponses[response.game_id].checkedIn.push(response.player_id);
          } else if (response.response === 'out') {
            gameResponses[response.game_id].checkedOut.push(response.player_id);
          } else if (response.response === 'invited') {
            gameResponses[response.game_id].invited.push(response.player_id);
          }
        }
      }
    }

    // Fetch events
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamId);

    if (eventsError) {
      console.error('TEAM_SYNC: Error fetching events:', eventsError);
    }

    // Fetch photos
    const { data: photosData, error: photosError } = await supabase
      .from('photos')
      .select('*')
      .eq('team_id', teamId)
      .order('uploaded_at', { ascending: false });

    if (photosError) {
      console.error('TEAM_SYNC: Error fetching photos:', photosError);
    } else {
      console.log('TEAM_SYNC: Fetched', photosData?.length || 0, 'photos');
    }

    // Transform Supabase data to local store format
    const players: Player[] = (playersData || []).map(p => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email,
      phone: p.phone,
      number: p.jersey_number || '',
      position: p.position || 'C',
      positions: p.positions || [],
      avatar: p.avatar,
      roles: p.roles || [],
      status: p.status || 'active',
      isInjured: p.is_injured || false,
      isSuspended: p.is_suspended || false,
      stats: p.stats || {},
      goalieStats: p.goalie_stats || {},
      pitcherStats: p.pitcher_stats || {},
      gameLogs: p.game_logs || [],
      notificationPreferences: p.notification_preferences
        ? {
            ...p.notification_preferences,
            pushToken: p.push_token || p.notification_preferences?.pushToken || undefined,
          }
        : p.push_token
          ? { pushToken: p.push_token }
          : undefined,
    }));

    const games: Game[] = (gamesData || []).map(g => {
      const responses = gameResponses[g.id] || { checkedIn: [], checkedOut: [], invited: [] };
      return {
        id: g.id,
        opponent: g.opponent,
        date: g.date,
        time: g.time,
        location: g.location,
        address: g.address || '',
        jerseyColor: g.jersey_color || '',
        notes: g.notes,
        showBeerDuty: g.show_beer_duty || false,
        beerDutyPlayerId: g.beer_duty_player_id,
        lineup: g.hockey_lineup,
        basketballLineup: g.basketball_lineup,
        baseballLineup: g.baseball_lineup,
        soccerLineup: adaptLegacySoccerLineup(g.soccer_lineup),
        soccerDiamondLineup: g.soccer_diamond_lineup,
        inviteReleaseOption: g.invite_release_option || 'now',
        inviteReleaseDate: g.invite_release_date,
        invitesSent: g.invites_sent || false,
        checkedInPlayers: responses.checkedIn,
        checkedOutPlayers: responses.checkedOut,
        invitedPlayers: [...responses.checkedIn, ...responses.checkedOut, ...responses.invited],
        photos: [],
      };
    });

    const events: Event[] = (eventsData || []).map(e => ({
      id: e.id,
      title: e.title,
      type: e.type || 'other',
      date: e.date,
      time: e.time,
      location: e.location,
      address: e.address,
      notes: e.notes,
      invitedPlayers: [],
      confirmedPlayers: [],
    }));

    // Transform photos
    const photos: Photo[] = (photosData || []).map(p => ({
      id: p.id,
      gameId: p.game_id || '',
      uri: p.uri, // Cloud URL from Supabase Storage
      uploadedBy: p.uploaded_by || '',
      uploadedAt: p.uploaded_at,
    }));

    const teamSettings: TeamSettings = {
      sport: teamData.sport || 'hockey',
      showTeamStats: teamData.show_team_stats ?? true,
      showPayments: teamData.show_payments ?? true,
      showTeamChat: teamData.show_team_chat ?? true,
      showPhotos: teamData.show_photos ?? true,
      showRefreshmentDuty: teamData.show_refreshment_duty ?? true,
      refreshmentDutyIs21Plus: teamData.refreshment_duty_is_21_plus ?? true,
      showLineups: teamData.show_lineups ?? true,
      jerseyColors: teamData.jersey_colors || [],
      paymentMethods: teamData.payment_methods || [],
    };

    const team: Partial<Team> = {
      id: teamData.id,
      teamName: teamData.name,
      teamSettings,
      players,
      games,
      events,
      photos,
      notifications: [],
      chatMessages: [],
      chatLastReadAt: {},
      paymentPeriods: [],
      polls: [],
      teamLinks: [],
    };

    console.log('TEAM_SYNC: Download complete -', players.length, 'players,', games.length, 'games,', events.length, 'events,', photos.length, 'photos');
    return { success: true, team };
  } catch (err: any) {
    console.error('TEAM_SYNC: Exception during download:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to download team' };
  }
}

/**
 * Check if a team exists in Supabase
 */
export async function checkTeamExistsInSupabase(teamId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Upload a single photo to Supabase (storage + database)
 * Returns the cloud URL if successful
 */
export async function uploadSinglePhoto(
  photo: Photo,
  teamId: string,
  base64Data?: string
): Promise<{ success: boolean; cloudUrl?: string; error?: string }> {
  try {
    console.log('TEAM_SYNC: Uploading single photo:', photo.id);

    // Ensure team exists in Supabase - create minimal entry if not
    const teamExists = await checkTeamExistsInSupabase(teamId);
    if (!teamExists) {
      console.log('TEAM_SYNC: Team not in Supabase, creating minimal team record');
      const { error: teamError } = await supabase
        .from('teams')
        .insert({
          id: teamId,
          name: 'Team', // Placeholder - will be updated on full sync
          sport: 'hockey',
        });

      if (teamError && teamError.code !== '23505') { // Ignore if already exists
        console.error('TEAM_SYNC: Error creating team:', teamError);
        return { success: false, error: 'Failed to create team in cloud' };
      }
    }

    // Upload photo to storage
    // If base64Data is provided, use it directly (handles ph:// URIs on real iOS devices)
    // Otherwise fall back to reading from file:// URI
    let cloudUri = photo.uri;
    if (base64Data) {
      const uploadResult = await uploadPhotoToStorageBase64(base64Data, teamId, photo.id);
      if (uploadResult.success && uploadResult.url) {
        cloudUri = uploadResult.url;
      } else {
        return { success: false, error: uploadResult.error || 'Storage upload failed' };
      }
    } else if (photo.uri.startsWith('file://') || photo.uri.startsWith('data:')) {
      const uploadResult = await uploadPhotoToStorage(photo.uri, teamId, photo.id);
      if (uploadResult.success && uploadResult.url) {
        cloudUri = uploadResult.url;
      } else {
        return { success: false, error: uploadResult.error || 'Storage upload failed' };
      }
    }

    // Save photo metadata to database
    const { error: photoError } = await supabase
      .from('photos')
      .upsert({
        id: photo.id,
        team_id: teamId,
        game_id: photo.gameId || null,
        uri: cloudUri,
        uploaded_by: photo.uploadedBy || null,
        uploaded_at: photo.uploadedAt,
      }, { onConflict: 'id' });

    if (photoError) {
      console.error('TEAM_SYNC: Error saving photo metadata:', photoError);
      return { success: false, error: photoError.message };
    }

    console.log('TEAM_SYNC: Photo uploaded successfully:', cloudUri);
    return { success: true, cloudUrl: cloudUri };
  } catch (err: any) {
    console.error('TEAM_SYNC: Exception uploading photo:', err);
    return { success: false, error: err?.message || 'Upload failed' };
  }
}

/**
 * Delete a photo from Supabase (storage + database)
 */
export async function deleteSinglePhoto(
  photoId: string,
  teamId: string
): Promise<boolean> {
  try {
    console.log('TEAM_SYNC: Deleting photo:', photoId);

    // Delete from database
    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (error) {
      console.error('TEAM_SYNC: Error deleting photo from database:', error);
    }

    // Also try to delete from storage (ignore errors)
    const { deletePhotoFromStorage } = await import('./photo-storage');
    await deletePhotoFromStorage(teamId, photoId);

    return true;
  } catch (err) {
    console.error('TEAM_SYNC: Exception deleting photo:', err);
    return false;
  }
}

/**
 * Fetch photos from Supabase for a team
 * Used to sync photos from other team members
 */
export async function fetchTeamPhotos(teamId: string): Promise<{
  success: boolean;
  photos?: Photo[];
  error?: string;
}> {
  try {
    console.log('TEAM_SYNC: Fetching photos for team:', teamId);

    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('team_id', teamId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('TEAM_SYNC: Error fetching photos:', error);
      return { success: false, error: error.message };
    }

    const photos: Photo[] = (data || []).map(p => ({
      id: p.id,
      gameId: p.game_id || '',
      uri: p.uri,
      uploadedBy: p.uploaded_by || '',
      uploadedAt: p.uploaded_at,
    }));

    console.log('TEAM_SYNC: Fetched', photos.length, 'photos');
    return { success: true, photos };
  } catch (err: any) {
    console.error('TEAM_SYNC: Exception fetching photos:', err);
    return { success: false, error: err?.message || 'Failed to fetch photos' };
  }
}
