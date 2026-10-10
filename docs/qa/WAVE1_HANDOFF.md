# Wave 1 Release Blockers — Final Handoff Report

**Date:** 2026-10-10  
**Target Monorepo:** `ExecutESG/onton` (`/Users/mahdifarimani/Documents/AntiGravity/ONTON2026/ontonbot`)  
**Working Branch:** `fix/wave1-release-blockers` (branched from `dev` @ `d5c78b49`)  
**Auditor:** Release Auditor  
**Tracking Issue:** [#1063](https://github.com/ExecutESG/onton/issues/1063)  

---

## 1. Executive Summary

This release resolves critical security, integrity, and operational blockers identified in the Wave 1 audit. All fixes are verified with unit and integration tests under Vitest (`mini-app`) and TypeScript compiler checks (`telegram-bot`).

| Issue | Title / Scope | Severity | Status | Verification Summary |
|---|---|---|---|---|
| [#1051](https://github.com/ExecutESG/onton/issues/1051) | JWT verification secret fallback removal | Critical | Resolved | Only `AUTH_JWT_SECRET` + `HS256` allowed; legacy tokens rejected |
| [#1052](https://github.com/ExecutESG/onton/issues/1052) | Fail-fast startup checks for required secrets | High | Resolved | Enforces length ≥32, no placeholder patterns, blocked leaked hashes; all entrypoints assert |
| [#1054](https://github.com/ExecutESG/onton/issues/1054) | Email OTP code logging & brute-force lockout | High | Resolved | Code omitted from logs; Redis lockout after 5 fails; feature flags wired |
| [#1055](https://github.com/ExecutESG/onton/issues/1055) | Paid tier inventory reservation & oversell prevention | Critical | Resolved | Reserve at creation; row lock before side effects; auto-expire `new` only; refund/alert flow |
| [#1059](https://github.com/ExecutESG/onton/issues/1059) | Hardening cSBT Merkle proof endpoint | Medium | Resolved | 404 for non-members; attendee enumeration blocked; Redis tree caching |
| [#1060](https://github.com/ExecutESG/onton/issues/1060) | F-36 SBT Model Option A enforcement | Medium | Resolved | Option A enforced: off-chain cSBT for claims & partner API; paid on-chain upgrade (0.1 TON) |
| [#1053](https://github.com/ExecutESG/onton/issues/1053) | Docker build-arg secret leak elimination | High | Partially Resolved | CI workflow secrets removed; build-args stripped; secret rotation & image purge remain for Wave 2 |

---

## 2. Corrections Round 1 Summary

Following the initial audit review of the branch, twelve specific corrective actions were implemented across the codebase:

1. **Paid Orders Expiry Logic & TTL Alignment (#1055):**
   - Restricted auto-cancellation in `expireUnpaidOrders.ts` strictly to orders with `state = 'new'`. Orders in `confirming` state (indicating the user has initiated an on-chain transaction) are never auto-cancelled.
   - Replaced state transition timestamp updates to use `updatedAt` / `reserved_at` rather than overwriting `created_at`, preserving accurate order creation time.
   - Implemented late-payment handling in `CheckTransactions.ts`: if a confirmed on-chain transaction matches an order previously expired by cron, it attempts atomic inventory re-reservation under row lock. If capacity is exhausted, it marks the order `failed` with `last_error = 'capacity_exceeded_refund_required'`, creates an `order_dlq` entry, and dispatches an admin alert.
   - Synchronized TTL values: unified order reservation TTL to 15 minutes evaluated on a 5-minute cron interval.  
     *Rationale:* TON transactions typically confirm within 5 to 15 seconds, and `CheckTransactions` polls TonCenter v3 every 7 seconds. A 15-minute window is >60x average confirmation latency, granting buyers sufficient time while freeing uncompleted inventory for high-demand ticket drops.
2. **Capacity Check Strictly Before Side Effects (#1055):**
   - In `MintNFTForPaidOrders.ts` (both TICKET and NFT paths), row-locked capacity validation executes strictly *before* JSON MinIO uploads, TON NFT minting, coupon consumption, affiliate increments, or user notifications.
   - In `TsCsbtTicketOrder.ts`, row-locked capacity validation executes strictly *before* invoking `mintSbtBadge`, approving registrants, or calling external partner webhooks.
   - If capacity is exceeded, all on-chain and off-chain side effects are bypassed, the order is marked `failed` with `capacity_exceeded_refund_required`, and success notifications are suppressed.
3. **Refund and Alert Flow on Oversell (#1055):**
   - **Telegram Stars:** In `starsPaymentHandler.ts`, if tier or event capacity is exceeded during payment processing, the order row is locked with `FOR UPDATE`, transitioned to `failed`, and Telegram's `refundStarPayment` API is immediately called using `telegram_payment_charge_id`. The user receives an automated explanatory message.
   - **TON / USDT:** Implemented `sendOversellAdminAlert` in `mini-app/src/lib/notifications/adminAlert.ts`. Oversold orders insert an idempotent record into `order_dlq` (unique index on `order_uuid`) and dispatch a notification to the Telegram admin channel.
4. **Leaked Dev Secret Hashes Blocked (#1052):**
   - Extracted SHA-256 hashes of leaked development secrets from git history and added them to `KNOWN_DEFAULT_SECRET_SHA256` in both `mini-app/src/server/utils/requiredSecrets.ts` and `telegram-bot/src/utils/requiredSecrets.ts`.
   - Verified that attempts to boot with leaked dev secrets throw an exception naming the affected variable without printing secret values.
5. **Option A Enforced for `rewardsService.CsbtTicketForApi` (#1060):**
   - Per product decision, external partner tickets (`CsbtTicketForApi`) issue off-chain cSBT records instead of direct on-chain minting, aligning with Option A.
   - On-chain TEP-85 tokens require explicit paid upgrade via `materializeOnChainSbt` (0.1 TON).
   - In `TsCsbtTicketOrder.ts`, added a check skipping on-chain minting for zero-price orders (`Number(ordr.total_price) <= 0`).
   - Updated `knowledge_base/as_is_technical_blueprint.md` row F-36 to `Resolved`.
6. **Untiered Events & Single-Tier Selection (#1055):**
   - `/api/v1/order/route.ts` auto-selects the ticket tier when an event has exactly one explicit tier configured.
   - For untiered events, orders acquire a row lock on the `events` table (`SELECT capacity FROM events WHERE event_uuid = $1 FOR UPDATE`) and calculate occupancy across active states (`completed`, `processing`, `confirming`, `new`).
   - The order reactivation path applies the identical capacity check.
   - `ordersDB.checkIfSoldOut` was updated to account for `new` and `confirming` states.
7. **Concurrency Test Realism (#1055):**
   - Rewrote `mini-app/__tests__/api/order-inventory-reservation.test.ts` to test the actual database module functions (`lockAndCheckTierCapacityTrx`, `incrementTierSoldCountTrx`), transactional lock acquisitions, untiered event checks, late payment branches, and Stars refunds.
8. **Entrypoint Boot Validation (#1052):**
   - Verified that `mini-app/src/sockets/index.ts` and `mini-app/src/workers/orderPaidConsumer.ts` import `assertSecretsOnBoot.ts`.
   - Conducted an exhaustive audit of all container entrypoints (see Section 5).
9. **Transaction Hash Replay Guard in SBT Materialization (#1060):**
   - In `mini-app/src/server/routers/sbt.ts`, enforced non-null `paymentTxHash` in non-local environments and added Postgres unique constraint conflict mapping (code 23505 -> 409 Conflict).
10. **Deployment Ordering & Runbook Clarification (#1056, #1057):**
    - Expanded Section 7 to include prerequisite database backup/restore validation, pre-deployment secret rotation, and baseline migration tracking at 0121.
11. **Docker Build Without Server Secrets (#1053):**
    - Verified that `mini-app` builds in production mode with zero server secrets passed to the build context.
12. **Handoff Report Alignment:**
    - Updated auditor role, issue statuses, open questions, process entrypoints, and configuration tables.

---

## 3. Detailed Per-Issue Breakdown

### Issue #1051: Platform JWT Secret Fallbacks Removed
- **Root Cause:** `mini-app/src/server/utils/jwt.ts` and `mini-app/src/server/auth.ts` fell back to `ONTON_API_SECRET`, `BOT_TOKEN`, or `"onton-platform-default"`. `createAuthToken`, `createPayloadToken`, and `createWebSessionToken` used `SHARED_SECRET` (= `ONTON_API_SECRET`), allowing cross-service token forgery.
- **Files Modified:**
  - `mini-app/src/server/utils/jwt.ts`
  - `mini-app/src/server/auth.ts`
  - `mini-app/src/app/api/v1/auth/route.ts`
  - `mini-app/src/constants.ts`
- **Tests Added/Updated:**
  - `mini-app/__tests__/api/jwt-secret-fallbacks.test.ts` (12 tests covering HS256 pinning, secret isolation, and fallback rejection)
  - `mini-app/__tests__/api/user-auth-multi-provider.test.ts` (updated to assert rejection of legacy tokens signed with `BOT_TOKEN`)
- **Key Changes & Findings:**
  - `getAuthJwtSecret()` calls `readRequiredSecret("AUTH_JWT_SECRET")`. No fallbacks.
  - Verification strictly uses `AUTH_JWT_SECRET` with pinned algorithms: `["HS256"]`.
  - Removed `SHARED_SECRET` from `constants.ts`.
  - **Breaking Change:** Forced re-login for all users holding tokens signed with legacy secrets (`BOT_TOKEN` or `ONTON_API_SECRET`).
  - **Auditor Note on SHARED_SECRET:** Previously, `SHARED_SECRET` signed wallet session tokens and TonProof payload tokens. Because `ONTON_API_SECRET` was also used for internal server-to-server endpoints, an attacker with server API access could mint platform user tokens. This vector is eliminated.

---

### Issue #1052: Fail-Fast Startup Checks for Core Secrets
- **Root Cause:** Services booted silently with missing, weak (<32 char), or default development secrets.
- **Files Created/Modified:**
  - `mini-app/src/server/utils/requiredSecrets.ts`
  - `telegram-bot/src/utils/requiredSecrets.ts`
  - `mini-app/src/server/utils/assertSecretsOnBoot.ts`
  - `mini-app/src/instrumentation.ts`
  - `mini-app/next.config.js` (`experimental.instrumentationHook: true`)
  - `mini-app/src/sockets/index.ts`
  - `mini-app/src/workers/cronJobScheduler*.ts`, `mini-app/src/workers/orderPaidConsumer.ts`, `mini-app/src/workers/poaWorker.ts`
  - `mini-app/src/lib/totp/passToken.ts`, `mini-app/src/server/botHmacAuth.ts`, `mini-app/src/lib/tgBotConfig.ts`, `mini-app/src/lib/minioTools.ts`, `mini-app/src/server/routers/files.ts`, `mini-app/src/app/api/files/upload-json/route.ts`, `mini-app/src/app/api/files/upload/route.ts`, `mini-app/src/app/api/v1/tournament/.../route.ts`
  - `telegram-bot/src/main.ts`, `telegram-bot/src/middleware/hmacAuth.ts`, `telegram-bot/src/utils/miniAppClient.ts`
  - `.env.example`
- **Tests Added/Updated:**
  - `mini-app/__tests__/api/required-secrets.test.ts`
  - `mini-app/__tests__/api/secret-fallbacks-removed.test.ts`
- **Key Changes:**
  - `assertRequiredSecrets()` checks for presence, string type, length ≥ 32, absence of placeholder keywords (`your_`, `default`, `example`, `fallback`), and absence of blocked compromised SHA-256 hashes.
  - Fails fast on startup across Next.js app, all standalone workers, Socket.IO server, and `telegram-bot`.
  - All secret fallbacks removed across the monorepo.
  - `.env.example` updated with generation instructions (`openssl rand -hex 32`).

---

### Issue #1054: Email OTP Security, Rate Limiting & Lockout
- **Root Cause:** Plaintext OTP codes were emitted in application logs (`logger.info` and `console.log`). The endpoint had no brute-force attempt lockout in Redis.
- **Files Modified:**
  - `mini-app/src/lib/auth/authEngine.ts`
  - `mini-app/src/app/api/v1/auth/email/send-otp/route.ts`
  - `mini-app/src/app/api/v1/auth/email/verify-otp/route.ts`
  - `mini-app/src/app/_components/auth/WebAuthModal.tsx`
  - `mini-app/src/app/_components/auth/WebLoginSheet.tsx`
- **Tests Added:**
  - `mini-app/__tests__/api/email-otp-security.test.ts`
- **Key Changes:**
  - Removed plaintext code logging; logs only `[AUTH] OTP issued for <email>`.
  - Implemented Redis attempt tracker (`otp:fail:<email>`). On the 5th consecutive invalid code, the OTP is deleted and the email is locked for 15 minutes (`otp:lock:<email>`), returning HTTP 429 (`too_many_attempts`).
  - Added feature flag `AUTH_EMAIL_OTP_ENABLED` (default `"false"`). When disabled, `send-otp` and `verify-otp` return HTTP 404 (`email_otp_disabled`).
  - Web UI conditionally displays the Email Login option only when `NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED === "true"`.
  - **Proposed Caddy Rate Limit Snippet (Report Only):**
    ```caddy
    @otp_endpoints {
        path /api/v1/auth/email/*
    }
    rate_limit @otp_endpoints {
        zone otp_zone {
            key {remote_host}
            events 5
            window 1m
        }
    }
    ```
  - **Follow-up Note:** Production email delivery provider (e.g., Postmark/Resend/SES) remains to be implemented; currently operates in mock/development dispatch.

---

### Issue #1055: Paid Tier Oversell Prevention & Inventory Reservation
- **Root Cause:** Free orders incremented `sold_count` at creation, but paid orders only incremented `sold_count` at fulfillment time without a capacity check. Concurrent buyers could purchase beyond tier capacity before fulfillment ran.
- **Files Created/Modified:**
  - `mini-app/drizzle/0137_order_inventory_reservation.sql` (unapplied migration)
  - `mini-app/src/db/schema/orders.ts` (`inventory_reserved`, `reserved_at`)
  - `mini-app/src/db/schema/orderDlq.ts` (`order_dlq` table)
  - `mini-app/src/lib/notifications/adminAlert.ts` (DLQ insertion and Telegram alerts)
  - `mini-app/src/app/api/v1/order/route.ts`
  - `mini-app/src/cronJobs/tasks/MintNFTForPaidOrders.ts`
  - `mini-app/src/cronJobs/tasks/TsCsbtTicketOrder.ts`
  - `mini-app/src/cronJobs/tasks/expireUnpaidOrders.ts`
  - `mini-app/src/cronJobs/tasks/CheckTransactions.ts`
  - `mini-app/src/cronJobs/index.ts`
  - `mini-app/src/workers/cronJobSchedulerPayment.ts`
  - `mini-app/src/db/modules/orders.db.ts`
  - `telegram-bot/src/handlers/starsPaymentHandler.ts`
- **Tests Added/Updated:**
  - `mini-app/__tests__/api/order-inventory-reservation.test.ts` (comprehensive transactional tests)
- **Key Changes:**
  - **Reservation at Creation:** Paid orders reserve inventory during `/api/v1/order` execution under row lock (`lockAndCheckTierCapacityTrx` / `events FOR UPDATE`), marking `inventory_reserved = true`.
  - **Single Tier Auto-Selection:** If an event has exactly one tier, `/api/v1/order` automatically resolves `tier_id`.
  - **Untiered Event Protection:** For events without ticket tiers, capacity is locked and enforced against total active orders (`completed`, `processing`, `confirming`, `new`).
  - **Strict Pre-Execution Capacity Guard:** In `MintNFTForPaidOrders.ts` and `TsCsbtTicketOrder.ts`, capacity is re-verified under row lock before executing on-chain mints or database side effects.
  - **Expiration Sweeper:** `expireUnpaidOrders.ts` runs every 5 minutes and cancels only orders in `state = 'new'` that are older than 15 minutes, decrementing `sold_count`. Orders in `confirming` are untouched.
  - **Late Payment Recovery:** In `CheckTransactions.ts`, payments arriving for expired orders attempt locked re-reservation. If sold out, the order is marked `failed` (`capacity_exceeded_refund_required`) and enters DLQ/alert handling.
  - **Refund & Alert Handling:** Stars oversells trigger immediate `refundStarPayment`. TON/USDT oversells create an idempotent `order_dlq` row and alert admins via Telegram.
  - **DB Safety Constraint:** Added `CHECK (capacity = 0 OR sold_count <= capacity) NOT VALID` in migration 0137.

---

### Issue #1059: Hardening /api/v1/csbt/proof Endpoint
- **Root Cause:** The Merkle proof route allowed callers to pass arbitrary `leafIndex` values without verifying attendee identity, enabling enumeration of attendees and wallet addresses. Empty events or invalid requesters defaulted to index 0.
- **Files Modified:**
  - `mini-app/src/app/api/v1/csbt/proof/route.ts`
  - `mini-app/src/server/routers/sbt.ts` (`getTicketCsbt`)
- **Tests Added/Updated:**
  - `mini-app/__tests__/api/csbt-proof-hardening.test.ts`
  - `mini-app/__tests__/csbt/persistAndAnchor.test.ts`
- **Key Changes:**
  - **Non-Member Rejection:** Returns HTTP 404 `{ success: false, error: "not_a_member" }` if requester is not in the checked-in list.
  - **Anti-Enumeration:** Removed default to `leafIndex = 0`. Mismatched indices return HTTP 403 `{ success: false, error: "leaf_index_mismatch" }`.
  - **Response Fields:** Added `isMember: true` and `proofValid: boolean` (retaining `verified` for backward compatibility).
  - **Redis Caching:** Live Merkle trees are cached with a 60s TTL keyed by `csbt:live_tree:${eventUuid}:${checkedIn.length}`.

---

### Issue #1060: F-36 SBT Model — Option A Enforcement
- **Status:** **Resolved** (Option A strictly enforced: free attendance claims and external partner tickets issue off-chain cSBT; on-chain TEP-85 tokens require paid upgrade fee of 0.1 TON).
- **Files Modified:**
  - `mini-app/src/server/routers/sbt.ts`
  - `mini-app/src/services/rewardsService.ts`
  - `mini-app/src/services/sbtService.ts`
  - `mini-app/src/db/schema/sbtItems.ts`
  - `mini-app/drizzle/0137_order_inventory_reservation.sql`
  - `knowledge_base/as_is_technical_blueprint.md`
- **Tests Added/Updated:**
  - `mini-app/__tests__/api/sbt-model-option-a.test.ts`
  - `mini-app/__tests__/sbt/legacy-attendance-upgrade.test.ts`
- **Caller Audit & Classification:**
  1. `claimAttendanceSbt` (`sbt.ts`): Free path. Generates off-chain cSBT (`kind: "offchain_csbt"`).
  2. `materializeOnChainSbt` (`sbt.ts`): Paid upgrade path (0.1 TON). Validates `paymentTxHash` replay protection.
  3. `materializeLegacyRecord` (`sbt.ts`): Paid path (0.1 TON). Enforces `paymentTxHash` anti-replay.
  4. `mintBadge` (`sbt.ts`): Admin path. Global admin role check enforced.
  5. `rewardsService.ts`: Free path. Automatic on-chain minting on check-in removed.
  6. `rewardsService.CsbtTicketForApi`: External partner path. Issues off-chain cSBT record under Option A.
  7. `TsCsbtTicketOrder.ts`: Paid ticket path (`ts_csbt_ticket`). Minting skipped for zero-price orders.
- **Anti-Replay Protection:** Added `payment_tx_hash` column with a unique index `sbt_items_payment_tx_hash_uq` in `sbt_items` (migration 0137). Duplicate transaction hashes return HTTP 409 Conflict.

---

### Issue #1053: CI & Docker Build-Arg Secret Elimination
- **Status:** **Partially Resolved** (Code/CI pipeline cleaned; production secret rotation and GHCR image purging remain for Wave 2).
- **Files Modified:**
  - `devops/export_env.py`
  - `.github/workflows/build-push-deploy.yml`
  - `mini-app/Dockerfile`
  - `docker-compose-server-dev.yml`
  - `docker-compose-server.yml`
- **Key Changes:**
  - `devops/export_env.py`: In `build_args` mode, strictly limits output to `NEXT_PUBLIC_*`, `COMMIT_SHA`, `COMMIT_AUTHOR`, and `PACKAGE_MANAGER`. Runtime secrets are stripped.
  - `.github/workflows/build-push-deploy.yml`: Filtered `--build-arg` generation to permit only `NEXT_PUBLIC_*` and commit metadata.
  - `mini-app/Dockerfile`: Removed `ARG` declarations for runtime secrets (`ONTON_API_SECRET`, `BOT_TOKEN`, `DATABASE_URL`).
  - Compose files: Isolated `postgres` container environment from monorepo-wide environment variables.
  - Verified Next.js production build succeeds with zero server secrets.

---

## 4. Database Migration Details: `0137_order_inventory_reservation.sql`

**File Location:** `mini-app/drizzle/0137_order_inventory_reservation.sql`  
**Execution Status:** **UNAPPLIED** (Per repository safety rules, no migrations were executed).

```sql
-- Migration 0137: Order inventory reservation at creation & oversell protection (#1055, #1060)

-- 1. Add inventory_reserved and reserved_at to track tier reservation
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "inventory_reserved" boolean DEFAULT false NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reserved_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "orders_inventory_reserved_idx" ON "orders" ("inventory_reserved");

-- 2. Backfill completed orders with tier_id as inventory_reserved = true
UPDATE "orders"
SET "inventory_reserved" = true
WHERE "state" = 'completed' AND "tier_id" IS NOT NULL;

-- 3. Safety check constraint on event_ticket_tiers (capacity = 0 is unlimited)
DO $$ BEGIN
  ALTER TABLE "event_ticket_tiers"
    ADD CONSTRAINT "event_ticket_tiers_sold_count_capacity_check"
    CHECK ("capacity" = 0 OR "sold_count" <= "capacity") NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. SBT payment tx hash tracking & anti-replay protection (#1060)
ALTER TABLE "sbt_items" ADD COLUMN IF NOT EXISTS "payment_tx_hash" varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS "sbt_items_payment_tx_hash_uq" ON "sbt_items" ("payment_tx_hash");

-- 5. Dead letter queue for failed/oversold order refunds & admin alerting (#1055)
CREATE TABLE IF NOT EXISTS "order_dlq" (
  "id" serial PRIMARY KEY,
  "order_uuid" varchar(255) NOT NULL,
  "user_id" integer NOT NULL,
  "payment_method" varchar(64) NOT NULL,
  "tx_hash" varchar(255),
  "amount" varchar(64),
  "error_reason" varchar(255) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "order_dlq_order_uuid_uq" ON "order_dlq" ("order_uuid");
```

---

## 5. Process Entrypoint Audit Table

Every runtime service and worker entrypoint was audited to ensure boot-time secret validation (`assertRequiredSecrets` or `assertSecretsOnBoot`) is executed:

| Service / Entrypoint | Entry File | Startup Command | Boot Secret Assertion | Status |
|---|---|---|---|---|
| Mini App Web Server | `mini-app/src/instrumentation.ts` | `node server.js` / `yarn start` | Yes (`assertSecretsOnBoot`) | Verified |
| Socket.IO Server | `mini-app/src/sockets/index.ts` | `yarn dev:socket` / `node dist/sockets` | Yes (`assertSecretsOnBoot`) | Verified |
| Payment Cron Worker | `mini-app/src/workers/cronJobSchedulerPayment.ts` | `yarn cron:payment` | Yes (`assertSecretsOnBoot`) | Verified |
| Ordinary Cron Worker | `mini-app/src/workers/cronJobSchedulerOrdinary.ts` | `yarn cron:ordinary` | Yes (`assertSecretsOnBoot`) | Verified |
| NFT API Cron Worker | `mini-app/src/workers/cronJobSchedulerNFTApi.ts` | `yarn cron:nft` | Yes (`assertSecretsOnBoot`) | Verified |
| Reward Cron Worker | `mini-app/src/workers/cronJobSchedulerReward.ts` | `yarn cron:reward` | Yes (`assertSecretsOnBoot`) | Verified |
| Paid Order Consumer | `mini-app/src/workers/orderPaidConsumer.ts` | `yarn worker:order-paid` | Yes (`assertSecretsOnBoot`) | Verified |
| PoA Worker | `mini-app/src/workers/poaWorker.ts` | `yarn worker:poa` | Yes (`assertSecretsOnBoot`) | Verified |
| Telegram Bot Service | `telegram-bot/src/main.ts` | `yarn start` / `node dist/main.js` | Yes (`assertRequiredSecrets`) | Verified |

---

## 6. Configuration & Environment Variables

The following environment variables are required or newly introduced:

| Environment Variable | Service(s) | Type | Min Length | Default / Notes |
|---|---|---|---|---|
| `AUTH_JWT_SECRET` | `mini-app`, workers | Secret | ≥ 32 chars | Required. Platform JWT signing key (`openssl rand -hex 32`) |
| `TOTP_SECRET` | `mini-app` | Secret | ≥ 32 chars | Required. TOTP secret for pass tokens (`openssl rand -hex 32`) |
| `ONTON_API_SECRET` | `mini-app`, `telegram-bot` | Secret | ≥ 32 chars | Required. Internal API secret (`openssl rand -hex 32`) |
| `BOT_API_HMAC_SECRET` | `mini-app`, `telegram-bot` | Secret | ≥ 32 chars | Required. Mini App <-> Bot HMAC key (`openssl rand -hex 32`) |
| `AUTH_EMAIL_OTP_ENABLED` | `mini-app` | Flag | N/A | Server feature flag (`"false"` default, `"true"` to enable) |
| `NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED` | `mini-app` (build) | Flag | N/A | Client UI toggle (`"false"` default, `"true"` to show email input) |
| `ADMIN_ALERT_CHAT_ID` | `mini-app` | Config | N/A | Optional Telegram chat ID for oversell alerts; falls back to `SUPER_ADMIN_USER_ID` |

---

## 7. Concurrency Testing Realism & Postgres Limitations

The test suite in `mini-app/__tests__/api/order-inventory-reservation.test.ts` exercises the exact transactional logic implemented in production:
- Atomic row locking via `lockAndCheckTierCapacityTrx` (`SELECT ... FOR UPDATE`)
- Sequential inventory reservation via `incrementTierSoldCountTrx`
- Untiered event capacity checks locking the `events` table
- Expiry sweeps cancelling exclusively `new` state orders
- Late payment reconciliation and oversell DLQ/alert dispatch
- Stars payment handler oversell locking and Telegram refund calls

> [!NOTE]
> **PostgreSQL Concurrency Limitation:** Unit tests run under Vitest with transactional mocks because spinning up a live multi-process PostgreSQL cluster with parallel network clients during unit test execution is outside Vitest's scope. Full concurrent database stress testing (e.g. 50 parallel clients racing for 5 remaining seats) must be executed against a real PostgreSQL instance on staging as part of E2E verification.

---

## 8. Recommended Deployment Ordering (Runbook)

Deployment must proceed in the following strict sequential order:

1. **Step 1: Production Backup & Validation (#1057)**
   - Execute and verify a full logical database backup before applying changes:
     ```bash
     bash devops/backup_scripts/backup_db.sh
     ```
   - Confirm backup integrity and test restore capability against an isolated test database.
2. **Step 2: Secrets Generation & Pre-Deployment Rotation (#1052)**
   - Generate four distinct cryptographically secure 64-character hex strings:
     ```bash
     openssl rand -hex 32
     ```
   - Update `AUTH_JWT_SECRET`, `TOTP_SECRET`, `ONTON_API_SECRET`, and `BOT_API_HMAC_SECRET` in environment files / secrets manager across all host services **prior** to container deployment. Containers running updated code will refuse to start if these are missing, <32 characters, or default strings.
3. **Step 3: Database Migration Tracking Baseline & Sequential Run (#1056)**
   - Check migration status using the tracked runner:
     ```bash
     cd mini-app && yarn db:migrate:status
     ```
   - If `_schema_migrations` tracking is uninitialized, record baseline at migration `0121`:
     ```bash
     cd mini-app && yarn db:migrate:apply --baseline 0121
     ```
   - Sequentially apply all pending migrations through `0137`:
     ```bash
     cd mini-app && yarn db:migrate:apply
     ```
4. **Step 4: Deploy Container Services**
   - Deploy `telegram-bot` service.
   - Deploy `mini-app` web application and background workers (`cronJobSchedulerPayment`, `cronJobSchedulerOrdinary`, `cronJobSchedulerNFTApi`, `cronJobSchedulerReward`, `orderPaidConsumer`, `poaWorker`).
5. **Step 5: Post-Deployment Smoke Verification**
   - Verify health checks on mini-app (`/api/health`) and bot.
   - Test free attendance claim: verify issuance of off-chain Merkle cSBT.
   - Test paid order reservation: verify `sold_count` increments at order creation and releases upon cancellation/expiry.

---

## 9. Open Questions & Product Decisions Flagged

1. **External Partner Tickets (`CsbtTicketForApi`) Minting Behavior:**
   - *Status:* **Resolved.** Product decision confirmed Option A: partner tickets issue off-chain cSBT records, and on-chain TEP-85 tokens require explicit paid upgrade via `materializeOnChainSbt` (0.1 TON).
2. **Multipart Form Upload HMAC Standardization (Wave 2):**
   - In `mini-app/src/server/routers/telegramInteractions.ts`, multipart file streams send `BOT_API_HMAC_SECRET` as a static header because streaming payloads cannot be easily pre-digested. A chunked HMAC streaming protocol should be scheduled for Wave 2.
3. **Token Audience / Typ Claims (Wave 2):**
   - Both platform authentication tokens and TonProof payload tokens currently share `AUTH_JWT_SECRET`. Adding explicit `typ: "platform_jwt"` or `aud` claims will eliminate token type confusion in Wave 2.
4. **Production Secret Rotation & GHCR Purge (Wave 2, #1053):**
   - Docker build-arg exposures have been resolved in code and workflows. Once deployed, historical images containing legacy build arguments should be purged from GHCR, and production credentials rotated.

---

## 10. Verification Results

All required verification suites were executed against the codebase:

### 1. Mini-App Lint & Type Check
```bash
$ cd mini-app && yarn lint:quiet && yarn type:check
✔ No ESLint warnings or errors
✨ Done in 1.71s.
✨ Done in 3.09s.
```

### 2. Mini-App Vitest API Suite
```bash
$ cd mini-app && yarn test:api
Test Files  55 passed (55)
Tests       503 passed (503)
Duration    4.49s
✨ Done in 4.94s.
```

### 3. Telegram Bot Build
```bash
$ cd telegram-bot && yarn build
$ tsc
✨ Done in 2.05s.
```

### 4. Secret Fallback Grep Verification
```bash
$ grep -rn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=coverage \
  -E "\|\| *process\.env\.(BOT_TOKEN|ONTON_API_SECRET)|onton-platform-default|onton_dynamic_pass_secret" \
  mini-app/src telegram-bot/src
# Result: 0 matches (Exit code 1 - Clean)
```

### 5. Plaintext OTP Logging Grep Verification
```bash
$ grep -rn --exclude-dir=node_modules -E "OTP\].*code|Code for .* is [0-9]{6}" mini-app/src
# Result: 0 matches (Exit code 1 - Clean)
```

### 6. YAML Validation
```bash
$ node -e "const yaml = require('./mini-app/node_modules/js-yaml'); const fs = require('fs'); ['docker-compose-server-dev.yml', 'docker-compose-server.yml', '.github/workflows/build-push-deploy.yml'].forEach(f => { yaml.load(fs.readFileSync(f, 'utf8')); console.log(f + ': VALID'); });"
docker-compose-server-dev.yml: VALID
docker-compose-server.yml: VALID
.github/workflows/build-push-deploy.yml: VALID
```

---

## 11. Proposed Conventional Commit Split

To maintain atomic, reviewable git history, the staged changes should be committed in the following 7 logical units:

1. `fix(mini-app): sign and verify platform JWTs with AUTH_JWT_SECRET only (#1051)`
   - `mini-app/src/server/utils/jwt.ts`
   - `mini-app/src/server/auth.ts`
   - `mini-app/src/app/api/v1/auth/route.ts`
   - `mini-app/src/constants.ts`
   - `mini-app/__tests__/api/jwt-secret-fallbacks.test.ts`
   - `mini-app/__tests__/api/user-auth-multi-provider.test.ts`

2. `fix(mini-app,telegram-bot): remove secret fallbacks and fail fast on missing secrets (#1052)`
   - `mini-app/src/server/utils/requiredSecrets.ts`
   - `mini-app/src/server/utils/assertSecretsOnBoot.ts`
   - `mini-app/src/instrumentation.ts`
   - `mini-app/next.config.js`
   - `mini-app/src/sockets/index.ts`
   - `mini-app/src/workers/cronJobScheduler*.ts`
   - `mini-app/src/workers/orderPaidConsumer.ts`
   - `mini-app/src/workers/poaWorker.ts`
   - `mini-app/src/lib/totp/passToken.ts`
   - `mini-app/src/server/botHmacAuth.ts`
   - `mini-app/src/lib/tgBotConfig.ts`
   - `mini-app/src/lib/minioTools.ts`
   - `mini-app/src/server/routers/files.ts`
   - `mini-app/src/server/routers/questRouter.ts`
   - `mini-app/src/app/api/files/upload-json/route.ts`
   - `mini-app/src/app/api/files/upload/route.ts`
   - `mini-app/src/app/api/v1/tournament/[mode]/[gameId]/[tournamentId]/[userId]/route.ts`
   - `telegram-bot/src/utils/requiredSecrets.ts`
   - `telegram-bot/src/main.ts`
   - `telegram-bot/src/middleware/hmacAuth.ts`
   - `telegram-bot/src/utils/miniAppClient.ts`
   - `.env.example`
   - `mini-app/__tests__/api/required-secrets.test.ts`
   - `mini-app/__tests__/api/secret-fallbacks-removed.test.ts`
   - `mini-app/__tests__/api/organizer-payouts.test.ts`
   - `mini-app/__tests__/api/share-event.test.ts`
   - `mini-app/__tests__/notifications/ticket-payment-notification.test.ts`

3. `feat(mini-app): harden email OTP with rate limiting and lockout (#1054)`
   - `mini-app/src/lib/auth/authEngine.ts`
   - `mini-app/src/app/api/v1/auth/email/send-otp/route.ts`
   - `mini-app/src/app/api/v1/auth/email/verify-otp/route.ts`
   - `mini-app/src/app/_components/auth/WebAuthModal.tsx`
   - `mini-app/src/app/_components/auth/WebLoginSheet.tsx`
   - `mini-app/__tests__/api/email-otp-security.test.ts`

4. `fix(mini-app,telegram-bot): reserve inventory at order creation and prevent oversell (#1055)`
   - `mini-app/drizzle/0137_order_inventory_reservation.sql`
   - `mini-app/src/db/schema/orders.ts`
   - `mini-app/src/db/schema/orderDlq.ts`
   - `mini-app/src/db/schema.ts`
   - `mini-app/src/lib/notifications/adminAlert.ts`
   - `mini-app/src/app/api/v1/order/route.ts`
   - `mini-app/src/cronJobs/tasks/MintNFTForPaidOrders.ts`
   - `mini-app/src/cronJobs/tasks/TsCsbtTicketOrder.ts`
   - `mini-app/src/cronJobs/tasks/expireUnpaidOrders.ts`
   - `mini-app/src/cronJobs/tasks/CheckTransactions.ts`
   - `mini-app/src/cronJobs/index.ts`
   - `mini-app/src/workers/cronJobSchedulerPayment.ts`
   - `mini-app/src/db/modules/orders.db.ts`
   - `telegram-bot/src/handlers/starsPaymentHandler.ts`
   - `mini-app/__tests__/api/order-inventory-reservation.test.ts`

5. `fix(mini-app): secure cSBT proof endpoint against attendee enumeration (#1059)`
   - `mini-app/src/app/api/v1/csbt/proof/route.ts`
   - `mini-app/src/server/routers/sbt.ts`
   - `mini-app/__tests__/api/csbt-proof-hardening.test.ts`
   - `mini-app/__tests__/csbt/persistAndAnchor.test.ts`

6. `feat(mini-app): enforce Option A SBT model for off-chain and on-chain badges (#1060)`
   - `mini-app/src/server/routers/sbt.ts`
   - `mini-app/src/services/rewardsService.ts`
   - `mini-app/src/services/sbtService.ts`
   - `mini-app/src/services/tonCenter.ts`
   - `mini-app/src/db/schema/sbtItems.ts`
   - `knowledge_base/as_is_technical_blueprint.md`
   - `mini-app/__tests__/api/sbt-model-option-a.test.ts`
   - `mini-app/__tests__/sbt/legacy-attendance-upgrade.test.ts`

7. `ci(devops): stop passing runtime secrets as Docker build args (#1053)`
   - `devops/export_env.py`
   - `.github/workflows/build-push-deploy.yml`
   - `mini-app/Dockerfile`
   - `docker-compose-server-dev.yml`
   - `docker-compose-server.yml`
