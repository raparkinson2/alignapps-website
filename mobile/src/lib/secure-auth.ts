/**
 * Secure authentication helpers
 *
 * These functions wrap the store's auth methods with proper password hashing.
 * They handle both new hashed passwords and legacy plain text passwords for migration.
 */
import { useTeamStore, Player } from './store';
import { hashPassword, verifyPassword, isAlreadyHashed, hashSecurityAnswer, verifySecurityAnswer } from './crypto';
import { supabase } from './supabase';

type LoginResult = {
  success: boolean;
  error?: string;
  playerId?: string;
  multipleTeams?: boolean;
  teamCount?: number;
};

type RegisterResult = {
  success: boolean;
  error?: string;
};

/**
 * Securely login with email and password
 * Handles both hashed and legacy plain text passwords
 */
export async function secureLoginWithEmail(email: string, password: string): Promise<LoginResult> {
  const state = useTeamStore.getState();

  // Find the player to check their password format
  let playerToCheck: Player | undefined;

  // Check in teams first
  for (const team of state.teams) {
    const player = team.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
    if (player?.password) {
      playerToCheck = player;
      break;
    }
  }

  // Fallback to legacy players array
  if (!playerToCheck) {
    playerToCheck = state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
  }

  if (!playerToCheck) {
    return { success: false, error: 'No account found with this email' };
  }

  if (!playerToCheck.password) {
    return { success: false, error: 'Please create an account first' };
  }

  // Check if password is already hashed (64 char hex string)
  const storedPassword = playerToCheck.password;
  let passwordMatches = false;

  if (isAlreadyHashed(storedPassword)) {
    // Hashed password (bcrypt or legacy SHA-256) — verify and migrate if needed
    const { valid, legacy } = await verifyPassword(password, storedPassword);
    passwordMatches = valid;
    if (valid && legacy) {
      // Upgrade legacy SHA-256 hash to bcrypt silently
      const newHash = await hashPassword(password);
      useTeamStore.getState().updatePlayer(playerToCheck.id, { password: newHash });
    }
  } else {
    // Very old plain-text password — compare directly then migrate
    passwordMatches = storedPassword === password;
    if (passwordMatches) {
      const hashedPassword = await hashPassword(password);
      useTeamStore.getState().updatePlayer(playerToCheck.id, { password: hashedPassword });
    }
  }

  if (!passwordMatches) {
    return { success: false, error: 'Incorrect password' };
  }

  // Password verified - get fresh state and use verified login to handle team selection
  // Must get fresh state in case password migration updated the store
  return useTeamStore.getState().loginWithEmailVerified(email);
}

/**
 * Securely login with phone and password
 * Handles both hashed and legacy plain text passwords
 */
export async function secureLoginWithPhone(phone: string, password: string): Promise<LoginResult> {
  const state = useTeamStore.getState();
  const normalizedPhone = phone.replace(/\D/g, '');

  // Find the player to check their password format
  let playerToCheck: Player | undefined;

  // Check in teams first
  for (const team of state.teams) {
    const player = team.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
    if (player?.password) {
      playerToCheck = player;
      break;
    }
  }

  // Fallback to legacy players array
  if (!playerToCheck) {
    playerToCheck = state.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
  }

  if (!playerToCheck) {
    return { success: false, error: 'No account found with this phone number' };
  }

  if (!playerToCheck.password) {
    return { success: false, error: 'Please create an account first' };
  }

  // Check if password is already hashed
  const storedPassword = playerToCheck.password;
  let passwordMatches = false;

  if (isAlreadyHashed(storedPassword)) {
    const { valid, legacy } = await verifyPassword(password, storedPassword);
    passwordMatches = valid;
    if (valid && legacy) {
      const newHash = await hashPassword(password);
      useTeamStore.getState().updatePlayer(playerToCheck.id, { password: newHash });
    }
  } else {
    passwordMatches = storedPassword === password;
    if (passwordMatches) {
      const hashedPassword = await hashPassword(password);
      useTeamStore.getState().updatePlayer(playerToCheck.id, { password: hashedPassword });
    }
  }

  if (!passwordMatches) {
    return { success: false, error: 'Incorrect password' };
  }

  // Password verified - get fresh state and use verified login to handle team selection
  // Must get fresh state in case password migration updated the store
  const result = useTeamStore.getState().loginWithPhoneVerified(phone);

  // Set Supabase session context so RLS policies work for phone-auth users
  if (result.success && result.playerId) {
    void supabase.rpc('set_player_context', { player_id: result.playerId });
  }

  return result;
}

/**
 * Securely register a new admin with hashed password
 */
export async function secureRegisterAdmin(
  name: string,
  email: string,
  password: string,
  teamName: string,
  options?: { phone?: string; jerseyNumber?: string; isCoach?: boolean; securityQuestion?: string; securityAnswer?: string }
): Promise<RegisterResult> {
  // Hash the password before storing
  const hashedPassword = await hashPassword(password);

  // Hash security answer if provided
  let hashedSecurityAnswer: string | undefined;
  if (options?.securityAnswer) {
    hashedSecurityAnswer = await hashSecurityAnswer(options.securityAnswer);
  }

  // Call the store's register function with the hashed password
  const result = useTeamStore.getState().registerAdmin(name, email, hashedPassword, teamName, {
    ...options,
    // We'll update the security answer separately since the store function might not support it directly
  });

  // If registration succeeded and we have a security question/answer, update the player
  if (result.success && options?.securityQuestion && hashedSecurityAnswer) {
    const state = useTeamStore.getState();
    const player = state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
    if (player) {
      useTeamStore.getState().updatePlayer(player.id, {
        securityQuestion: options.securityQuestion as Player['securityQuestion'],
        securityAnswer: hashedSecurityAnswer,
      });
    }
  }

  return result;
}

/**
 * Securely register an invited player with hashed password
 */
export async function secureRegisterInvitedPlayer(email: string, password: string): Promise<LoginResult> {
  // Hash the password before storing
  const hashedPassword = await hashPassword(password);

  // Call the store's register function with the hashed password
  return useTeamStore.getState().registerInvitedPlayer(email, hashedPassword);
}

/**
 * Securely register an invited player by phone with hashed password
 */
export async function secureRegisterInvitedPlayerByPhone(phone: string, password: string): Promise<LoginResult> {
  // Hash the password before storing
  const hashedPassword = await hashPassword(password);

  // Call the store's register function with the hashed password
  return useTeamStore.getState().registerInvitedPlayerByPhone(phone, hashedPassword);
}

/**
 * Securely reset a player's password
 */
export async function secureResetPassword(playerId: string, newPassword: string): Promise<void> {
  const hashedPassword = await hashPassword(newPassword);
  useTeamStore.getState().updatePlayer(playerId, { password: hashedPassword });
}

/**
 * Verify a security answer for password recovery
 */
export async function verifyPlayerSecurityAnswer(playerId: string, answer: string): Promise<boolean> {
  const state = useTeamStore.getState();
  const player = state.players.find((p) => p.id === playerId);

  if (!player?.securityAnswer) {
    return false;
  }

  // Check if security answer is already hashed
  if (isAlreadyHashed(player.securityAnswer)) {
    return verifySecurityAnswer(answer, player.securityAnswer);
  } else {
    // Legacy plain text - compare directly (case insensitive)
    const matches = player.securityAnswer.toLowerCase() === answer.toLowerCase().trim();

    if (matches) {
      // Migrate to hashed format
      const hashedAnswer = await hashSecurityAnswer(answer);
      useTeamStore.getState().updatePlayer(playerId, { securityAnswer: hashedAnswer });
      console.log('Migrated security answer to hashed format');
    }

    return matches;
  }
}

/**
 * Update a player's security question and answer (hashed)
 */
export async function setSecurityQuestion(
  playerId: string,
  question: Player['securityQuestion'],
  answer: string
): Promise<void> {
  const hashedAnswer = await hashSecurityAnswer(answer);
  useTeamStore.getState().updatePlayer(playerId, {
    securityQuestion: question,
    securityAnswer: hashedAnswer,
  });
}
