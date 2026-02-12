# Database Schema & Information Architecture

The **ONTON** platform uses a **Split-Database Pattern** hosted on a single PostgreSQL instance. This separates the high-frequency application data (User/Events) from the mission-critical, state-heavy blockchain data (NFTs/Transactions).

## 1. Core Database (`mini-app`)
**ORM**: Drizzle Object Relational Mapper
**Role**: Handles all application logic, user data, event management, and ticketing.

### Key Entities

#### Users & Identity
- **`users`**: The central identity table.
    - `user_id` (BigInt): Telegram User ID (Primary Key).
    - `wallet_address`: Linked TON wallet.
    - `role`: Role enum (user, admin, etc.).
    - `is_premium`: Telegram Premium status.
- **`user_flags`**: Feature flags and granular permissions per user.
- **`userWalletBalances`**: Tracks internal balances if applicable.

#### Events & Ticketing
- **`events`**: The core resource.
    - `event_id` (Serial) / `event_uuid` (UUID).
    - `title`, `start_date`, `end_date`.
    - `participation_type`: Defines if it involves tickets, open entry, etc.
- **`tickets`**: Individual entry passes.
    - `status`: Active, Used, Cancelled.
    - `check_in_status`: For tracking attendance.
- **`orders`**: Purchase records.
    - `uuid`: Public identifier.
    - `state`: Created -> Paid -> Failed.
    - `type`: `event_creation`, `nft_mint`, etc.

#### Engagement & Gamification
- **`rewards`**: Definitions of rewards (SBTs, Tokens) for attending events.
- **`tournaments` / `games`**: Structures for competitive features.
- **`tasks`**: User tasks (social following, etc.) for earning points.

### Data Flow Relations
- **One User** can own **Many Events**.
- **One Order** generates **Many Tickets**.
- **One Event** can have **Many Registrants**.

---

## 2. NFT Database (`nft-manager`)
**ORM**: Prisma
**Role**: Manages the state of TON blockchain assets. It acts as a ledger for "On-Chain" truth before it is finalized on the blockchain.

### Key Models

#### `NFTCollection`
Represents an on-chain NFT collection deployed by the platform.
- `address`: The TON address of the collection contract.
- `metadata_url`: Pointer to the off-chain JSON metadata.
- `last_registered_item_index`: Tracks minting progress.

#### `NFTItem`
Represents a single NFT (ticket or collectible).
- `owner_address`: Who owns this item.
- `state`: The lifecycle state (`created` -> `mint_request` -> `minted` -> `failed`).
- `transaction_id`: Links to the payment/minting transaction.

#### `Transactions`
Tracks value transfers on the blockchain.
- `hash`: The transaction hash on TON.
- `value`: Amount (in TON).
- `type`: `paid`, `pending`, `failed`.
- `error_type`: Granular error tracking (e.g., `not_enough_ton`).

#### `WatchWallet`
Infrastructure table for the **Wallet Watcher** worker.
- `address`: The platform wallet being watched.
- `last_checked_lt`: The "Logical Time" of the last processed transaction. This ensures no double-processing of payments.

---

## 3. Schema Synchronization
There is no direct foreign key relationship between the TWO databases. Use UUIDs or Wallet Addresses to correlate data across boundaries.

**Example Correlation**:
1. User creates an order in `mini-app` (Order UUID `123-abc`).
2. Payment is detected in `nft-manager` via a Transaction.
3. The Worker sees the memo `123-abc` in the transaction.
4. Worker updates `mini-app.orders` to `PAID`.
