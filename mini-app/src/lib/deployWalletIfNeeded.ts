// deployWalletIfNeeded.ts
import { WalletContractV4, internal, toNano, SendMode } from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";
import { Address } from "@ton/core";
import { v2_client } from "@/services/tonCenter";
import { fetchTonBalance } from "@/lib/tonBalance";
import { logger } from "@/server/utils/logger";
import { toWords } from "@/server/utils/mnemonic";

const DEPLOY_VALUE = toNano("0.06"); // covers deploy gas

export async function deployWalletIfNeeded(words: string | string[], storedAddr: string): Promise<boolean> {
  logger.log(`checking wallet deployment for ${storedAddr}`, toWords(words));
  const keyPair = await mnemonicToWalletKey(toWords(words));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const derived = wallet.address;
  const stored = Address.parse(storedAddr);

  if (!derived.equals(stored)) {
    logger.error(`mnemonic ↔ address mismatch (derived ${derived} vs stored ${stored})`);
    return false;
  }

  const balance = await fetchTonBalance(storedAddr);
  if (balance < DEPLOY_VALUE) {
    logger.warn(`wallet ${stored} has only ${balance} nano – fund ≥0.06 TON to deploy`);
    return false;
  }

  const client = v2_client();
  const provider = client.provider(stored);
  const seqno = await wallet.getSeqno(provider);
  if (seqno !== 0) {
    logger.log(`wallet ${stored} already active (seqno ${seqno})`);
    return true;
  }

  logger.log(`deploying wallet ${stored}`);

  await wallet.sendTransfer(provider, {
    seqno: 0,
    secretKey: keyPair.secretKey as Buffer,
    sendMode: 0, // <- pay gas from message value!
    messages: [
      internal({
        to: stored, // self‑transfer, supplies ≥0.06 TON
        value: DEPLOY_VALUE,
        bounce: false,
      }),
    ],
  });

  logger.log("deploy tx submitted – wait one block then retry payouts");
  return false;
}
