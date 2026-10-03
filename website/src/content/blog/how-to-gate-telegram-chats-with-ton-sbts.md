---
title: "How to Gate Private Telegram Groups with TON Soulbound Tokens (SBTs)"
slug: "how-to-gate-telegram-chats-with-ton-sbts"
meta_description: "Automate Telegram chat gating with TON Soulbound Tokens (SBTs). Prevent link leaks, eliminate manual admin reviews, and secure Web3 event communities."
primary_keyword: "token gated telegram group"
keywords:
  - "token gated telegram group"
  - "gate telegram chats with ton sbts"
  - "soulbound token telegram gating"
  - "telegram community bot ton"
  - "crypto event private group access"
category: "Event Guides"
tags:
  - "Telegram Gating"
  - "Soulbound Tokens"
  - "TON Blockchain"
  - "Community Management"
  - "Anti-Sybil"
author: "Mahdi Farimani"
author_role: "Founder & Product Lead, ONTON"
author_link: "https://t.me/mahdifarimani"
publishedAt: "2026-09-10"
updatedAt: "2026-09-10"
readTime: "9 min read"
featured_image: "https://files.catbox.moe/k2w91k.png"
cta_text: "Set Up Automated Chat Gating on ONTON →"
cta_href: "https://t.me/theontonbot/event"
---

> **Quick Summary:**
> - Manual invite links to private event Telegram groups leak within hours, flooding private communities with spammers and unverified guests.
> - By gating Telegram groups with **Soulbound Tokens (SBTs)** on the TON blockchain, community access is permanently tied to verified real-world event attendees.
> - ONTON provides an automated bot pipeline that handles token issuance, single-use chat invitation, and automated expulsion upon ticket cancellation.

---

## The Problem with Static Telegram Invite Links

Event organizers and DAO community leads understand the pain of managing exclusive attendee chats:
1. **Link Leaks:** An attendee shares the "VIP Event Chat" link into a public group, resulting in hundreds of unauthorized lurkers.
2. **Admin Burnout:** Community managers spend hours manually reviewing wallet screenshots or cross-checking ticket numbers against Telegram usernames.
3. **No Exit Mechanism:** When an attendee cancels their ticket or is ejected for violating code-of-conduct, organizers have no programmatic way to remove them from all related sub-channels.

---

## Why Soulbound Tokens (SBTs)?

A [soulbound-token](/resources/glossary/soulbound-token) (SBT) is a non-transferable NFT anchored to a specific wallet. Unlike standard ERC-721 or [Jetton](/resources/glossary/jetton) tokens that can be purchased on secondary markets or loaned to third parties:
- An SBT cannot be sold or transferred to another address.
- It acts as an irrevocable cryptographic reputation and attendance credential.
- When minted upon ticket purchase, it guarantees that the person in the Telegram group is the exact verified attendee.

---

## Architecture: How ONTON Automates Telegram Chat Gating

```
+------------------+       +-------------------+       +--------------------+
|  Attendee Buys   | ----> |  ONTON Smart      | ----> |  Telegram Gating   |
|  Ticket in App   |       |  Contract Mints   |       |  Bot Generates     |
|  (@theontonbot)  |       |  Event SBT on TON |       |  Single-Use Link   |
+------------------+       +-------------------+       +--------------------+
                                                                 |
                                                                 v
+------------------+       +-------------------+       +--------------------+
| Dynamic Access:  | <---- | Periodic Chain    | <---- |  User Enters       |
| Auto-Revoke if   |       | Auditor Checks    |       |  Private Group     |
| Ticket Refunded  |       | Wallet Ownership  |       |  Instantly         |
+------------------+       +-------------------+       +--------------------+
```

### 1. Zero-Gas Wallet Binding
Using [ton-connect](/resources/glossary/ton-connect), the attendee binds their TON wallet (Tonkeeper, Telegram Wallet, MyTonWallet) inside the ONTON [Telegram Mini App](/resources/glossary/tma-telegram-mini-app) during ticket registration.

### 2. On-Chain SBT Issuance
The smart contract deploys an immutable SBT record containing:
- `eventId`: Unique identifier of the conference or meetup.
- `tier`: General Admission, Speaker, VIP, or Sponsor.
- `timestamp`: Block time of purchase.

### 3. Telegram Single-Use Join Request
ONTON's bot creates an ephemeral Telegram chat invite link configured with `creates_join_request=True`. When the user clicks join, the bot verifies the wallet signature and approves the join request in real time.

---

## Step-by-Step Setup for Organizers

1. **Add @theontonbot as Admin to your Telegram Group:** Grant permissions to invite users via link and ban users.
2. **Link Event in Mini App:** Open `@theontonbot/event` and choose "Connect Community Chat".
3. **Select Gating Rules:**
   - Require General Admission SBT.
   - Require VIP SBT for exclusive breakout topic chats.
4. **Publish Event:** All registered attendees now receive instantaneous, secure entry.

---

## Key Benefits
- 🛡️ **Zero Link Leakage:** Shared links will simply reject unauthorized clickers.
- ⚡ **Zero Manual Effort:** 10,000 attendees can enter smoothly in minutes.
- 🎯 **Sybil Proof:** Built-in [sybil-resistance](/resources/glossary/sybil-resistance) guarantees high-signal networking.

---

👉 **[Protect Your Community with ONTON Chat Gating](https://t.me/theontonbot/event)**
