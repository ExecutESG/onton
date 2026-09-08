# Telegram Bot Commands

This document references the internal admin/organizer commands available in the **Telegram Bot Service** (`ontonbot/telegram-bot`).
These commands are primarily used for content management, rewards distribution, and event configuration.

## 1. Banner Management
- **Command**: `/banner u2 {event_uuid}`
- **Handler**: `handlers/bannerHandler.ts`
- **Role**: Admin only.
- **Function**: Updates the featured event banner in the frontend.
    - **Usage**: `/banner u2 550e8400-e29b-41d4-a716-446655440000`
    - **Logic**:
        1. Checks `isAdmin`.
        2. Validates UUID (36 chars).
        3. Updates `ontonSettings` in DB via `setBanner`.
        4. Clears Redis cache (`ontonSettings`).
- **Debugging**:
    - Check if User ID is in `users` table with `role='admin'`.
    - Verify Redis connection (if cache clearing fails).

## 2. Channel Posts (Buttons)
- **Commands**: `/channel_button`, `/remove_button`
- **Composer**: `composers/channelPostButtonComposer.ts`
- **Role**: Admin only.
- **Function**: Adds or removes inline URL buttons (e.g., "Register Now") to existing channel posts.
- **Flow**:
    1. `/channel_button` -> Asks for **Post ID**.
    2. User inputs Post ID -> Asks for **Link**.
    3. User inputs URL -> Asks for **Button Text**.
    4. Bot edits the message in the configured `announcement_channel_id`.
- **Debugging**:
    - Ensure the Bot is an **Admin** in the target channel.
    - Verify `announcement_channel_id` is set in `OnTonSettings`.

## 3. ID Conversion
- **Command**: `/2id` or `/toid`
- **Composer**: `composers/toIdComposer.ts`
- **Function**: Converts a forwarded message or username to a numeric User ID/Chat ID.
- **Usage**: Reply to a message with `/2id`.

## 4. SBT Distribution (Rewards)
- **Command**: `/sbtdist`
- **Composer**: `composers/sbtdistComposer.ts`
- **Function**: Distributes SBT (Soulbound Token) rewards to event attendees.
- **Flow**:
    1. Input **Event UUID**.
    2. **Selection Mode**:
        - **CSV**: Upload a CSV of User IDs.
        - **All Approved**: Auto-selects all `event_registrants` with `status='approved'`.
    3. System processes the list and returns a **Result CSV**.
- **Debugging**:
    - Check `event_registrants` table for expected users.
    - Verify `processCsvLinesForSbtDist` logic in `db/db.ts`.

## 5. Event Group Management
- **Command**: `/invitor`
- **Composer**: `composers/groupComposer.ts`
- **Role**: Organizer or Admin.
- **Function**: Links a Telegram Group to an Event for automated invites.
- **Flow**:
    1. List active "Online" events.
    2. User selects an event.
    3. User inputs the **Group ID** (e.g., `-100xyz`).
    4. Bot verifies it is an Admin in that group (`checkIfBotIsAdminLocal`).
    5. Updates `events.event_telegram_group` in DB.
- **Debugging**:
    - Bot MUST be added as Admin to the group *before* running the command.

## 6. Collections
- **Command**: `/collections`
- **Composer**: `composers/collectionComposer.ts`
- **Function**: Manage NFT Collections (deployment, verification).

## 7. Affiliate System
- **Command**: `/affiliate`
- **Composer**: `composers/affiliateComposer.ts`
- **Function**: Create/Manage tracking links for marketing.

## 8. Play2Win Featured
- **Command**: `/play2winfeatured`
- **Composer**: `composers/play2winfetured.ts`
- **Role**: Admin.
- **Function**: Sets the list of featured Tournaments/Games.
- **Usage**: Send comma-separated Tournament IDs (e.g., `123,456`).
- **Logic**: Updates `ontonSettings` -> `play2win_featured_ids`.

## 9. Broadcast
- **Command**: `/broadcast`
- **Composer**: `composers/broadcast.ts`
- **Function**: Mass messaging to bot users.

## 10. Tournaments
- **Command**: `/tournament`
- **Composer**: `composers/tournamentComposer.ts`
- **Function**: Management of tournament entries and detailed settings.
