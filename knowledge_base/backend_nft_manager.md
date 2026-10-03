# NFT Manager Service

> Last verified against dev: 2026-10-03

`newton/apps/nft-manager` is a NestJS + Prisma service. **It is not running in any environment.**

## Status

| Check | Result |
|---|---|
| In `docker-compose.yml` / server composes | No service. Only env names remain (`IP_NFT_MANAGER`, `NFT_MANAGER_PORT`, `POSTGRES_NFT_MANAGER_DB`, `DATABASE_URL_NFT_MANAGER`) |
| Wallet watcher (`@Interval`) | Commented out in `src/app.service.ts` |
| Minting loops | Commented out in `src/app.service.ts` |
| Callers from mini-app | None found |
| Recovery script | `src/fix-not-minted-items.ts` exists |

## Where the work happens instead

| Responsibility | Live implementation |
|---|---|
| Payment detection | `CheckTransactions` cron in mini-app (TonCenter v3, every 7s) |
| NFT collection deploy | `CreateEventOrders` → `handleTicketType.ts` → `mini-app/src/lib/nft.ts` |
| Ticket NFT mint | `MintNFTForPaidOrders` cron (every 9s) |
| SBT mint | `mini-app/src/services/sbtService.ts` |

See [workflow_nft_minting.md](workflow_nft_minting.md).

## Roadmap / not implemented
- No work on `dev` revives this service. Treat it as legacy code.
