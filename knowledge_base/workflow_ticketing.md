# Ticketing & Payment Workflow

> Last verified against dev: 2026-10-03

Details: [payment_system_overview.md](./payment_system_overview.md).

## 1. Order creation
1. User opens checkout: `mini-app/src/app/events/[hash]/checkout/_components/CheckoutForm.tsx`. Tiers (from `event_ticket_tiers`) are shown if present.
2. Frontend calls REST `POST /api/v1/order` (`mini-app/src/app/api/v1/order/route.ts`).
3. Backend:
   - Checks tier capacity (paid tiers: see Known issues) and event sold-out (no lock).
   - Free order: state `completed`, ticket row inserted, group invite link sent.
   - Paid order: state `confirming`. Token comes from the event's `event_payment_info.token_id`.

## 2. Payment
| Rail | User action | Verification |
|---|---|---|
| TON | TonConnect transfer with comment `onton_order=<id>` | `CheckTransactions` cron (7 s, TonCenter v3) → state `processing` |
| USDT | Jetton transfer with forward payload `onton_order=<id>` | Same cron, jetton master must match the token |
| Stars | `openInvoice` on link from `POST /api/v1/order/stars-invoice` | telegram-bot `successful_payment` → state `completed` |

## 3. Ticket issuance
- **TON/USDT**: `MintNFTForPaidOrders` cron (9 s) mints the NFT in-process (`mini-app/src/lib/nft.ts`), then sets the order `completed`, inserts `nft_items`, approves the registrant, and increments the affiliate count. Only an admin log message is sent; no user DM.
- **Stars**: the bot approves the registrant, inserts a ticket row if missing, creates a 1-use group invite, and replies with a button to `/tickets/<event_uuid>`. No NFT mint.
- The ticket QR is a rotating pass token served by `ticket.getTicketQrToken` / `registrant.getRegistrantQrToken` (owner only), not generated at payment time.

## Known issues (tracked in QA)
- F-33: Stars pre-checkout approves without validating order, price, or capacity.
- F-34: Paid tier `sold_count` not incremented; no tier-creation API.
- F-35: `order_paid` consumer likely failing; the mint cron is the real fulfillment path.
