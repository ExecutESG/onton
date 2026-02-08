import { db } from "@/db/db";
import { events } from "@/db/schema/events";
import { isNotNull, gt, and, isNull, eq } from "drizzle-orm";

import { mnemonicNew, mnemonicToWalletKey } from "@ton/crypto";
import { WalletContractV5R1 } from "@ton/ton"; // ← V5 wallet factory

import eventWalletDB from "@/db/modules/eventWallets.db";
import { encrypt } from "@/lib/cryptoHelpers";
import { logger } from "@/server/utils/logger";

/**
 * Finds all future events that already have an activity_id but
 * lack a giveaway wallet, then creates a **V5-R1 wallet** for each.
 */
export async function createWalletsForUpcomingEvents(): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);

  /* 1️⃣  candidates ------------------------------------------------------ */
  const candidates = await db
    .select({ id: events.event_id, title: events.title })
    .from(events)
    .where(
      and(
        isNotNull(events.activity_id), // activity mapped
        gt(events.end_date, nowSec), // event still in future
        isNull(events.giveaway_wallet_address)
      )
    )
    .execute();

  logger.log(`[wallet-creator] ${candidates.length} events need V5 wallets`);

  /* 2️⃣  loop ------------------------------------------------------------ */
  for (const ev of candidates) {
    logger.log(`[wallet-creator] → event ${ev.id}`);

    /* skip if some parallel worker already inserted */
    if (await eventWalletDB.fetchEventWalletByEventId(ev.id)) {
      logger.log(`[wallet-creator]   already has wallet – skip`);
      continue;
    }

    try {
      /* A. generate keys & wallet -------------------------------------- */
      const mnemonic = await mnemonicNew(); // 24-word BIP-39
      const keys = await mnemonicToWalletKey(mnemonic);

      const wallet = WalletContractV5R1.create({
        workchain: 0,
        publicKey: keys.publicKey,
      });

      const addr = wallet.address.toString({ urlSafe: true });
      logger.log(`[wallet-creator]   built V5 wallet ${addr}`);

      /* B. insert into event_wallets ----------------------------------- */
      await eventWalletDB.insertEventWallet({
        event_id: ev.id,
        wallet_address: addr,
        public_key: Buffer.from(keys.publicKey).toString("base64"),
        mnemonic: encrypt(mnemonic.join(" ")), // 🔐
      });

      /* C. mirror into events table ------------------------------------ */
      await db.update(events).set({ giveaway_wallet_address: addr }).where(eq(events.event_id, ev.id)).execute();

      logger.log(`[wallet-creator]   ✔ stored ${addr}`);
    } catch (err) {
      logger.error(`[wallet-creator]   ❌ event ${ev.id} failed`, err);
    }
  }

  logger.log(`[wallet-creator] done`);
}
