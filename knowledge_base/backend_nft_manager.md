# NFT Manager Service

The **NFT Manager** (`ontonbot/newton/apps/nft-manager`) is a specialized microservice dedicated to blockchain interactions.

## 1. Role
- **Minting Orchestration**: Handles the complex sequence of deploying NFT collections and minting individual items.
- **Transaction Monitoring**: Watches the TON blockchain for incoming payments (Event creation fees, Ticket purchases).
- **State Management**: Maintains the `nft-manager` Prisma database as the source of truth for on-chain status.

## 2. Architecture
- **Framework**: **NestJS** (implied by `app.module.ts`, `main.ts` structure).
- **ORM**: **Prisma**.

## 3. Key Components
- **`Watcher` Service**: Uses `WatchWallet` logic to poll TON API/LiteClient for new transactions on the platform's Master Wallet.
- **Minting Queue**: Processes mint requests (from RabbitMQ or DB polling) to ensure sequential processing and manage TON concurrency limits.
- **Recovery**: Includes scripts/logic (`fix-not-minted-items.ts`) to retry stuck transactions.

## 4. Integration
- **Input**: Receives minting requests from `mini-app` (via database state or queue).
- **Output**: Updates `Transactions` and `NFTItem` tables; used by `mini-app` workers to confirm "Payment Received".
