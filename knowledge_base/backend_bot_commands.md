# Telegram Bot Commands

> Last verified against dev: 2026-10-03

Commands and callbacks in `telegram-bot/` (`ontonbot/telegram-bot`). Commands are registered in `telegram-bot/src/main.ts` and in composers listed in `telegram-bot/src/composers/index.ts`.

## 1. Command index

| Command | Source | Role check | Purpose |
|---|---|---|---|
| `/start` | `main.ts` → `handlers/startHandler.ts` | None | Onboarding. Resets the session first. |
| `/id` | `main.ts` → `handlers/announceBotAdded.ts` | — | Chat/bot-added announcement. |
| `/org` | `main.ts` → `handlers/orgHandler.ts` | Admin | `/org <user\|organizer\|admin> <username>` changes a user's role. |
| `/cmd` | `main.ts` → `handlers/cmdHandler.ts` | Admin | Admin command handler. |
| `/banner` | `main.ts` → `handlers/bannerHandler.ts` | Admin | Set the featured event banner. |
| `/update_profiles` | `main.ts` → `handlers/updateAdminOrganizerProfilesHandler.ts` | Admin | Refresh profiles of admin/organizer users. |
| `/help` | `composers/helpComposer.ts` | Admin | Lists 12 commands. |
| `/cancel` | `composers/cancelComposer.ts` | None | Leaves a multi-step flow. |
| `/sbtdist` | `composers/sbtdistComposer.ts` | Not in the composer | SBT reward distribution. |
| `/sendpoll` | `composers/pollComposer.ts` | Admin | Queue a poll (sent by `pollSenderCron`). |
| `/broadcast` | `composers/broadcast.ts` | Admin | Mass message (sent by `broadcastSenderCron`). |
| `/tournament` | `composers/tournamentComposer.ts` | Not in the composer | Tournament post flow. |
| `/collections` | `composers/collectionComposer.ts` | Admin | NFT collection management. |
| `/2id` | `composers/toIdComposer.ts` | Admin | Resolve a numeric user/chat ID. There is no `/toid` alias. |
| `/channel_button`, `/remove_button` | `composers/channelPostButtonComposer.ts` | Admin | Add/remove an inline URL button on a channel post. |
| `/play2winfeatured` | `composers/play2winfetured.ts` | Admin | Featured tournament IDs. Still registered although the Play2Win UI is retired. |
| `/invitor` | `composers/groupComposer.ts` | Organizer or admin | Link a Telegram group to an event. |
| `/affiliate` | `composers/affiliateComposer.ts` | Organizer or admin | Affiliate links for upcoming paid events (admins see all; organizers their own). |

## 2. Details

### `/banner`
- Usage: `/banner u2 <event_uuid>`.
- Checks admin, validates the UUID, updates `ontonSettings` (`setBanner`) and clears the `ontonSettings` Redis cache.

### `/channel_button`
- Multi-step: post ID → link → button text. The bot then edits the post in `announcement_channel_id`.
- The bot must be an admin in that channel.

### `/sbtdist`
- Input an event UUID, then choose a CSV of user IDs or all approved registrants. Returns a result CSV.

### `/invitor`
1. Lists **all** events with `has_registration` that have not ended (`telegram-bot/src/db/events.ts`). Not limited to online events.
2. User picks an event and sends a group ID.
3. Bot checks it is admin in that group, then stores the group on the event.
- Add the bot as admin to the group before running the command.

Multi-step flows use the in-memory grammY session. A bot restart drops any flow in progress.

## 3. Moderation callbacks

Handled in `telegram-bot/src/composers/moderationComposer.ts`. Buttons come from menus built by the mini-app (`mini-app/src/moderationBot/menu.ts`) and posted to the moderation group (`MODERATION_GROUP_ID`).

| Callback | Effect |
|---|---|
| `delist` / `confirmDelist` | Event `hidden=true`, `enabled=false` |
| `relist` | Restores the event |
| `warn` | Warns the organizer |
| `ban` | Sets the organizer's role to `ban` and delists all their events |
| `dismissReport` | Dismisses an abuse report |
| `updateEventData` | Event data update action |
| `approve` / `reject*` | Approve / reject actions |

Moderator check (`isModerator`): role `admin`, the `moderator` flag in `user_custom_flags`, `ADMIN_TELEGRAM_ID`, or a small hardcoded allowlist.

## 4. Payments (not commands)

`pre_checkout_query` and `successful_payment` for Telegram Stars are in `telegram-bot/src/handlers/starsPaymentHandler.ts`. See [telegram_bot_overview.md](telegram_bot_overview.md#6-telegram-stars-flow).

## Known issues (tracked in QA)

- F-33: Stars pre-checkout approves without validating order, price or capacity.
