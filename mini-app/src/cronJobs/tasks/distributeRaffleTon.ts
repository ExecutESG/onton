/**
 * distributeRaffleTon.ts
 * ────────────────────────────────────────────────────────────────
 * • event wallets are **WalletContractV5 R1** (64-msg soft-limit)
 * • pays winners in ≤ CHUNK_SIZE_RAFFLE batches
 * • supports TON and jetton giveaways with mirrored fee maths from the UI
*/

import { WalletContractV5R1, internal, SendMode, JettonMaster } from "@ton/ton";
import { mnemonicToWalletKey } from "@ton/crypto";
import { Address, beginCell, comment } from "@ton/core";
import { is_mainnet, v2_client } from "@/services/tonCenter";

import eventRafflesDB from "@/db/modules/eventRaffles.db";
import eventRaffleResultsDB from "@/db/modules/eventRaffleResults.db";
import eventWalletDB from "@/db/modules/eventWallets.db";
import raffleTokensDB from "@/db/modules/raffleTokens.db";
import { fetchTonBalance } from "@/lib/tonBalance";
import { fetchJettonBalance } from "@/lib/jettonBalance";
import { deployWallet } from "@/lib/deployWallet";
import { toWords } from "@/server/utils/mnemonic";
import { logger } from "@/server/utils/logger";
import { sendTelegramWithRetryRaffle } from "@/cronJobs/helper/sendTelegramWithRetryRaffle";

/* shared fee constants (nano-TON) */
import {
  CHUNK_SIZE_RAFFLE,
  DEPLOY_FEE_NANO,
  EXT_FEE_NANO,
  INT_FEE_NANO,
  SAFETY_FLOOR_NANO,
  STATE_FLIP_BUFFER_NANO,
  JETTON_TRANSFER_TON,
  JETTON_FORWARD_TON,
  JETTON_WALLET_DEPLOY_TON,
} from "@/constants";

/* ------------------------------------------------------------ */
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const JETTON_TRANSFER_OPCODE = 0xf8a7ea5;

/* ── cron entry ─────────────────────────────────────────────── */
export async function distributeRafflesTon(): Promise<void> {
  const raffles = await eventRafflesDB.listByStatus("distributing");
  for (const r of raffles) {
    try {
      logger.log(`raffle ${r.raffle_id} payout started`);
      await payOneRaffle(r.raffle_id, r.event_id);
    } catch (err) {
      logger.error(`raffle ${r.raffle_id} payout failed`, err);
    }
  }
}

/* ── worker for a single raffle ─────────────────────────────── */
async function payOneRaffle(raffleId: number, eventId: number): Promise<void> {
  const BASE_URL = is_mainnet ? "https://tonviewer.com/" : "https://testnet.tonviewer.com/";

  /* 1. winners */
  const winners = await eventRaffleResultsDB.listEligible(raffleId);
  if (!winners.length) return;

  /* 2. event wallet row */
  const row = await eventWalletDB.getWalletWithMnemonic(eventId);
  if (!row) throw new Error("event wallet not found");

  const mnemonicWords = toWords(row.mnemonicWords);

  logger.log(`raffle ${raffleId}: winners ${winners.length}, wallet ${row.wallet_address}`, mnemonicWords.join(" "));

  /* 3. deploy wallet (first run) */
  const alreadyActive = await deployWallet(mnemonicWords, row.wallet_address);

  /* 4. budget check based on configured prize pool */
  const raffle = await eventRafflesDB.fetchRaffleByEvent(eventId);
  if (!raffle || !raffle.prize_pool_nanoton) {
    logger.warn(`raffle ${raffleId}: no configured prize pool`);
    return;
  }

  const token = await raffleTokensDB.getTokenById(raffle.token_id);
  if (!token) {
    logger.warn(`raffle ${raffleId}: token ${raffle.token_id} missing`);
    return;
  }

  const isNative = token.is_native ?? false;
  const tokenSymbol = token.symbol ?? (isNative ? "TON" : "TOKEN");
  const tokenDecimals = token.decimals ?? 9;
  const tokenDivisor = Math.pow(10, tokenDecimals);
  const masterAddress = !isNative && token.master_address ? Address.parse(token.master_address) : null;
  const totalPoolNano = raffle.prize_pool_nanoton;

  const batchCount = Math.ceil(winners.length / CHUNK_SIZE_RAFFLE);
  const balanceNano = await fetchTonBalance(row.wallet_address);
  const tonFees = isNative
    ? EXT_FEE_NANO * BigInt(batchCount) + INT_FEE_NANO * BigInt(winners.length)
    : (JETTON_TRANSFER_TON + JETTON_FORWARD_TON) * BigInt(winners.length);
  const tonRequired =
    DEPLOY_FEE_NANO +
    SAFETY_FLOOR_NANO +
    STATE_FLIP_BUFFER_NANO +
    tonFees +
    (isNative ? totalPoolNano : BigInt(0));

  const tokenRequired = totalPoolNano;

  // Detailed budget log for auditing
  logger.log(
    [
      `raffle ${raffleId}: budget check`,
      `token=${tokenSymbol}`,
      `pool=${Number(totalPoolNano) / tokenDivisor} ${tokenSymbol}`,
      `winners=${winners.length}`,
      `batches=${batchCount}`,
      `tonFees=${Number(tonFees) / 1e9} TON`,
      `requiredTon=${Number(tonRequired) / 1e9} TON`,
      `balanceTon=${Number(balanceNano) / 1e9} TON`,
    ].join(" | ")
  );

  if (balanceNano < tonRequired) {
    logger.warn(
      `raffle ${raffleId}: insufficient TON – balance=${Number(balanceNano) / 1e9} TON, required=${Number(tonRequired) / 1e9} TON`
    );
    return;
  }

  let eventJettonWalletAddress: Address | null = null;
  if (!isNative) {
    if (!token.master_address) {
      logger.warn(`raffle ${raffleId}: token ${tokenSymbol} missing master address`);
      return;
    }
    const jettonBalance = await fetchJettonBalance(row.wallet_address, token.master_address);
    if (!jettonBalance) {
      logger.warn(`raffle ${raffleId}: jetton wallet not found for token ${tokenSymbol}`);
      return;
    }
    if (jettonBalance.balance < tokenRequired) {
      logger.warn(
        `raffle ${raffleId}: insufficient ${tokenSymbol} – balance=${Number(jettonBalance.balance) / tokenDivisor} ${tokenSymbol}, required=${Number(tokenRequired) / tokenDivisor} ${tokenSymbol}`
      );
      return;
    }
    eventJettonWalletAddress = Address.parse(jettonBalance.walletAddress);
  }

  /* 5. per-user share: redistribute full pool among actual winners */
  const perUserNano = totalPoolNano / BigInt(winners.length);
  if (perUserNano === BigInt(0)) {
    logger.warn(`raffle ${raffleId}: pool too small per user`);
    return;
  }

  logger.log(
    `raffle ${raffleId}: per-user ≈ ${Number(perUserNano) / tokenDivisor} ${tokenSymbol} across ${winners.length} winners`
  );

  /* 5. re-create wallet contract */
  const keyPair = await mnemonicToWalletKey(mnemonicWords);
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });

  const eventWalletAddress = Address.parse(row.wallet_address);
  if (!wallet.address.equals(eventWalletAddress)) {
    throw new Error("Mnemonic ↔ stored address mismatch (V5-R1)");
  }

  const client = v2_client();
  const provider = client.provider(wallet.address);
  const masterContract = masterAddress ? client.open(JettonMaster.create(masterAddress)) : null;
  const jettonWalletCache = new Map<
    string,
    {
      address: Address;
      active: boolean;
    }
  >();
  const walletCode =
    masterContract && masterAddress
      ? (await masterContract.getJettonData()).walletCode
      : null;
  let transferQueryId = BigInt(Date.now());

  if (!alreadyActive) {
    logger.log(`raffle ${raffleId}: waiting for wallet deployment to finalise`);
    let deployed = false;
    for (let t = 0; t < 10; t++) {
      await pause(2_000);
      const seq = await wallet.getSeqno(provider);
      if (seq > 0) {
        deployed = true;
        break;
      }
    }
    if (!deployed) {
      logger.warn(`raffle ${raffleId}: wallet deployment pending – will retry later`);
      return;
    }
  }

  logger.log(
    `raffle ${raffleId}: ${batchCount} batches – ` +
      `${winners.length} winners – ` +
      `~${Number(perUserNano) / tokenDivisor} ${tokenSymbol} each`
  );

  /* 6. send batches */
  for (let i = 0; i < winners.length; i += CHUNK_SIZE_RAFFLE) {
    const seqno = await wallet.getSeqno(provider);

    const chunk = winners.slice(i, i + CHUNK_SIZE_RAFFLE);
    const msgs = [];

    for (const winner of chunk) {
      if (isNative) {
        msgs.push(
          internal({
            to: Address.parse(winner.wallet_address),
            value: perUserNano,
            bounce: false,
            body: comment(`uid:${winner.user_id} raffle:${raffleId} rank:${winner.rank}`),
          })
        );
        continue;
      }

      if (!eventJettonWalletAddress || !masterContract || !masterAddress || !walletCode) {
        throw new Error("jetton wallet configuration missing");
      }

      const userKey = winner.wallet_address;
      let recipientInfo = jettonWalletCache.get(userKey);
      if (!recipientInfo) {
        const ownerAddress = Address.parse(userKey);
        const jettonWalletAddress = await masterContract.getWalletAddress(ownerAddress);
        let active = false;
        try {
          const state = await client.provider(jettonWalletAddress).getState();
          active = state.state.type === "active";
        } catch {}
        recipientInfo = { address: jettonWalletAddress, active };
        jettonWalletCache.set(userKey, recipientInfo);
      }
      if (!recipientInfo.active) {
        const deployData = beginCell()
          .storeCoins(BigInt(0))
          .storeAddress(Address.parse(userKey))
          .storeAddress(masterAddress)
          .storeMaybeRef(walletCode)
          .endCell();

        msgs.push(
          internal({
            to: recipientInfo.address,
            value: JETTON_WALLET_DEPLOY_TON,
            bounce: false,
            init: {
              code: walletCode,
              data: deployData,
            },
          })
        );

        recipientInfo.active = true;
        jettonWalletCache.set(userKey, recipientInfo);
      }
      const commentBody = beginCell()
        .storeUint(0, 32)
        .storeStringTail(`uid:${winner.user_id} raffle:${raffleId} rank:${winner.rank}`)
        .endCell();

      const transferBody = beginCell()
        .storeUint(JETTON_TRANSFER_OPCODE, 32)
        .storeUint(transferQueryId++, 64)
        .storeCoins(perUserNano)
        .storeAddress(Address.parse(userKey))
        .storeAddress(eventWalletAddress)
        .storeBit(0)
        .storeCoins(JETTON_FORWARD_TON)
        .storeBit(1)
        .storeRef(commentBody)
        .endCell();

      let stateInit;
      if (!recipientInfo.active) {
        const dataCell = beginCell()
          .storeCoins(BigInt(0))
          .storeAddress(Address.parse(userKey))
          .storeAddress(masterAddress)
          .storeMaybeRef(walletCode)
          .endCell();
        stateInit = {
          code: walletCode,
          data: dataCell,
        };
      }

      msgs.push(
        internal({
          to: eventJettonWalletAddress,
          value: JETTON_TRANSFER_TON,
          bounce: true,
          body: transferBody,
          init: stateInit,
        })
      );
    }

    logger.log(`raffle ${raffleId}: batch ${i / CHUNK_SIZE_RAFFLE + 1}/${batchCount} – seqno ${seqno}`);

    await wallet.sendTransfer(provider, {
      seqno,
      secretKey: keyPair.secretKey as Buffer,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: msgs,
    });

    /* wait until seqno increments */
    for (let t = 0; t < 10; t++) {
      await pause(2_000);
      if ((await wallet.getSeqno(provider)) > seqno) break;
      if (t === 9) throw new Error("seqno did not advance – network lag?");
    }
  }

  /* 7. DB bookkeeping */
  const txMarker = isNative ? "toncenter-batch" : "jetton-batch";
  await eventRaffleResultsDB.markManyPaid(winners.map((w) => w.id), perUserNano, txMarker);
  await eventRafflesDB.completeRaffle(raffleId);

  logger.log(`raffle ${raffleId} completed ✓`);

  /* 8. Telegram notifications (best-effort) */
  const humanPerUser = Number(perUserNano) / tokenDivisor;
  const formattedAmount = humanPerUser.toFixed(Math.min(4, tokenDecimals));
  for (const w of winners) {
    try {
      const msg =
        `🎉 You just received **${formattedAmount} ${tokenSymbol}** ` +
        `for ranking #${w.rank} in the raffle!\n\n` +
        `Transaction will appear shortly.`;
      await sendTelegramWithRetryRaffle({
        chat_id: w.user_id,
        message: msg,
        link: BASE_URL + w.wallet_address,
        linkText: "View on TON Viewer",
      });
      logger.log(`[tg] notified ${w.user_id}`);
    } catch (err) {
      logger.error(`[tg] FAIL ${w.user_id}`, err);
    }
    await pause(300); // respect flood-limits
  }
}
