# Mini-App Core Service (Backend)

> Last verified against dev: 2026-10-03

`mini-app/` is the main backend. It is a Next.js 14 App Router app that exposes tRPC (`mini-app/src/server/`) and REST route handlers (`mini-app/src/app/api/`). Overview of services and workers: [mini_app_overview.md](mini_app_overview.md).

## 1. Role

- API for the Mini App / web frontend (tRPC) and for REST clients (`/api/v1/*`).
- Business logic: events, registration, orders, tickets, check-in, SBTs, users and identities.
- Sends Telegram messages through the bot's HMAC-signed HTTP API (`mini-app/src/lib/tgBot.ts`).
- Publishes to RabbitMQ (`notifications`, `tg_messages`, `order_paid`). Background work runs in separate worker processes (`src/workers/`). There is no call to a separate NFT Manager service; minting runs in-process (`src/lib/nft.ts`, `src/lib/sbt.ts`).

## 2. tRPC routers

All routers are in `mini-app/src/server/routers/` and are combined into `appRouter` in `mini-app/src/server/index.ts`.

| Area | appRouter key → file |
|---|---|
| Events | `events` → `events.ts`, `eventTicket` → `eventTicket.ts`, `location`, `hubs`, `config` → `OntonSetting.ts` |
| Registration / check-in | `registrant` → `registrant.ts`, `visitors`, `ticket` → `tickets.ts`, `EventPOA` → `POA.ts`, `userEventFields`, `userRoles` |
| Orders / coupons | `orders` → `orders.ts` (order state, promote-to-organizer orders), `coupon` |
| Credentials | `sbt` → `sbt.ts`, `sbtRewardCollection` |
| Users / auth | `users`, `organizers`, `tonProof` → `tonProofRouter.ts`, `usersX`, `usersGithub`, `usersLinkedin`, `usersGoogle`, `usersOutlook` |
| Engagement | `campaign`, `task` → `tasksRouter.ts`, `quest`, `raffle`, `tournaments`, `usersScore`, `affiliate` |
| Misc | `files`, `telegramInteractions` |

Ticket order creation is **REST**, not tRPC: `POST /api/v1/order` (`mini-app/src/app/api/v1/order/route.ts`). Stars invoices: `POST /api/v1/order/stars-invoice`.

## 3. Procedure types (`mini-app/src/server/trpc.ts`)

| Procedure | Rule |
|---|---|
| `publicProcedure` | No auth |
| `initDataProtectedProcedure` | Any authenticated user (initData, Bearer platform JWT, cookie or API key). Role `ban` → FORBIDDEN. |
| `adminOrganizerProtectedProcedure` | Global role `admin` or `organizer` |
| `adminOrganizerCoOrganizerProtectedProcedure` | Admin/organizer, or an event-level `admin` on whitelisted paths |
| `eventManagementProtectedProcedure` | Global admin, owning organizer, event `admin`, or `checkin_officer` on whitelisted paths (`accessRolesPathConfig.ts`) |
| `walletJWTProtectedProcedure` | Authenticated + `x-session-jwt` from TonProof |

Auth context resolution is in `mini-app/src/server/context.ts` (header → cookie → API key). See [workflow_auth.md](workflow_auth.md).

### Access on sensitive procedures

| Procedure | Access |
|---|---|
| `ticket.getTicketByUuid`, `ticket.checkInTicket` | Event manager only. The scan step rejects static UUID passes. |
| `ticket.getTicketQrToken`, `registrant.getRegistrantQrToken` | Ticket / registration owner only |
| `registrant.checkinRegistrantRequest` | Event manager only; requires a live pass token |
| `sbt.mintBadge` | Global admin only |
| `sbt.claimAttendanceSbt`, `sbt.materializeOnChainSbt` | Ticket owner only |
| Other `sbt.*` reads (`getUserBadges`, `getTicketCsbt`, ...) | Public |
| `users.addWallet` | Authenticated; stores the wallet without TonProof |

## 4. Data access

- Drizzle ORM. Schema: `mini-app/src/db/schema.ts` and `mini-app/src/db/schema/`. Query modules: `mini-app/src/db/modules/`.
- Migrations: apply SQL files by hand with `psql -v ON_ERROR_STOP=1`. Never run `yarn db:migrate`.

## 5. Typical procedure flow

1. Input validation with Zod (`mini-app/src/zodSchema/` or inline).
2. Authorization via the procedure type (and extra checks in the handler, e.g. ticket owner).
3. Drizzle query/mutation.
4. Side effects where needed: bot HTTP API call, RabbitMQ publish, Redis lock or cache update.

## Known issues (tracked in QA)

- F-27: email OTP codes are logged, not emailed.
- F-36: free SBT at check-in/claim vs paid on-chain upgrade.
- Secret env vars have insecure fallbacks if unset; set them in every environment.
