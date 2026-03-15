# Team Manager

A mobile app for recreational sports teams to manage schedules, rosters, check-ins, payments, and team communication. Supports multiple sports including Hockey, Baseball, Basketball, Lacrosse, Soccer, and Softball.

## Roster Member Roles

The app supports four member types:
- **Player** (active) — requires jersey number, position, phone, and email
- **Reserve** — same requirements as Player but listed as reserve status
- **Coach** — no jersey number, position, phone, or email required; excluded from game check-in and lineups
- **Parent/Guardian** — no jersey number, position, phone, or email required; excluded from game check-in and lineups; can have an "Associated Player" (child) set

Coaches and Parents/Guardians are conditionally shown in separate roster sections only when:
1. The role is enabled in the Admin panel → Roster Roles settings
2. At least one member with that role has been added

The `associatedPlayerId` field on a Player (parent) links them to their child's player record.

## Stripe Payments

Stripe is integrated for in-app payments. Players can pay their outstanding dues directly in the Payments tab.

**Flow**:
1. Player taps "Pay with Stripe" in the Payment Methods section.
2. The app calls `POST /api/payments/create-checkout-session` on the backend.
3. Backend creates a Stripe Checkout Session and returns the URL.
4. A WebView modal opens showing the hosted Stripe Checkout page.
5. On success, the WebView detects the `vibecode://payment-success` redirect and closes.
6. Stripe fires a `payment_intent.succeeded` webhook to `POST /api/payments/webhook`.
7. The webhook marks the player's payment as "paid" in Supabase, triggering a realtime update.

**Backend env vars** (`backend/.env`):
- `STRIPE_SECRET_KEY` — Stripe secret key (test: `sk_test_...`, live: `sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Webhooks (set after registering webhook endpoint)
- `STRIPE_PLATFORM_FEE_PERCENT` — platform cut as a percentage (default `0.5` = 0.5%)

**Mobile env vars** (`mobile/.env`):
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (not currently used for WebView flow, but needed if native PaymentSheet is added later)

**Webhook registration**: In Stripe Dashboard → Developers → Webhooks, add endpoint:
`https://<your-backend-url>/api/payments/webhook`
Listen for: `payment_intent.succeeded`, `payment_intent.payment_failed`

**Connected accounts** (optional): If teams have their own Stripe accounts (`acct_xxx`), pass `teamStripeAccountId` in the checkout session request to route funds to them with a platform fee cut.

## Known Crash Fixes

**Login crash on fresh install**: `teamSettings` can be `null` before Zustand persist hydration completes. All accesses to `teamSettings.*` in `(tabs)/_layout.tsx` and `(tabs)/index.tsx` must use optional chaining (`teamSettings?.field`).

**Game detail black screen**: `game.jerseyColor` can be `null` from Supabase (stored as empty string `''`). All jersey color lookups must use a safe fallback (`safeJerseyColor = game.jerseyColor ?? '#1a1a1a'`). An error boundary (`GameScreenErrorBoundary`) wraps the game detail screen to prevent black screens and log errors.

## Sync Architecture

All real-time sync is handled by **Supabase Realtime** via a single WebSocket channel per team (`team-sync-v2:${teamId}`). The local Zustand store is a pure in-memory cache. On login, `loadTeamFromSupabase` fetches all data fresh.

**Foreground reconnect**: When the app returns from background (`AppState` change), the realtime channel is forcibly restarted and data is reloaded to catch any changes missed while backgrounded. This is critical for TestFlight where iOS may drop WebSocket connections.

**Multi-team sync**: `loadTeamFromSupabase` now also updates the `teams[]` array entry for the loaded team with full player/game/event data. This is required for `hasMultipleTeams` detection in the More tab to work correctly after app restart or team switch.

**Multi-team startup recovery**: On app startup, `_layout.tsx` checks Supabase for all teams the logged-in user belongs to. If any are missing from the local `teams[]` array (e.g. due to the previous parallel-load race condition), they are loaded sequentially. This fixes the issue where only 1 of 4 teams appeared in the team selector.

**Multi-team switching**: Team switching works WITHOUT calling `setIsLoggedIn(false)`. The correct flow is: set `pendingTeamIds` via `setPendingTeamSelection()`, then `router.replace('/select-team')`. The `_layout.tsx` auth guard will keep the user on `select-team` while `pendingTeamIds` is set, and only redirects logged-in users away from `inAuthGroup` screens (not `select-team`). After creating a second team, the user is shown the team selector automatically.

**Photo deduplication**: The uploader registers the photo ID in `syncedIdsRef` before inserting to Supabase, preventing the realtime INSERT event from adding a duplicate.

**Registration flow (email users)**: When a pending Supabase invitation is found for an email address, the app routes the user to Step 2 (create password) based ONLY on whether they have an active Supabase Auth session (`isAlreadyLoggedInWithEmail`). The local store's player password field is NOT used for email users because `loadTeamFromSupabase` pulls player passwords from Supabase into the local store, and these can be stale from partial/failed registration attempts, causing false "existing account" detection.

**Duplicate player prevention**: When accepting an invitation, `handleCompleteRegistration` and `handleExistingUserLogin` first search the local store for an existing player row matching the email/phone. If not found there (due to stale state or load timing), they now call `findPlayerInSupabaseByContact` to query Supabase directly before creating a new row. This prevents the duplicate player bug where the admin-created player row was not found in the local store and a second row was created with a different ID.

**Payment subscriptions**: `player_payments` and `payment_entries` subscriptions guard against cross-team events by checking if the changed row belongs to the current team's payment periods.

**Notification deduplication**: Both game invites and event invites use stable identifiers (`game-invite-${id}`, `event-invite-${id}`) so scheduling the same notification twice replaces rather than duplicates.

## Push Notifications

**Architecture**: Raw APNs device tokens via `getDevicePushTokenAsync()`. Backend sends directly via APNs HTTP/2 with a .p8 key — no Expo push service required.

**Token flow**:
1. App opens → `isLoggedIn && currentPlayerId && player exists in players[]`
2. Request APNs permission → get 64-char hex device token
3. POST to `/api/notifications/save-token` with `{ playerId, pushToken, platform }`
4. Backend upserts into Supabase `push_tokens` table (conflict on `token` column)
5. Old tokens for same player are deleted to prevent stale entries

**Race condition guard**: Push token registration now waits until the player record actually exists in the local `players[]` array before firing. This prevents registering a token with a stale/unresolved `currentPlayerId`. The effect re-runs when `playersLength` changes.

**Database**: The `push_tokens` table requires a `UNIQUE (token)` constraint for upsert to work. Run `supabase-push-tokens-migration.sql` in Supabase SQL Editor — it is idempotent and safe to re-run.

**Sending notifications**: All notification sends go through `sendPushToPlayers(playerIds[], ...)` which hits `POST /api/notifications/send-to-players` on the backend. The backend looks up APNs tokens for those player IDs and sends directly via Apple's `api.push.apple.com`.

**Debug endpoint**: `GET /api/notifications/debug-tokens?teamId=xxx` — returns all registered tokens per player. Use this to verify tokens are being saved after TestFlight install.

**TestFlight checklist**:
1. Run `supabase-push-tokens-migration.sql` in Supabase SQL Editor to ensure the table + unique constraint exist
2. Deploy the backend via the Deploy button in Vibecode (production URL: `stunned-guts.vibecode.run`)
3. Install TestFlight build and open the app — allow push notification permission when prompted
4. Check backend logs or debug endpoint to confirm token saved
5. Send a test notification from Admin tab → Communication → "Test Push Notifications"

**APNs env vars** (backend `.env`):
- `APNS_PRIVATE_KEY` — .p8 key contents (EC private key)
- `APNS_KEY_ID` — 10-char key ID from Apple Developer portal
- `APNS_TEAM_ID` — 10-char team ID from Apple Developer portal
- `APNS_BUNDLE_ID` — app bundle identifier (e.g. `com.vibecode.alignsports-jy5wjr`)
- `APNS_ENV` — `production` for TestFlight/App Store, `sandbox` for dev

**Self-check-in**: Players always see their own row in the check-in list even before the admin explicitly invites them. Toggling their own status auto-adds them to `invitedPlayers` and writes to `game_responses` / `event_responses` in Supabase. Other team members see the change in real time.

## Device Support

### iPad Optimization
- **Responsive Layouts**: The app automatically adapts to iPad screen sizes
- **Multi-Column Grids**: Roster, Schedule, and Payments screens display in 2-3 column grids on iPad
- **Wider Content Areas**: Chat and Admin screens use wider content areas on larger screens
- **Consistent Padding**: All screens have responsive padding that scales with screen size

## Features

### Multi-Sport Support
- Choose your sport: Baseball, Basketball, Hockey, Lacrosse, Soccer, or Softball
- Sport-specific positions automatically configured
- **Multiple Positions**: Players can be assigned multiple positions (e.g., LW/RW, SS/2B)
- Position names displayed appropriately for each sport
- **Lacrosse Support**: Configurable lineup with adjustable attackers (3-4), midfielders (3), and defenders (3-4) to support both boys and girls lacrosse formats

### Role-Based Access
- **Admin**: Full control - manage players, settings, create games, payment tracking
- **Captain**: Can create games, manage game invites, edit lineups
- **Player**: View schedules, check-in to games, view roster, chat

### Login
- Select your player profile to log in
- **Sign In with Apple**: iOS users can sign in with their Apple ID for quick, secure authentication
- **Email/Password**: Create an account with email and password (synced with Supabase cloud authentication)
- **Security Questions**: Set up a security question during registration to help recover your account if you forget your password
- **Profile Photo Setup**: New players can optionally add a profile photo during account setup (can skip)
- **Password Reset**: Forgot your password? Enter your email to receive a reset link via Supabase, or use security questions for offline recovery
- **Multi-Team Support**: If you belong to multiple teams, you'll see a team selection screen after login
  - Choose which team to view
  - Switch teams anytime via More > Switch Team
  - **Create New Team**: Add a new team without logging out via More > Create New Team
- Personalized experience based on your role
- Admin users see additional Admin tab

### Joining a Team (Cross-Device Invitations)
- **Invited Players**: When an admin adds you to their team, the invitation is stored in Supabase
  - The team's data (games, events, players, etc.) is also synced to Supabase
  - You can join from any device by entering your email/phone in "Invited to Join a Team"
  - The app will find your invitation and download the full team data
  - You'll see all the team's existing games, events, and players
- **Re-send Invite**: Admins can re-send invitations to players who didn't receive the original invite
  - Open the player's profile in Admin > Manage Players
  - Tap "Re-send Invite" at the bottom of the edit screen
  - Choose to send via text message or email
- **Existing Users Joining New Teams**: If you already have an account on another team:
  - Enter your email/phone to find the invitation
  - You'll see "Welcome back" and can sign in with your existing password
  - The correct invited team name is displayed (not your current team)
  - After signing in, the new team is added to your account with all its data
  - You'll be taken to the team selector to choose which team to view

### Team Creation
- **5-Step Setup Flow**:
  1. Your Info: Name, email, phone number, role (Player or Coach), and jersey number (players only)
  2. Password: Create secure password
  3. Security Question: For account recovery
  4. Team Details: Team name and sport selection
  5. Jersey Colors: Select your team's jersey colors from presets
- **Coach Role**: Select "Coach" if you're not a player - coaches don't need a jersey number
- **Real-Time Validation**: Email and phone are validated immediately when you move to the next field
  - If email or phone is already in use, you'll see an error right away
  - No more waiting until the end to find out there's a conflict
- **Form Persistence**: Your progress is automatically saved for 10 minutes
  - If you leave the app (e.g., to allow photo permissions), your data is preserved
  - Form is cleared when you successfully create a team or go back to login

### Schedule Tab
- View upcoming games, practices, and events with date, time, and location
- See jersey color for each game (shows color name like "White" or "Black")
- Quick view of check-in status
- Admins/Captains can add new games, practices, or events via the + button
- Tap any item to view full details
- **View Toggle**: Switch between List and Calendar views
  - List view shows items in a scrollable list
  - Calendar view shows a monthly calendar with indicators:
    - Green: Upcoming Games
    - Grey: Past Games (historical record)
    - Orange: Practices (upcoming only)
    - Blue: Events (upcoming only)
  - **Past Games**: Previous games remain visible on the calendar with grey indicators for historical reference
  - **Persistent Preference**: Your last selected view is remembered and restored on app reopen

### Creating Games, Practices & Events (Admin/Captain)
- **Game**: Schedule a game against an opponent
  - Set opponent, date, time, jersey color
  - Add optional notes
  - Invite players and set invite release options
- **Practice**: Schedule a team practice
  - Set date, time, and location
  - Add optional notes
  - Invite players
  - Practices display with orange accent color
- **Event**: Schedule team events (meetings, dinners, social gatherings)
  - Set event name, date, time, and location
  - Add optional notes
  - Invite players
  - Events display with blue accent color

### Game Details
- Full game information including time, location, and jersey color
- **Inline Editing**: Admins/Captains can tap any field to edit it directly
  - Tap the "Team vs Opponent" header to change the opponent name
  - Tap the Date card to change the game date
  - Tap the Time card to change the game time
  - Tap the Jersey card to select a different jersey color
  - Tap the Location card to edit the venue/address
- Tap the navigation icon on the Location card to open in Maps for directions
- Check in/out for games
- See who's been invited and who's checked in
- **In-App Notifications**: Send game invites and reminders to all players
- **Refreshment Duty**: Admin toggle to show/hide who's bringing drinks (age-appropriate toggle)
- **Final Score**: Captains/Admins can record game results
  - Enter final score for both teams
  - Select Win (green), Loss (red), Tie (grey), or OT Loss (orange, hockey only) result
  - Saves result and automatically updates team record
  - Can clear/update results if needed (adjusts record accordingly)
- **Game Stats**: Enter player statistics directly from the game detail screen
  - Only appears when Team Stats is enabled in Admin settings
  - Shows checked-in players for stat entry
  - Captains/Admins/Coaches can enter stats for any player
  - Players can enter their own stats if "Allow players to manage own stats" is enabled
  - Sport-specific stat fields (Goals, Assists, PIM for hockey, etc.)
  - Stats automatically added to player's game log and cumulative totals
  - Players with multiple positions (e.g., goalie who also plays forward) show buttons for both stat types
- **Hockey Lines** (Hockey only): Captains/Admins can set line combinations
  - Configure forward lines (LW - C - RW), defense pairs (LD - RD), and goalies
  - Choose 1-4 forward lines, 1-4 defense pairs, and 1-2 goalies
  - Lines display on game detail screen for all players to see
  - Tap the Lines card to edit (Captains/Admins)
- **Soccer Formations** (Soccer only): Choose between different formations
  - **4-4-2**: Classic formation with 4 defenders, 4 midfielders (LM, CM, CM, RM), and 2 strikers
  - **Diamond 4-1-2-1-2**: Diamond midfield with CDM, LM, RM, CAM, and 2 strikers
  - Formation selector shows visual preview of each formation
  - Configured lineups display on game detail screen
- **Basketball Lineups** (Basketball only):
  - Configure starting 5 with flexible position slots (PG, Guards, Forwards, Centers)
  - **Customizable Bench Spots**: Use +/- controls to set 0-15 bench spots
  - Assign players to bench in order
- **Baseball/Softball Lineups** (Baseball only):
  - Standard 9-position diamond layout
  - **Softball Mode**: Enable in Admin settings to add 10th fielder (Short Fielder/SF)
  - Short Fielder positioned between outfield and infield
- Send game invites via text or email (pre-fills recipients)
- **Invite More Players**: Admins/Captains can invite additional players after game creation
  - Invite individual players with one tap
  - Bulk invite all uninvited Active or Reserve players
  - Notifications sent automatically when inviting

### Game Creation (Admin/Captain)
- Set opponent, date, time
- **Location Search**: Search for venues and addresses with autocomplete
  - Type venue names (e.g., "Winterhurst") or addresses
  - Suggestions appear as you type
  - Tap a suggestion to select it
- Select jersey color from team's configured colors
- Add optional notes
- **Player Selection**:
  - Select which players to invite
  - Quick buttons to select all Active, all Reserve, or All players
  - Individual player toggle for custom selection
  - Defaults to all Active players if none selected
- **Invite Release Options** (NEW):
  - **Release invites now**: Players are notified immediately when game is created
  - **Schedule release**: Choose a specific date and time to send invites
  - **Don't send invites**: Create the game without notifications; send manually from game details later

### Roster Tab
- View all team players organized by position groups
- See player roles (Admin badge, Captain crown)
- See player status (Active/Reserve)
- Captain and Admin badges displayed next to names
- **Player Stats on Cards**: Each player card shows their stats directly below their name and position
  - Display-only (edit via Team Stats screen)
  - Sport-specific stats shown for each player
  - Hockey: GP, G, A, P, PIM, +/- (goalies: GP, W-L-T, SA, SV, SV%)
  - Baseball: AB, H, HR, RBI, K
  - Basketball: PTS, REB, AST, STL, BLK
  - Soccer: G, A, YC (goalies: GP, W-L-T, SA, SV, SV%)
- Add/edit players (Admin/Captain only)
- **Player Invites**: When creating a new player with phone/email, you can immediately send them a text or email invite to register and join the team
- **Role & Status Management** (Admin only): When editing a player, admins can:
  - Set player status: Active or Reserve
  - Toggle player roles: Captain and/or Admin
  - Players can have multiple roles simultaneously
  - **Admin Protection**: Cannot remove your own admin role if you're the only admin
  - **Confirmation Dialog**: Removing admin role shows a warning explaining what privileges will be lost

### Chat Tab
- Real-time team chat within the app
- Send messages to the entire team
- See who sent each message with avatars
- Messages grouped by date
- Modern chat interface with message bubbles
- **Real-Time Sync**: Chat messages sync across all team members' devices via Supabase
  - Messages are instantly delivered to all team members
  - When a teammate sends a message, you see it immediately
  - Messages persist in the cloud and sync when you rejoin
- **@Mentions**: Tag teammates to notify them
  - Type **@** to open the autocomplete dropdown
  - Type **@everyone** to notify all team members
  - Start typing a name after @ to filter the list
  - Tap a name to insert the mention
  - Mentions appear highlighted in cyan in messages
  - Mention notifications can be toggled in notification settings
- **GIF Support**: Send GIFs via GIPHY integration
- **Image Sharing**: Share images from your camera roll

### Payments Tab
- **Payment Methods**: Admin can add Venmo, PayPal, Zelle, or Cash App accounts
- **One-Tap Payments**: Players tap a button to open the payment app directly
- **Payment Tracking** (Admin/Captain):
  - Create payment periods (e.g., "Season Dues - Fall 2025")
  - Set total amount per player
  - **Team Total Owed** (Admin-only): Set the total amount owed by the team for each payment period
    - Displays total owed, total collected, and remaining balance
    - Automatically updates as players make payments
    - Only visible to admin users
  - **Player Selection**: Choose which players to include in each period
    - Quick select: All Active, All Reserve, All, or None
    - Individual player toggle for custom groups
    - Create different payment periods for different player groups with different amounts
  - Tap any player to view/add payments
  - **Payment Ledger**: Add multiple payments with amounts and dates
  - Payments automatically sum up and update status
  - Visual progress bar showing team payment status
- **Player Payment Details**:
  - View balance summary (Total Due, Paid, Remaining)
  - Add new payments with amount, date, and optional note
  - View complete payment history with dates
  - Delete incorrect payment entries
- **My Payment Status** (Players):
  - See your own payment details and history
  - View balance: what you owe vs what you've paid
  - Color-coded status: green for paid, amber for partial, default for unpaid

### Notifications
- In-app notification system for game invites and reminders
- View notifications in More > Notifications
- Unread badge shows count
- Tap notification to go to game details
- **Push Notifications**: Get notified even when the app is closed
  - Enable via More > Notification Settings > "Enable Push Notifications"
  - Send a test notification to verify it's working
  - Requires a physical device (not available in simulator)
- **Notification Preferences**: Customize which notifications you receive
  - Game Invites: Get notified when invited to games
  - Day Before Reminder: 24 hours before game time
  - Hours Before Reminder: 2 hours before game time
  - Chat Messages: Team chat notifications
  - Payment Reminders: Outstanding payment alerts
- **Local Scheduled Reminders**: Game reminders are scheduled on your device

### Admin Panel (Admin only)
- **Team Settings**: Edit team name
- **Sport Selection**: Change sport type (automatically remaps all player positions to equivalent positions in the new sport and clears stats)
- **Jersey Colors**: Add/remove team jersey colors
- **Payment Methods**: Configure Venmo/PayPal/Zelle/Cash App for the team
- **Refreshment Duty Toggle**: Enable/disable per game
- **Create Lines/Lineups Toggle**: Enable/disable the ability to set game lines (hockey) or lineups (other sports)
- **Softball Mode** (Baseball only): Enable to add 10th fielder (Short Fielder) position for softball teams
- **Team Stats Settings**:
  - **Use Team Stats**: Enable/disable the team stats feature
  - **Allow Player to Manage Own Stats**: When enabled, players can add and update their own game stats (not just admins)
- **Email Team**: Send an email to all or selected players directly from the app
  - Compose subject and message in-app
  - Select specific recipients or email entire team
  - Emails sent from noreply@alignsports.com (requires Supabase Edge Function setup)
- **Manage Team**:
  - **Add new players** with name, jersey number, position(s), phone, and email
  - **Position Selection**: Tap to select multiple positions for a player
  - **Coach Role**: Mark a member as a Coach - coaches don't need jersey numbers or positions
  - Send text/email invites to new players after creation
  - Edit existing player names, jersey numbers, positions, phone, and email
  - Phone numbers formatted as (XXX)XXX-XXXX
  - Assign roles (Captain, Admin, Coach)
  - Set status (Active, Reserve, Injured, Suspended)

### More Tab
- View your current player profile
- Access notifications with unread badge
- **Switch Team**: If you belong to multiple teams, tap to switch between them
- **Notification Settings**: Manage push notification preferences
- Email the entire team at once
- Send game invites to potential subs
- **Team Stats**: View comprehensive team statistics
  - Season record (Wins/Losses/Ties)
  - Win percentage (formatted as .XXX)
  - Season statistics summary (Games Played + sport totals)
  - Roster breakdown (active vs total players)
  - Player statistics with sport-specific columns:
    - Hockey: Goals, Assists, PIM (skaters) | GP, SA, SV, SV% (goalies)
    - Baseball: At Bats, Hits, Home Runs, RBI, Strikeouts
    - Basketball: Points, Rebounds, Assists, Steals, Blocks
    - Soccer: Goals, Assists, Yellow Cards (players) | GP, SA, SV, SV% (goalies)
  - Tap any player to add game stats
  - **Game Log**: Enter stats per game with date picker
    - Select game date
    - Enter stats for that specific game
    - View game log history at bottom of modal
    - Delete individual game entries
    - Cumulative stats automatically calculated from all game logs
- **Team Records**: View all-time team and individual records
  - **Championships**: Track team championship wins with year and title
  - **Team Records**: Historical team achievements across all seasons
    - Best Season Record (by win percentage)
    - Most Wins (Season)
    - Longest Win Streak
    - Longest Losing Streak
    - Most Team Goals (Season) - for hockey, soccer, and lacrosse
  - **Individual Records**: Best single-season performances per player
    - Sport-specific records (goals, assists, points, etc.)
    - Shows player name, value, and which season they set the record
  - Records persist across archived seasons and show the year set
- **Season History**: View all archived seasons with complete stats
  - Tap any season to expand and see detailed records
  - View team record (wins, losses, ties, streaks, goals)
  - View full roster with player stats from that season
  - View attendance summary for each player
  - **Restore Season** (Admin): Undo an accidental archive
    - Restores player stats and team record from the archived season
    - Removes the season from history
    - Only available when current season has no games or stats recorded
- **Feature Request**: Submit suggestions for new app features via email
- **Report Bug**: Report issues and bugs via email
- **My Availability**: Set dates when you're unavailable
  - **List View**: See all upcoming unavailable dates in a scrollable list
  - **Calendar View**: Visual monthly calendar showing unavailable dates
  - Add unavailable dates with date picker
  - Remove dates by tapping them
  - **Auto Check-Out**: When you add an unavailable date that has a game or event, you are automatically marked as OUT with note "Unavailable"
  - View conflicts with scheduled games/events before confirming
- Log out to switch players
- **Delete My Account**: Permanently delete your account and all associated data
  - Removes you from all teams you belong to
  - Deletes your profile, messages, and game attendance history
  - Requires typing "DELETE" to confirm (prevents accidental deletion)
  - This action cannot be undone

### Photos Tab
- View team photos in a gallery grid
- Take photos directly from the app
- Add photos from your camera roll
- All players can view and add photos
- **Cloud Sync**: Photos are automatically uploaded to Supabase Storage
  - Photos sync across all team members' devices in real-time
  - When a teammate uploads a photo, it appears automatically
  - When a player joins the team, they see all existing photos
  - Upload progress indicator shows when photos are being synced

## Player Status
- **Active**: Regular roster players, auto-invited to games
- **Reserve**: Backup players, can be selectively invited
- **Injured/Suspended**: Set end date to automatically mark player OUT for games within that period
  - When you set or update an injury/suspension end date, all existing games on or before that date will have the player auto-marked as OUT
  - When the end date is cleared or player is no longer injured/suspended, the OUT status is automatically removed from games where it was set for that reason

## Communication
- **In-App Notifications**: Game invites and reminders delivered within the app
- Send text invites that open your messaging app with pre-filled game details
- Send email invites with full game information
- Communication opens native apps (SMS/Email) with recipients pre-populated

## Payment Deep Links
When players tap a payment method:
- **Venmo**: Opens Venmo app with recipient pre-filled
- **PayPal**: Opens PayPal.me link in browser
- **Zelle**: Shows recipient info (bank-specific, no universal deep link)
- **Cash App**: Opens Cash App with recipient pre-filled

## Tech Stack
- Expo SDK 53 / React Native
- Expo Router for navigation
- Zustand for state management with AsyncStorage persistence
- NativeWind (Tailwind CSS) for styling
- React Native Reanimated for animations
- Lucide icons

## Website (webapp)

The website at `/website/webapp` is a Next.js 14 companion app that mirrors all mobile features. It uses the same dark design system (#080c14 background, #67e8f9 cyan accent) and shares the same Supabase backend.

### Website Pages
- `/app/schedule` — Events calendar and list view with RSVP
- `/app/roster` — Player roster with position grouping
- `/app/chat` — Team chat with GIF picker and mentions
- `/app/photos` — Team photo gallery
- `/app/payments` — Payment tracking and Stripe integration
- `/app/admin` — Admin panel (players, settings, season archiving)
- `/app/records` — Team records, championships, all-time leaders (across all seasons)
- `/app/stats` — Player statistics tables (sport-specific, editable)
- `/app/attendance` — Player attendance statistics with game-by-game history
- `/app/season-history` — Archived season viewer with expandable player stats tables
- `/app/messages` — Admin direct messaging (inbox/sent with read receipts)
- `/app/more` — Availability, polls, team links, notifications, email team, support

### Website Navigation
- **Sidebar** (desktop lg+): Events, Roster, Chat, Photos, Payments, More, Admin
- **TopBar**: Team name, notification bell with unread count, DM inbox icon with unread count
- **MobileNav** (mobile web): Bottom tab bar with up to 4 features + More

### Direct Messages (website)
The Messages page (`/app/messages`) mirrors the mobile direct messaging system:
- Admin-only compose with subject, body, and player multi-select
- Inbox/Sent tabs with read status indicators
- Real-time updates via Supabase channel
- Read receipts showing which recipients have read a message
- Delete messages (admin can delete any; recipient can delete from inbox)

## Data Persistence & Updates
- All user data (accounts, teams, players, games, etc.) is stored locally using AsyncStorage
- **Data Migration**: The app includes a migration system that preserves all user data during app updates
- When the app is updated, your accounts, teams, and all data are automatically preserved
- The Zustand store uses versioned persistence with a migrate function to handle schema changes safely

## Security
- **Password Hashing**: All passwords are hashed using SHA-256 with a device-specific salt before storage
- **Secure Salt Storage**: The encryption salt is stored in the device's secure keychain (expo-secure-store)
- **Security Answers**: Security question answers are also hashed for protection
- **Automatic Migration**: Existing plain-text passwords are automatically migrated to hashed format on next login

## Design
- Dark theme with ice blue (#67e8f9) accents
- Green accents (#22c55e) for payments
- Purple accents (#a78bfa) for admin features
- Amber accents (#f59e0b) for refreshment duty
- Smooth animations and haptic feedback
- Mobile-first, thumb-friendly design

## Testing Admin Features
Log in as **Mike Johnson** (#12) to access admin features. He is set as admin in the mock data.
