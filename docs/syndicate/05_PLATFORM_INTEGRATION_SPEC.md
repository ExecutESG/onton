# 05. Platform Integration & Technical Architecture
*Connecting the Syndicate Marketplace to ONTON Mini App and Client Web Panel*

---

## 1. Architectural Strategy

To minimize development overhead and achieve immediate revenue, the technical integration is split into two phases:

- **Phase 1: Zero-Code / Concierge Integration (Immediate):**
  Uses ONTON's existing `events`, `tasks`, and `tickets` infrastructure directly. Every client campaign is simply an ONTON event with attached giveaway tasks and ticket badges.
- **Phase 2: Automated Marketplace Engine (Platform Upgrade):**
  Integrates a dedicated self-serve "Syndicate Boost" booking system into `client-web-panel` and Drizzle ORM schema.

---

## 2. Phase 1: Leveraging Existing ONTON Schema

ONTON's existing database architecture already supports everything needed to execute client campaigns:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│          events (Core)          │       │         tasks (Quests)          │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ • event_uuid: client-campaign   │◄─────┐│ • task_id                       │
│ • title: "Project X Global AMA" │      ││ • event_id                      │
│ • start_date / end_date         │      ││ • type: "telegram_join", "x_sub"│
│ • banner_image_url              │      ││ • reward_points: 100            │
└─────────────────────────────────┘      │└─────────────────────────────────┘
                 │                       │
                 ▼                       │
┌─────────────────────────────────┐      │┌─────────────────────────────────┐
│        tickets / orders         │      └┤         rewards (SBTs)          │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ • user_id                       │       │ • reward_id                     │
│ • check_in_status               │       │ • type: "sbt_badge"             │
│ • state: PAID / FREE_RSVP       │       │ • metadata: "AMA Attendee SBT"  │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

### Operational Steps in Existing App:
1. **Event Creation:** Create the client's event via `mini-app` or SQL seed with high-res banner and description.
2. **Social Tasks:** Insert rows into `tasks` table requiring attendees to join the client's Telegram group and follow on X.
3. **SBT Badge:** Deploy an SBT reward item in `nft-manager` to distribute to verified attendees.
4. **Group Gating:** Use `telegram-bot` to auto-DM ticket holders the single-use invite link to the live AMA channel.

---

## 3. Phase 2: Native Syndicate Schema Extension (Drizzle ORM)

When scaling to full self-serve automation, add the following tables to `mini-app/src/db/schema.ts`:

```typescript
import { pgTable, serial, text, integer, timestamp, uuid, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './schema';

export const packageTierEnum = pgEnum('package_tier', ['ignite', 'momentum', 'launchpad', 'custom']);
export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'pending_payment', 'in_progress', 'completed', 'cancelled']);
export const deliverableStatusEnum = pgEnum('deliverable_status', ['pending', 'scheduled', 'live', 'verified', 'disbursed']);

// 1. Syndicate Packages Catalog
export const syndicatePackages = pgTable('syndicate_packages', {
  id: serial('id').primaryKey(),
  tier: packageTierEnum('tier').notNull(),
  title: text('title').notNull(),
  priceUsdt: decimal('price_usdt', { precision: 10, scale: 2 }).notNull(),
  wholesaleCostUsdt: decimal('wholesale_cost_usdt', { precision: 10, scale: 2 }).notNull(),
  prizePoolUsdt: decimal('prize_pool_usdt', { precision: 10, scale: 2 }).default('0.00'),
  durationDays: integer('duration_days').notNull(),
  featuresJson: text('features_json').notNull(), // JSON array of bullet points
  isActive: integer('is_active').default(1)
});

// 2. Client Active Campaigns
export const syndicateCampaigns = pgTable('syndicate_campaigns', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().unique().notNull(),
  organizerUserId: text('organizer_user_id').notNull(), // Telegram User ID
  packageId: integer('package_id').references(() => syndicatePackages.id),
  projectName: text('project_name').notNull(),
  status: campaignStatusEnum('status').default('pending_payment').notNull(),
  targetStartDate: timestamp('target_start_date'),
  targetEndDate: timestamp('target_end_date'),
  briefingJson: text('briefing_json'), // intake answers, links, questions
  escrowTxHash: text('escrow_tx_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 3. Campaign Deliverables Matrix (SLA Tracking)
export const syndicateDeliverables = pgTable('syndicate_deliverables', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id').references(() => syndicateCampaigns.id).notNull(),
  partnerId: text('partner_id').notNull(), // Links to partner_network_directory
  channelName: text('channel_name').notNull(),
  deliverableType: text('deliverable_type').notNull(), // 'binance_live_ama', 'pinned_post', 'x_space'
  scheduledAt: timestamp('scheduled_at'),
  status: deliverableStatusEnum('status').default('pending').notNull(),
  recordingUrl: text('recording_url'),
  proofScreenshotUrl: text('proof_screenshot_url'),
  payoutTxHash: text('payout_tx_hash'),
  payoutAmountUsdt: decimal('payout_amount_usdt', { precision: 10, scale: 2 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
```

---

## 4. UI/UX Flow in `client-web-panel`

When an organizer creates an event in the web panel, an optional step is added:

```
[Step 1: Event Details] ──► [Step 2: Ticketing] ──► [Step 3: 🚀 Syndicate Boost (NEW)]
                                                                    │
                                    ┌───────────────────────────────┴───────────────────────────────┐
                                    ▼                                                               ▼
                          [Skip: Free Listing]                                     [Select Syndicate Package]
                                                                                   • Ignite Cohort ($990)
                                                                                   • Momentum Syndicate ($2,490)
                                                                                   • Ecosystem Launchpad ($5,900)
                                                                                                    │
                                                                                                    ▼
                                                                                   [Instant Checkout via TonConnect]
                                                                                   (USDT / TON / Stars)
```
