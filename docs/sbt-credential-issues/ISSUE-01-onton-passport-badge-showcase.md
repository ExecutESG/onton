# 🪪 ONTON Passport TMA: Native Badge Showcase & In-App Credential Inspector (Kill Getgems Dependency)

## 📌 Overview & Objective
Currently, both the Participant TMA (`newton/apps/participant-tma`) and Mini App redirect users to `getgems.io/collection/...` to view their tickets and SBT badges. With TON Society and TON ID now retired, Getgems no longer indexes or resolves custom cSBT items, causing users to land on empty or broken pages. 

We must eliminate the external dependency on Getgems by building a sovereign, in-app **ONTON Passport & Badge Showcase** inside the Telegram Mini App.

---

## 🔍 Existing Codebase References
* `newton/apps/participant-tma/app/event/[id]/SbtCollectionSection.tsx`: Lines 19-22 redirect to `https://getgems.io/collection/${collection_address}`.
* `newton/apps/participant-tma/app/ticket/[id]/page.tsx`: Line 64 opens `getgems.io` for contract inspection.
* `mini-app/src/server/routers/sbt.ts`: `getUserBadges` & `getWalletBadges` endpoints already exist and query `sbt_items`.
* `mini-app/src/components/csbt/CsbtClaimCard.tsx`: Standalone claim card component with Merkle root display.

---

## 🛠️ Scope of Work & Detailed Implementation

### 1. In-App Passport View (`/passport` / `/showcase`)
* Build a responsive, dark-mode badge gallery in `participant-tma` and `mini-app`.
* Group user credentials into categories:
  * 🎟️ **Event Passes** (General admission, VIP, Speaker)
  * 🏆 **Tournament & Contest Wins** (Hackathons, gaming leaderboards)
  * 🎖️ **Community & Hub Badges** (Ambassadors, organizers)
* Fast caching via TanStack Query and optimistic rendering.

### 2. Interactive Badge Inspector Modal
* Clicking any badge opens an in-app bottom sheet / modal displaying:
  * High-resolution 3D / animated badge art.
  * Title, event name, organizer, and attendance timestamp.
  * On-chain verification pill: **"Verified on TON"** with link to Tonviewer / Tonscan contract anchor.
  * Cryptographic proof details (Merkle leaf index, root hash, contract authority).

### 3. Decouple Getgems Across All Screens
* Replace `tmaUtils?.openLink('https://getgems.io/...')` in `SbtCollectionSection.tsx` with opening the local Badge Inspector modal.
* Update ticket pages to link to Tonviewer (`https://tonviewer.com/${address}`) instead of Getgems when viewing raw contract addresses.

### 4. Public Web3 Profile (`onton.me/@username`)
* Server-rendered Next.js public profile showcasing user credentials, attendance stats, and sybil reputation score for sharing on Twitter/LinkedIn.

---

## ✅ Acceptance Criteria
* [ ] No links to `getgems.io` remain in `participant-tma` or `mini-app` for SBT/cSBT viewing.
* [ ] Navigating to `/passport` displays all badges held by the authenticated Telegram user and connected TON wallet.
* [ ] Clicking a badge opens the Badge Inspector modal with full metadata and on-chain verification links.
* [ ] Mobile haptic feedback fires on badge interaction inside Telegram.

