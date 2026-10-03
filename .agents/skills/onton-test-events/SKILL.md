---
name: onton-test-events
description: >
  Generate, seed, and verify clean ONTON test events with diverse archetypes
  (Free RSVP, Approval Gated, Paid Crypto/Stars, Online Livestream, SBT PoA, Contest)
  on Local or Staging in seconds. Prevents manual trial-and-error database loops.
metadata:
  version: 1.0.0
---

# ONTON Test Event Generator & Seeder Skill

Provides agents with pre-built, schema-validated event blueprints and automated CLI execution across Local and Staging environments.

---

## When to Use

Activate this skill whenever:
- The user requests a test event to verify end-to-end user flows (attendee RSVP, organizer dashboard, check-in).
- Testing multi-tier ticket checkout, payment fulfillment (TON, USDT, Telegram Stars).
- Testing approval-gated attendee workflows (`has_approval: true`).
- Testing online stream gated access (`participation_type: 'online'`, secret phrases).
- Testing Soulbound Token (SBT) Proof of Attendance (PoA) distribution.
- Testing contest/gaming tournament features.

> [!CAUTION]
> **Anti-Pattern Guardrail**: NEVER attempt to write ad-hoc SQL through interactive SSH or multiple GitHub Actions workflow dispatches in a loop. Always use the deterministic CLI runner below, which executes in a single shot via base64 transactions.

---

## Quick Start / CLI Runner

Run the runner directly from the repository root:

```bash
# 1. Free In-Person RSVP Event (Instant Ticket Issuance)
npx tsx scripts/seed-test-event.ts --preset free_rsvp --env staging

# 2. Approval-Gated VIP / Founders Dinner (Requires Organizer Review)
npx tsx scripts/seed-test-event.ts --preset approval_gated --env staging

# 3. Paid Crypto Ticket Event (5 TON General Admission)
npx tsx scripts/seed-test-event.ts --preset paid_crypto --price 5.0 --env staging

# 4. Telegram Stars Payment Event
npx tsx scripts/seed-test-event.ts --preset paid_stars --price 150 --env staging

# 5. Online Livestream Event with Secret Phrase Protection
npx tsx scripts/seed-test-event.ts --preset online_stream --env staging

# 6. SBT / Proof-of-Attendance (PoA) Event
npx tsx scripts/seed-test-event.ts --preset sbt_poa --env staging

# 7. Competitive Tournament / Hackathon Contest
npx tsx scripts/seed-test-event.ts --preset contest --env staging

# 8. Unlisted / Secret Private Event
npx tsx scripts/seed-test-event.ts --preset unlisted_private --env staging

# Output SQL only (no execution)
npx tsx scripts/seed-test-event.ts --preset paid_crypto --sql-only
```

---

## Supported Presets Reference

| Preset | Key Characteristics & Schema Flags | Default Category | Default Capacity |
| :--- | :--- | :--- | :--- |
| `free_rsvp` | `participation_type: 'in_person'`, `has_registration: true`, `has_approval: false`, `has_waiting_list: true` | `11` (Technology) | `100` |
| `approval_gated` | `participation_type: 'in_person'`, `has_registration: true`, `has_approval: true` (Organizer must approve) | `9` (Networking) | `30` |
| `paid_crypto` | `has_payment: true`, `"ticketToCheckIn": true`, price in TON, linked `event_payment` & `orders` | `4` (Educational) | `50` |
| `paid_stars` | `has_payment: true`, Telegram Stars price | `6` (Finance) | `75` |
| `online_stream` | `participation_type: 'online'`, `secret_phrase: 'TON2026'` | `11` (Technology) | `500` |
| `sbt_poa` | `sbt_collection_address` set, PoA badge criteria, dynamic QR check-in | `3` (Conference/Summit) | `150` |
| `contest` | Competition/hackathon format, prize pool metadata | `8` (Gaming) | `256` |
| `unlisted_private` | `hidden: true`, `enabled: true` (Only accessible via direct link) | `10` (Other) | `15` |

---

## CLI Flags Reference

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-p`, `--preset` | Preset archetype (`free_rsvp`, `approval_gated`, `paid_crypto`, `paid_stars`, `online_stream`, `sbt_poa`, `contest`, `unlisted_private`) | `free_rsvp` |
| `-e`, `--env` | Target environment (`staging`, `local`, `sql`) | `staging` |
| `-t`, `--title` | Override event title | Blueprint default |
| `-c`, `--capacity` | Override attendee capacity limit | Blueprint default |
| `--price` | Override ticket price (for paid presets) | Blueprint default |
| `-l`, `--location` | Override physical venue or stream label | Blueprint default |
| `-u`, `--uuid` | Explicit event UUID for reproducible tests | Generated UUIDv4 |
| `--sql-only` | Output the complete SQL transaction without executing | `false` |

---

## Staging Single-Shot Execution Protocol

When targeting `--env staging`, the script:
1. Generates a self-contained SQL transaction block with dynamic organizer fallback.
2. Encodes the SQL payload in Base64:
   ```bash
   b64=$(echo "$SQL" | base64)
   ```
3. Dispatches a single GitHub Actions workflow call via `inspect-server.yml`:
   ```bash
   gh workflow run inspect-server.yml \
     -f action=custom \
     -f target_server=dev \
     -f custom_command="echo '${b64}' | base64 -d | docker exec -i \$(docker ps -q -f name=postgres | head -n 1) psql -U onton -d mini-app"
   ```
4. Verifies the event immediately via public tRPC ping:
   ```bash
   curl -s "https://app.dev.onton.live/api/trpc/events.getEvent?input=%7B%22event_uuid%22%3A%22<event_uuid>%22%7D" | jq .
   ```
5. Returns direct URLs:
   - Event Page: `https://app.dev.onton.live/events/<event_uuid>`
   - Management: `https://app.dev.onton.live/events/<event_uuid>/manage`

---

## Database Schema Pitfalls & Guardrails

1. **CamelCase Columns**: PostgreSQL preserves case only inside quotes. Table `events` has column `"ticketToCheckIn"` which MUST be quoted in raw SQL.
2. **Participation Enum**: Must be `'in_person'` or `'online'` (PostgreSQL enum `event_participation_type`).
3. **Owner Foreign Key**: Must reference a valid `user_id` in the `users` table. The seeder dynamically queries `SELECT user_id FROM users WHERE role IN ('organizer', 'admin') LIMIT 1`, falling back to `6716925175` on staging.
4. **Timestamps**: `start_date` and `end_date` are stored as integer UNIX timestamps in seconds (e.g. `EXTRACT(EPOCH FROM NOW())::INTEGER`), NOT JavaScript millisecond timestamps.
5. **Paid Events**: Require records in both `events` (`has_payment: true`), `event_payment` (price, `token_id`, `recipient_address`), and `orders` (`state: 'new'`, `order_type: 'event_creation'`).
