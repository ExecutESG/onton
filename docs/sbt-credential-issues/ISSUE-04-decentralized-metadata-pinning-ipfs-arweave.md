# 📦 Decentralized Metadata Pinning: Automated IPFS & Arweave Dual-Write for SBTs

## 📌 Overview & Objective
Currently, SBT collection and item metadata are uploaded to a local MinIO bucket (`storage.onton.live`). This creates a centralized single point of failure: if DNS changes, the server restarts, or MinIO experiences downtime, all on-chain NFT and SBT metadata breaks.

We must upgrade our metadata pipeline to dual-write to **IPFS / Pinata** or **Arweave**, storing permanent decentralized URIs on-chain.

---

## 🔍 Existing Codebase References
* `mini-app/src/lib/minioTools.ts`: `uploadJsonToMinio` handles JSON uploads.
* `mini-app/src/services/sbtService.ts`: Lines 48-67 & 148-157 generate collection and item metadata URLs.
* `mini-app/src/lib/sbt.ts`: `deploySbtCollection` and `mintSBT` write metadata URLs into TON contract cells.

---

## 🛠️ Scope of Work & Detailed Implementation

### 1. Pluggable Storage Driver (`mini-app/src/lib/storage/`)
* Create a unified `StorageService` interface:
  ```ts
  interface StorageService {
    uploadJson(data: object, path: string): Promise<{ ipfsUri: string; httpGatewayUrl: string }>;
    uploadImage(buffer: Buffer, mimeType: string): Promise<{ ipfsUri: string; httpGatewayUrl: string }>;
  }
  ```
* Implement **Pinata / IPFS** driver with fallback to MinIO for local caching.
* Optional secondary pinning to **Arweave** (via Irys / Bundlr) for long-term immutability.

### 2. Update `SbtService` Minting Pipeline
* Modify `getOrCreateEventSbtCollection` and `mintSbtBadge` to use the decentralized storage driver.
* Store `ipfs://<CID>` or gateway URLs in `sbt_collections.metadata_url` and `sbt_items.metadata_url`.
* Ensure TEP-64 compliant snake-cell serialization.

### 3. Gateway Failover & Resilience
* Configure resilient public IPFS gateway fallbacks: `dweb.link`, `cloudflare-ipfs.com`, and `w3s.link`.

---

## ✅ Acceptance Criteria
* [ ] Minted SBT collections and badges use verified `ipfs://` or resilient gateway URLs.
* [ ] Shutting down local MinIO does not cause external indexers or Tonviewer to lose access to token metadata.
* [ ] Unit test confirms JSON metadata upload and retrieval from IPFS gateway.

