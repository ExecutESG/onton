# NFT Minting Process

## 1. Collection Deployment
- **Trigger**: Organizer enables NFT Ticketing for an Event.
- **Process**:
    1. **Mini-App** requests a new Collection via **NFT Manager**.
    2. **NFT Manager** deploys a standard TON NFT Collection contract.
    3. Stores the `collection_address` in the database.

## 2. Item Minting (Async)
- **Trigger**: User purchases a ticket (Order Paid).
- **Process**:
    1. **Mini-App** queues a "Mint Item" job.
    2. **NFT Manager**:
        - Pick up the job.
        - Upload metadata (JSON) to IPFS/S3 (if needed).
        - Send a `Mint` transaction to the Collection Contract on-chain.
    3. **Status Tracking**:
        - State moves from `MINT_REQUEST` -> `MINTED`.
        - System retries if the transaction fails or times out.

## 3. Error Handling
- **Concurrency**: The system manages nonces/seqno to prevent transaction collisions from the Master Wallet.
- **Manual Fixes**: Scripts exist (`fix-not-minted-items.ts`) to re-process stuck items.
