# ONTON v2.0 Production Deployment & Operations Guide

This guide details the deployment architecture, configuration steps, and operational verification procedures for releasing ONTON v2.0 ("The Luma of Telegram & Web3 Event OS") to production.

---

## 1. Release & Git Workflow

### Active Branches & Pull Requests
- **Staging / Active Development Branch:** `dev` (Pushed and up to date with origin/dev)
- **Production Branch:** `main`
- **Production Release PR:** [#883 — `feat: ONTON v2.0 — The Luma of Telegram & Web3 Event OS`](https://github.com/ExecutESG/onton/pull/883)

### Atomic Commit History on `dev`:
1. `55e4f283`: `feat(core): enable zero-friction free RSVP and unified ticket check-in resolution`
2. `c0c002fc`: `feat(payments): integrate Telegram Stars dual-rail checkout and in-app invoices`
3. `9bcbbb37`: `feat(bot): add automated telegram group gating and dynamic in-chat share cards`
4. `0f8ec42f`: `feat(tma): add attendee group invite link button and viral social share loop`
5. `6a93821b`: `feat(website): update landing page and SEO metadata for Telegram event OS positioning`
6. `0d9452aa`: `docs(marketing): add comprehensive GTM marketing playbook and launch campaign kit`

---

## 2. Automated CI/CD Pipeline

The GitHub Actions workflow [`.github/workflows/build-push-deploy.yml`](../.github/workflows/build-push-deploy.yml) automatically orchestrates:
1. **Service Change Detection:** Identifies changed services (`mini-app`, `participant-tma`, `telegram-bot`, `website`).
2. **Container Build & Push:** Compiles images and pushes to GitHub Container Registry (`ghcr.io/executesg/*`).
3. **Deployment via SSH:**
   - On branch `dev`: Deploys to the `onton-dev` Swarm stack (`dev.onton.live`).
   - On branch `main`: Deploys to the `onton` production Swarm stack (`onton.live` / `app.onton.live`).

---

## 3. Pre-Flight & BotFather Configuration

### A. Telegram Stars Enablement
1. Open `@BotFather` on Telegram.
2. Select your production bot (`@theontonbot` or equivalent).
3. Go to **Bot Settings** ➔ **Payments** ➔ **Telegram Stars**.
4. Confirm Stars payments are enabled. *(Note: Telegram Stars uses `currency: "XTR"` with an empty `provider_token: ""`. No merchant bank account or Stripe setup is required).*

### B. Group Admin Permissions
1. When organizers link an official Telegram group/channel to their event (`event_telegram_group`):
2. The bot must be added as an **Administrator** with permission to **"Invite Users via Link"**.
3. This allows the bot to call `createChatInviteLink` to generate private, single-use invite links for confirmed attendees.

---

## 4. Production Smoke Test Verification Checklist

Once merged and deployed to production, run this 5-minute end-to-end verification in Telegram:

| Step | Action | Expected Result | Verified? |
|---|---|---|---|
| **1. Free RSVP** | Open `@theontonbot` ➔ Open a Free Event ➔ Tap `RSVP (Free)` | User registers instantly without connecting a crypto wallet. Confirmation pass appears immediately. | [ ] |
| **2. Ticket Pass QR** | Open confirmed ticket pass ➔ View ticket details | Pass displays ticket status (`Active Pass 🎟️`), QR code for check-in, and `Invite Friends to Event` button. | [ ] |
| **3. Group Chat Gating** | Register for event with linked Telegram group | Bot automatically sends private DM with one-time invite link. Ticket page displays `💬 Join Official Event Chat`. | [ ] |
| **4. Telegram Stars** | Open paid event ➔ Select `⭐ Telegram Stars` ➔ Tap `Pay with Stars` | Native Telegram Stars payment sheet appears (Apple Pay / Google Pay / Stars balance). On approval, order completes and ticket is issued. | [ ] |
| **5. Door Scanner** | Organizer opens check-in scanner in Mini App ➔ Scans attendee QR pass | QR scanner resolves ticket instantly (handles ticket UUID, registrant UUID, or order UUID) and checks attendee in. | [ ] |
| **6. Landing Page SEO** | Share `https://onton.live` in a Telegram chat or on X | Rich preview card appears: *"ONTON — The Luma of Telegram & Web3 Event OS"* with updated hero banner. | [ ] |

---

## 5. Rollback Plan

If any critical issue arises post-deployment:
1. Revert PR #883 on `main`: `gh pr revert 883` or redeploy previous commit `eb95a16d`.
2. The CI/CD pipeline will automatically rebuild the previous image tags and roll back services in Docker Swarm without downtime.
