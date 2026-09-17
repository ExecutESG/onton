# 🌳 Sovereign Merkle Proof API & Historical cSBT Ingestion Engine

## 📌 Overview & Objective
With TON Society decommissioned, 3 million wallets that hold cSBTs have lost their indexing provider. ONTON already has an on-chain Merkle anchor contract (`contracts/csbt_anchor.fc`) and cryptographic tree generator (`mini-app/src/lib/csbt/`). 

We need to formalize a sovereign, open **Merkle Proof REST API** and build an **Ingestion Pipeline** for historical event attendee lists, allowing event organizers to restore their community's badge history on ONTON.

---

## 🔍 Existing Codebase References
* `contracts/csbt_anchor.fc`: On-chain compression anchor contract storing `merkle_root` and verifying proofs (`op::verify_proof`).
* `mini-app/src/lib/csbt/leaf.ts`: Deterministic leaf generator `SHA256(index + owner + event_uuid + metadata_hash)`.
* `mini-app/src/lib/csbt/merkleTree.ts`: Complete tree construction, proof step serialization to TON Cells, and offline verification.
* `mini-app/src/db/schema/sbtCollections.ts` & `sbtItems.ts`: Drizzle schema.

---

## 🛠️ Scope of Work & Detailed Implementation

### 1. Open Public Proof REST Endpoint
* Implement `GET /api/v1/csbt/proof`:
  * Query params: `collectionAddress`, `walletAddress` (or `userId`).
  * Returns JSON payload matching the Compressed SBT standard:
    ```json
    {
      "leafIndex": 42,
      "leafHashHex": "...",
      "rootHex": "...",
      "proofCellBoc": "base64...",
      "metadata": { ... }
    }
    ```
* Fast in-memory / Redis caching of calculated Merkle branches for active event anchors.

### 2. Historical Participant Data Ingestion CLI & Web Uploader
* Build an admin tool (`scripts/import-csbt-history.ts` or client panel upload):
  * Accepts CSV/JSON export containing: `wallet_address`, `event_uuid`, `badge_index`, `metadata_json`.
  * Computes deterministic leaf hashes and verifies that the reconstructed Merkle root matches the frozen on-chain anchor contract root.
  * Inserts verified records into `sbt_items` with `status = "minted"`.

### 3. Dual-Verification Engine
* Endpoint to verify proof either:
  1. **Locally / Off-chain** (zero gas, sub-millisecond) via `verifyProofOffline`.
  2. **On-chain** via TonCenter / TVM contract call invoking `op::verify_proof`.

---

## ✅ Acceptance Criteria
* [ ] `GET /api/v1/csbt/proof` returns valid base64 BoC proof cells that successfully verify against `csbt_anchor.fc`.
* [ ] Ingestion script successfully loads historical participant data and validates Merkle root integrity.
* [ ] Unit and integration tests cover tree depth > 10 (1024+ leaves).

