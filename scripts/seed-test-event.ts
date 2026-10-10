#!/usr/bin/env node
/**
 * ONTON Test Event Generator & Seeder
 * 
 * Creates schema-compliant test events with distinct archetypes and characteristics
 * for local development and staging environments.
 * 
 * Usage:
 *   npx tsx scripts/seed-test-event.ts --preset free_rsvp --env staging
 *   npx tsx scripts/seed-test-event.ts --preset approval_gated --env staging
 *   npx tsx scripts/seed-test-event.ts --preset paid_crypto --price 5.0 --env staging
 *   npx tsx scripts/seed-test-event.ts --preset online_stream --env staging
 *   npx tsx scripts/seed-test-event.ts --preset sbt_poa --env staging
 *   npx tsx scripts/seed-test-event.ts --preset contest --env staging
 *   npx tsx scripts/seed-test-event.ts --preset unlisted_private --env staging
 *   npx tsx scripts/seed-test-event.ts --sql-only
 */

import { randomUUID } from "crypto";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type EventPreset = 
  | "free_rsvp"
  | "approval_gated"
  | "paid_crypto"
  | "paid_stars"
  | "online_stream"
  | "sbt_poa"
  | "contest"
  | "unlisted_private";

export interface EventOptions {
  preset: EventPreset;
  title?: string;
  subtitle?: string;
  description?: string;
  location?: string;
  capacity?: number;
  price?: number;
  token?: string;
  secretPhrase?: string;
  sbtCollection?: string;
  imageUrl?: string;
  targetEnv: "staging" | "local" | "sql";
  uuid?: string;
}

interface PresetDefinition {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  location: string;
  timezone: string;
  categoryId: number;
  participationType: "in_person" | "online";
  hasRegistration: boolean;
  hasApproval: boolean;
  capacity: number;
  hasWaitingList: boolean;
  hasPayment: boolean;
  ticketToCheckIn: boolean;
  price?: number;
  tokenId?: number;
  secretPhrase?: string;
  sbtCollectionAddress?: string;
  hidden?: boolean;
}

const PRESETS: Record<EventPreset, PresetDefinition> = {
  free_rsvp: {
    title: "TON Web3 Builders & Developers Meetup",
    subtitle: "Hands-on developer workshops, ecosystem updates & networking",
    description: "Join top TON developers and founders for an evening of technical discussions, deep-dives into FunC & Tact smart contracts, and open networking. Open registration with instant ticket pass issuance.",
    imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    location: "Address Downtown, Downtown Dubai",
    timezone: "Asia/Dubai",
    categoryId: 11, // Technology
    participationType: "in_person",
    hasRegistration: true,
    hasApproval: false,
    capacity: 100,
    hasWaitingList: true,
    hasPayment: false,
    ticketToCheckIn: false,
  },
  approval_gated: {
    title: "Exclusive TON VC & Founders Executive Dinner",
    subtitle: "Curated dinner discussion for Web3 fund managers & early-stage founders",
    description: "Private gathering for Web3 founders, GPs, and institutional ecosystem partners. All registrations require organizer approval before ticket passes are unlocked.",
    imageUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80",
    location: "The Ritz-Carlton DIFC, Dubai",
    timezone: "Asia/Dubai",
    categoryId: 9, // Networking
    participationType: "in_person",
    hasRegistration: true,
    hasApproval: true,
    capacity: 30,
    hasWaitingList: true,
    hasPayment: false,
    ticketToCheckIn: false,
  },
  paid_crypto: {
    title: "TON Smart Contract Security & Architecture Summit",
    subtitle: "Deep-dive masterclass on auditing, TVM vulnerabilities & gas optimization",
    description: "Intensive technical summit covering TVM internals, async message race conditions, reentrancy guards, and zero-knowledge scaling on TON. Ticket payment required in TON.",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    location: "Crypto Oasis, Dubai Silicon Oasis",
    timezone: "Asia/Dubai",
    categoryId: 4, // Educational
    participationType: "in_person",
    hasRegistration: true,
    hasApproval: false,
    capacity: 50,
    hasWaitingList: false,
    hasPayment: true,
    ticketToCheckIn: true,
    price: 5.0,
    tokenId: 1, // TON
  },
  paid_stars: {
    title: "TON Mini App Growth & Monetization Workshop",
    subtitle: "Telegram Stars monetization, viral loops, and ads conversion",
    description: "Exclusive masterclass for mini-app developers on integrating Telegram Stars, processing payments, and architecting viral acquisition mechanisms.",
    imageUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
    location: "Grand Plaza Mövenpick Media City, Dubai",
    timezone: "Asia/Dubai",
    categoryId: 6, // Finance
    participationType: "in_person",
    hasRegistration: true,
    hasApproval: false,
    capacity: 75,
    hasWaitingList: true,
    hasPayment: true,
    ticketToCheckIn: true,
    price: 150.0, // Stars price
    tokenId: 1,
  },
  online_stream: {
    title: "Global TON Ecosystem Showcase & Demo Day",
    subtitle: "Virtual livestream showcase of top TON mini-apps and DeFi protocols",
    description: "Global virtual demo day featuring live presentations from high-growth Telegram Mini Apps. Access gated by stream secret phrase.",
    imageUrl: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1200&q=80",
    location: "Online Stream (YouTube Live / Zoom)",
    timezone: "UTC",
    categoryId: 11, // Technology
    participationType: "online",
    hasRegistration: true,
    hasApproval: false,
    capacity: 500,
    hasWaitingList: false,
    hasPayment: false,
    ticketToCheckIn: false,
    secretPhrase: "TON2026",
  },
  sbt_poa: {
    title: "Proof of Attendance: TON Workshop Series 2026",
    subtitle: "Hands-on workshop with verifiable Soulbound Token (SBT) issuance",
    description: "Attendees verify presence via dynamic QR code to mint an on-chain Soulbound Token (SBT) Proof of Attendance badge on TON mainnet.",
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
    location: "Jumeirah Emirates Towers, Dubai",
    timezone: "Asia/Dubai",
    categoryId: 3, // Conference/Summit
    participationType: "in_person",
    hasRegistration: true,
    hasApproval: false,
    capacity: 150,
    hasWaitingList: true,
    hasPayment: false,
    ticketToCheckIn: false,
    sbtCollectionAddress: "EQDBGLQs81nZBBlEdbb7Ni1wqFzI8nRW4v-6e_soa5TMf5FW",
  },
  contest: {
    title: "ONTON Sudoku Showdown Championship",
    subtitle: "Compete in live head-to-head Sudoku duels for a 500 TON prize pool",
    description: "Competitive speed gaming tournament powered by @SudokuShowdownBot and ONTON. Bracket match-ups, live leaderboard rankings, and direct TON rewards for winners.",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    location: "Online & In-Person Gaming Arena",
    timezone: "UTC",
    categoryId: 8, // Gaming
    participationType: "online",
    hasRegistration: true,
    hasApproval: false,
    capacity: 256,
    hasWaitingList: false,
    hasPayment: false,
    ticketToCheckIn: false,
  },
  unlisted_private: {
    title: "Private Core Architecture Working Group",
    subtitle: "Closed-door technical sync on protocol governance & upgrades",
    description: "Unlisted, private coordination sync for core maintainers and infrastructure partners. Not indexed in the public feed.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    location: "Private Executive Briefing Room",
    timezone: "UTC",
    categoryId: 10, // Other
    participationType: "in_person",
    hasRegistration: true,
    hasApproval: true,
    capacity: 15,
    hasWaitingList: false,
    hasPayment: false,
    ticketToCheckIn: false,
    hidden: true,
  },
};

/**
 * Builds the complete, transaction-safe SQL statement
 */
export function buildEventSql(opts: EventOptions): { sql: string; eventUuid: string; title: string } {
  const preset = PRESETS[opts.preset];
  if (!preset) {
    throw new Error(`Unknown preset: ${opts.preset}. Available: ${Object.keys(PRESETS).join(", ")}`);
  }

  const eventUuid = opts.uuid || randomUUID();
  const title = (opts.title || preset.title).replace(/'/g, "''");
  const subtitle = (opts.subtitle || preset.subtitle).replace(/'/g, "''");
  const description = (opts.description || preset.description).replace(/'/g, "''");
  const location = (opts.location || preset.location).replace(/'/g, "''");
  const imageUrl = (opts.imageUrl || preset.imageUrl).replace(/'/g, "''");
  const capacity = opts.capacity ?? preset.capacity;
  const price = opts.price ?? preset.price ?? 0;
  const hasPayment = preset.hasPayment;
  const ticketToCheckIn = preset.ticketToCheckIn;
  const sbtAddress = opts.sbtCollection || preset.sbtCollectionAddress;
  const secretPhrase = (opts.secretPhrase || preset.secretPhrase || "").replace(/'/g, "''");
  const hidden = preset.hidden ? "true" : "false";

  const sql = `
DO $$
DECLARE
  v_owner bigint;
  v_uuid uuid := '${eventUuid}'::uuid;
  v_token_id integer;
BEGIN
  -- Resolve valid organizer/admin user, fallback to active user or default
  SELECT user_id INTO v_owner FROM users WHERE role IN ('organizer', 'admin') ORDER BY user_id LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM users ORDER BY user_id LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    v_owner := 6716925175; -- Staging fallback organizer
  END IF;

  -- Insert core event record
  INSERT INTO events (
    event_uuid,
    type,
    title,
    subtitle,
    description,
    image_url,
    start_date,
    end_date,
    timezone,
    location,
    owner,
    participation_type,
    has_registration,
    has_approval,
    capacity,
    has_waiting_list,
    category_id,
    has_payment,
    "ticketToCheckIn",
    wallet_address,
    sbt_collection_address,
    secret_phrase,
    society_hub,
    society_hub_id,
    enabled,
    hidden,
    updated_by
  ) VALUES (
    v_uuid,
    1,
    '${title}',
    '${subtitle}',
    '${description}',
    '${imageUrl}',
    EXTRACT(EPOCH FROM NOW() + INTERVAL '2 hours')::INTEGER,
    EXTRACT(EPOCH FROM NOW() + INTERVAL '7 days')::INTEGER,
    '${preset.timezone}',
    '${location}',
    v_owner,
    '${preset.participationType}',
    ${preset.hasRegistration},
    ${preset.hasApproval},
    ${capacity},
    ${preset.hasWaitingList},
    ${preset.categoryId},
    ${hasPayment},
    ${ticketToCheckIn},
    ${hasPayment ? "'UQDBGLQs81nZBBlEdbb7Ni1wqFzI8nRW4v-6e_soa5TMf-10'" : "NULL"},
    ${sbtAddress ? `'${sbtAddress}'` : "NULL"},
    '${secretPhrase}',
    'Onton',
    '33',
    true,
    ${hidden},
    'system'
  );

  ${hasPayment ? `
  -- Resolve payment token (TON default)
  SELECT token_id INTO v_token_id FROM event_tokens WHERE symbol = 'TON' LIMIT 1;
  IF v_token_id IS NULL THEN
    SELECT token_id INTO v_token_id FROM event_tokens LIMIT 1;
  END IF;
  IF v_token_id IS NULL THEN
    v_token_id := 1;
  END IF;

  -- Insert payment configuration
  INSERT INTO event_payment (
    event_uuid,
    token_id,
    price,
    recipient_address,
    bought_capacity,
    ticket_type,
    title,
    description
  ) VALUES (
    v_uuid,
    v_token_id,
    ${price},
    'UQDBGLQs81nZBBlEdbb7Ni1wqFzI8nRW4v-6e_soa5TMf-10',
    ${capacity},
    1,
    'General Admission',
    'Access to all summit keynotes, workshops, and networking lounge'
  );

  -- Insert event creation order record
  INSERT INTO orders (
    event_uuid,
    user_id,
    total_price,
    token_id,
    state,
    order_type,
    owner_address
  ) VALUES (
    v_uuid,
    v_owner,
    0,
    v_token_id,
    'new',
    'event_creation',
    ''
  );
  ` : ""}

  RAISE NOTICE 'SUCCESS: Event % created with UUID %', '${title}', v_uuid;
END $$;

SELECT 
  event_id, 
  event_uuid, 
  title, 
  participation_type, 
  has_registration, 
  has_approval, 
  capacity, 
  has_payment, 
  hidden,
  enabled 
FROM events 
WHERE event_uuid = '${eventUuid}'::uuid;
`.trim();

  return { sql, eventUuid, title };
}

/**
 * Dispatches the event creation to Staging via GitHub Actions single-shot execution
 */
async function executeOnStaging(sql: string, eventUuid: string, title: string) {
  console.log(`\n🚀 [Staging Dispatch] Deploying test event: "${title}" (${eventUuid})...`);

  // Base64 encode SQL payload to prevent any shell escaping or quoting corruption
  const b64 = Buffer.from(sql).toString("base64");
  const remoteCommand = `echo '${b64}' | base64 -d | docker exec -i \\$(docker ps -q -f name=postgres | head -n 1) psql -U onton -d mini-app`;

  console.log(`📦 Triggering inspect-server.yml workflow via gh CLI...`);
  const triggerCmd = `gh workflow run inspect-server.yml -f action=custom -f target_server=dev -f custom_command="${remoteCommand}"`;
  
  try {
    execSync(triggerCmd, { stdio: "pipe", encoding: "utf-8" });
  } catch (err: any) {
    throw new Error(`Failed to trigger workflow: ${err.message}`);
  }

  // Find the triggered run ID
  console.log(`⏳ Waiting for workflow run to register...`);
  execSync("sleep 3");
  
  let runId = "";
  try {
    const listJson = execSync("gh run list --workflow=inspect-server.yml --limit 1 --json databaseId,status,url", { encoding: "utf-8" });
    const runs = JSON.parse(listJson);
    if (runs && runs.length > 0) {
      runId = String(runs[0].databaseId);
      console.log(`🔗 Watching run: https://github.com/ExecutESG/onton/actions/runs/${runId}`);
    }
  } catch {}

  if (runId) {
    try {
      execSync(`gh run watch ${runId}`, { stdio: "inherit" });
    } catch {
      console.log(`⚠️ Watch command ended, verifying outcome directly...`);
    }
  } else {
    console.log(`⏳ Waiting 15s for execution to complete on host...`);
    execSync("sleep 15");
  }

  // Verify the event directly against the live staging API
  console.log(`\n🔍 Verifying event on Staging via public tRPC API...`);
  const targetUrl = "https://app.dev.onton.live";
  const apiCheckCmd = `curl -s "${targetUrl}/api/trpc/events.getEvent?input=%7B%22event_uuid%22%3A%22${eventUuid}%22%7D"`;
  
  try {
    const res = execSync(apiCheckCmd, { encoding: "utf-8" });
    const parsed = JSON.parse(res);
    if (parsed?.result?.data?.event_uuid) {
      console.log(`\n✅ TEST EVENT CREATED & VERIFIED SUCCESSFULLY!`);
      console.log(`--------------------------------------------------`);
      console.log(`📌 Title:      ${parsed.result.data.title}`);
      console.log(`🆔 UUID:       ${parsed.result.data.event_uuid}`);
      console.log(`🎟️  Type:       ${parsed.result.data.participation_type}`);
      console.log(`👥 Capacity:   ${parsed.result.data.capacity}`);
      console.log(`🔐 Approval:   ${parsed.result.data.has_approval}`);
      console.log(`💰 Paid:       ${parsed.result.data.has_payment}`);
      console.log(`🌐 Live URL:   ${targetUrl}/events/${eventUuid}`);
      console.log(`🛠️  Manage:    ${targetUrl}/events/${eventUuid}/manage`);
      console.log(`--------------------------------------------------\n`);
      return;
    }
  } catch (err: any) {
    console.log(`⚠️ tRPC ping failed or returned non-JSON. Checking HTTP page...`);
  }

  // Fallback HTTP check
  const httpStatus = execSync(`curl -s -o /dev/null -w "%{http_code}" "${targetUrl}/events/${eventUuid}"`, { encoding: "utf-8" }).trim();
  console.log(`HTTP Status for ${targetUrl}/events/${eventUuid}: ${httpStatus}`);
  if (httpStatus === "200") {
    console.log(`✅ Page renders with HTTP 200: ${targetUrl}/events/${eventUuid}`);
  } else {
    console.log(`⚠️ Check details at ${targetUrl}/events/${eventUuid}`);
  }
}

/**
 * Executes directly on local PostgreSQL database using pg
 */
async function executeOnLocal(sql: string, eventUuid: string, title: string) {
  console.log(`\n💻 [Local Database] Inserting test event: "${title}" (${eventUuid})...`);
  
  // Read local .env
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    try {
      const envPath = path.resolve(__dirname, "..", ".env");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const match = envContent.match(/DATABASE_URL=["']?([^"'\n\r]+)["']?/);
        if (match) dbUrl = match[1];
      }
    } catch {}
  }

  if (!dbUrl) {
    console.log(`⚠️ No DATABASE_URL found in environment or .env. Outputting SQL:\n`);
    console.log(sql);
    return;
  }

  try {
    const { Client } = require(path.resolve(__dirname, "..", "mini-app", "node_modules", "pg"));
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    await client.query(sql);
    await client.end();

    console.log(`✅ Event created locally!`);
    console.log(`Live local URL: http://localhost:3000/events/${eventUuid}`);
  } catch (err: any) {
    console.error(`❌ Local insertion failed: ${err.message}`);
    console.log(`Raw SQL output below for manual execution:\n\n${sql}`);
  }
}

// CLI Arg Parsing
function parseArgs(): EventOptions {
  const args = process.argv.slice(2);
  const options: EventOptions = {
    preset: "free_rsvp",
    targetEnv: "staging",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--preset" || arg === "-p") {
      options.preset = args[++i] as EventPreset;
    } else if (arg === "--env" || arg === "-e") {
      options.targetEnv = args[++i] as any;
    } else if (arg === "--title" || arg === "-t") {
      options.title = args[++i];
    } else if (arg === "--capacity" || arg === "-c") {
      options.capacity = parseInt(args[++i], 10);
    } else if (arg === "--price") {
      options.price = parseFloat(args[++i]);
    } else if (arg === "--location" || arg === "-l") {
      options.location = args[++i];
    } else if (arg === "--uuid" || arg === "-u") {
      options.uuid = args[++i];
    } else if (arg === "--sql-only") {
      options.targetEnv = "sql";
    }
  }

  return options;
}

function printHelp() {
  console.log(`
ONTON Test Event Generator & Seeder
====================================
Generates clean, schema-compliant test events with distinct characteristics.

Usage:
  npx tsx scripts/seed-test-event.ts [options]

Presets:
  free_rsvp         Open meetup / workshop with instant ticket issuance (Default)
  approval_gated    VIP / Founders dinner requiring organizer manual approval
  paid_crypto       Paid masterclass requiring TON/crypto ticket checkout
  paid_stars        Telegram Stars payment event
  online_stream     Virtual livestream event with secret phrase gating
  sbt_poa           Event issuing Proof-of-Attendance Soulbound Tokens (SBT)
  contest           Competitive gaming/hackathon tournament
  unlisted_private  Secret event hidden from public index

Options:
  -p, --preset <name>      Event preset archetype (Default: free_rsvp)
  -e, --env <target>       Target environment: staging | local | sql (Default: staging)
  -t, --title <string>     Override event title
  -c, --capacity <number>  Override attendee capacity
  --price <number>         Override ticket price (for paid presets)
  -l, --location <string>  Override event venue/location
  -u, --uuid <uuid>        Custom UUID for deterministic testing
  --sql-only               Print SQL transaction without executing
  -h, --help               Show this help message
`);
}

async function main() {
  const options = parseArgs();
  const { sql, eventUuid, title } = buildEventSql(options);

  if (options.targetEnv === "sql") {
    console.log(sql);
    return;
  }

  if (options.targetEnv === "local") {
    await executeOnLocal(sql, eventUuid, title);
    return;
  }

  if (options.targetEnv === "staging") {
    await executeOnStaging(sql, eventUuid, title);
    return;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n❌ Error:`, err.message);
    process.exit(1);
  });
}
