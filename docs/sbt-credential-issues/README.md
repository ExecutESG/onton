# ONTON Sovereign SBT & Credential Engine Roadmap

This directory contains technical specifications and issue templates for transitioning ONTON away from the retired TON Society / Getgems indexing stack into a sovereign, production-grade Web3 credential and event ticketing platform.

## Published GitHub Issues

| Issue | Title | Labels | Direct Link |
| :--- | :--- | :--- | :--- |
| **#992** | 🪪 **ONTON Passport TMA: Native Badge Showcase & In-App Credential Inspector** | `feature`, `priority:high`, `area:newton`, `area:mini-app` | [#992](https://github.com/ExecutESG/onton/issues/992) |
| **#993** | 📱 **Social Bragging: Telegram Story Sharing & Dynamic Canvas Cards for Event Badges** | `feature`, `priority:medium`, `area:newton`, `area:mini-app` | [#993](https://github.com/ExecutESG/onton/issues/993) |
| **#994** | 🌳 **Sovereign Merkle Proof API & Historical cSBT Ingestion Engine** | `feature`, `priority:high`, `area:mini-app` | [#994](https://github.com/ExecutESG/onton/issues/994) |
| **#995** | 📦 **Decentralized Metadata Pinning: Automated IPFS & Arweave Dual-Write for SBTs** | `enhancement`, `priority:high`, `area:mini-app`, `DevOps` | [#995](https://github.com/ExecutESG/onton/issues/995) |
| **#996** | 🎟️ **Anti-Fraud Check-In: Dynamic Rotating TOTP QR Passes & Instant SBT Issuance** | `feature`, `priority:high`, `area:newton`, `area:mini-app` | [#996](https://github.com/ExecutESG/onton/issues/996) |
| **#997** | 🤖 **Telegram Chat Gating: Group & Channel Access Control via ONTON SBT Holdings** | `feature`, `priority:medium`, `area:telegram-bot` | [#997](https://github.com/ExecutESG/onton/issues/997) |

---

## Architectural Context & Codebase Foundations

1. **On-Chain Anchor Contract:** [`contracts/csbt_anchor.fc`](../../contracts/csbt_anchor.fc)
2. **Cryptographic Engine:** [`mini-app/src/lib/csbt/`](../../mini-app/src/lib/csbt/) (`leaf.ts`, `merkleTree.ts`)
3. **Native TEP-85 SBT Implementation:** [`mini-app/src/lib/sbt.ts`](../../mini-app/src/lib/sbt.ts) & [`mini-app/src/services/sbtService.ts`](../../mini-app/src/services/sbtService.ts)
4. **Database Schemas:** [`sbtCollections.ts`](../../mini-app/src/db/schema/sbtCollections.ts), [`sbtItems.ts`](../../mini-app/src/db/schema/sbtItems.ts)
5. **API Procedures:** [`mini-app/src/server/routers/sbt.ts`](../../mini-app/src/server/routers/sbt.ts)
