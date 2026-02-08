/**
 * deployWallet.ts — V5-R1 manual deploy
 *
 * • Derives the wallet from the mnemonic and verifies it matches the
 *   stored address.
 * • If the wallet already has seqno > 0 → returns true.
 * • Otherwise it:
 *     1.  Uses wallet.createTransfer(...) to build the **signed** body
 *         for seqno 0 (empty action list, mode 3).
 *     2.  Wraps that body together with wallet.init.{code,data} into a
 *         raw external message.
 *     3.  Pushes the BOC via provider.external(...).
 * • Returns false after the broadcast so the caller can poll getSeqno()
 *   until it becomes 1.
 */

import { WalletContractV5R1, SendMode, internal } from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";
import { Address } from "@ton/core";
import { v2_client } from "@/services/tonCenter";
import { logger } from "@/server/utils/logger";
import { DEPLOY_FEE_NANO } from "@/constants"; // ≈ 0.06 TON

const toWords = (src: string | string[]) => (Array.isArray(src) ? src : src.trim().split(/\s+/));

export async function deployWallet(mnemonic: string | string[], storedAddress: string): Promise<boolean> {
  /* 1️⃣  derive & sanity-check address */
  logger.log(
    "deployWallet: deriving address from mnemonic and checking against stored menmonic is :",
    toWords(mnemonic).join(" "),
    storedAddress
  );
  const keyPair = await mnemonicToWalletKey(toWords(mnemonic));
  const wallet = WalletContractV5R1.create({ workchain: 0, publicKey: keyPair.publicKey });

  const derived = wallet.address;
  const stored = Address.parse(storedAddress);
  if (!derived.equals(stored)) {
    logger.error("Mnemonic ↔ address mismatch");
    return false;
  }

  const client = v2_client();
  const provider = client.provider(derived);
  const opened = client.open(wallet);

  /* 2️⃣  active already? */
  const seqno = await opened.getSeqno();
  if (seqno !== 0) {
    logger.log(`wallet ${derived} active (seqno ${seqno})`);
    return true;
  }
  logger.log(`wallet ${derived} not yet deployed (seqno 0) – deploying...`);
  /* 3️⃣  funded enough? (needs ≥ deploy gas) */
  const { balance } = await provider.getState();
  if (balance < DEPLOY_FEE_NANO) {
    logger.warn(`wallet balance ${Number(balance) / 1e9} TON < deploy gas (~0.06 TON)`);
    return false;
  }
  logger.log(`wallet balance ${Number(balance) / 1e9} TON – proceeding with deploy`);
  /* 4️⃣  let the SDK assemble and broadcast the initial external message */
  // Using wallet.sendTransfer with seqno=0 ensures the correct StateInit
  // and message layout for V5R1. Include a small self-transfer to cover gas.

  await opened.sendTransfer({
    seqno: 0,
    secretKey: keyPair.secretKey as Buffer,
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: derived,
        value: DEPLOY_FEE_NANO, // covers initial gas
        bounce: false,
      }),
    ],
  });

  // Wait for seqno to increment (3 retries)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const s = await opened.getSeqno();
      if (s > 0) {
        logger.log(`deploy complete; seqno=${s} (attempt ${attempt})`);
        return true;
      }
      logger.log(`deploy pending; seqno still 0 (attempt ${attempt})`);
    } catch (e) {
      logger.warn(`deploy seqno poll error (attempt ${attempt})`, e);
    }
  }

  logger.log("deploy tx submitted – seqno still 0 after retries (cron will retry later)");
  return false;
}
