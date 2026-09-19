# 🤖 Telegram Chat Gating: Group & Channel Access Control via ONTON SBT Holdings

## 📌 Overview & Objective
Organizers want to reward event participants by granting exclusive access to Telegram private groups, VIP networking topics, or alpha channels. 

We need to equip `@theontonbot` with **Telegram Chat Gating Middleware**, automatically validating a user's ONTON SBT credentials before approving Telegram group join requests and periodically auditing member lists.

---

## 🔍 Existing Codebase References
* `telegram-bot/src/composers/`: Existing grammY / bot composers.
* `telegram-bot/src/handlers/sbtdistHandler.ts`: Admin SBT distribution handler.
* `mini-app/src/db/modules/sbt.db.ts`: `findUserSbtItems` & `findUserSbtForEvent`.

---

## 🛠️ Scope of Work & Detailed Implementation

### 1. Chat Join Request Interceptor
* Handle `chat_join_request` events in `telegram-bot`:
  * Look up user's Telegram ID in ONTON database.
  * Verify if user owns a valid, non-revoked SBT for the associated event:
    * If verified: `approveChatJoinRequest(chatId, userId)` and send welcome DM.
    * If not verified: Send DM with button: *"You need an active event ticket to join this group. Claim your ticket here."*

### 2. Scheduled Membership Auditor Cron
* Run a periodic audit job (e.g. daily/weekly):
  * Query members of gated chat.
  * Verify each member still holds the required badge (checks if badge was revoked via `revokeSBT`).
  * If revoked or expired, bot calls `banChatMember` / `unbanChatMember` (kick).

### 3. Organizer Admin Configuration
* In Client Web Panel (`client-web-panel`), allow event organizers to:
  * Link their Telegram group/channel.
  * Select which SBT/ticket tier is required for entry.
  * Generate one-time invite links or enable auto-approval.

---

## ✅ Acceptance Criteria
* [ ] Bot automatically approves join requests for users holding the required SBT.
* [ ] Users without the SBT are rejected/held with an informative DM and deep link.
* [ ] Revoking an SBT in `sbtService.revokeSbtBadge` triggers removal of the attendee from the gated chat.

