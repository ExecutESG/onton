# Ticketing & Payment Workflow

## 1. Order Creation
1. **User** selects a ticket in TMA.
2. **Frontend** calls `orders.create` (Mini-App).
3. **Backend**:
    - Checks availability.
    - Creates `orders` record with status `CREATED`.
    - Returns a `payment_link` or specific transfer instructions (Destination Wallet + Memo/Comment).

## 2. Payment Processing
1. **User** sends TON to the platform wallet with the required **Comment** (Order UUID).
2. **NFT Manager Worker**:
    - Detects the new transaction on the blockchain.
    - Matches the Comment to a known Order or Mint Request.
    - Records the transaction in `Transactions` table.
3. **Mini-App Worker**:
    - Polls/Listens for confirmed payment transactions.
    - Updates `orders.status` to `PAID`.
    - Triggers Ticket issuance.

## 3. Ticket Issuance
1. **System** generates a `tickets` record.
2. **Telegram Bot** sends a "Ticket Purchased" notification with a QR code.
3. If the ticket is an NFT, an async request is sent to the **NFT Manager** to mint the asset.
