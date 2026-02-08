import { db } from "@/db/db";
import { tokenCampaignNftItems } from "@/db/schema/tokenCampaignNftItems";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { Address, internal, beginCell, toNano, SendMode } from "@ton/core";
import { waitSeqno, openWallet } from "@/lib/nft"; // adjust import path
import tonCenter from "@/services/tonCenter";
import { sleep } from "@/utils";

// The blackhole address: any NFT sent here is effectively "burned"
const BLACKHOLE_ADDRESS = Address.parse("EQD__________________________________________0vo");

/**
 * Creates the standard NFT 'transfer' cell (op=0x5fcc3d14),
 * sending ownership to the blackhole address.
 */
function createBurnTransferCell() {
  return (
    beginCell()
      .storeUint(0x5fcc3d14, 32) // standard NFT transfer opcode
      .storeUint(0, 64) // query_id=0
      .storeAddress(BLACKHOLE_ADDRESS) // newOwner => blackhole
      .storeAddress(null) // response_destination => none
      // no custom_payload
      .storeBit(false)
      // forward_amount => 0
      .storeCoins(0)
      // forward_payload => false
      .storeBit(false)
      .endCell()
  );
}

/**
 * Checks whether the given NFT address had a successful "burn" sub-transaction.
 * If found, returns the subTx hash. Otherwise null => meaning it failed or didn't happen.
 */
async function checkBurnSuccess(nftAddress: string): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const hourAgo = now - 3600;

    // Fetch recent transactions for the NFT contract
    // Increase the limit if you do lots of transactions
    const txs = await tonCenter.fetchAllTransactions(nftAddress, hourAgo, null, 50, "desc");
    if (!txs || !txs.length) return null;

    // We check for a transaction with exit_code=0 => success
    for (const t of txs) {
      const compute = t.description?.compute_ph;
      if (compute && !compute.skipped && compute.exit_code === 0) {
        return t.hash; // subTx hash
      }
    }
    return null;
  } catch (err) {
    logger.error(`[checkBurnSuccess] Error for NFT ${nftAddress}:`, err);
    return null;
  }
}

/**
 * burnMergedNfts:
 * 1) Opens your admin wallet (from .env).
 * 2) Fetches all items with mergeStatus="merged".
 * 3) For each item individually:
 *    - Sends a single message transferring it to the blackhole address.
 *    - Waits for seqno to increment => transaction in chain.
 *    - Checks sub-transaction success.
 *        - If success => mark mergeStatus="burned", store burnTrxHash.
 *        - If fail => remains "merged", skip.
 */
export async function burnMergedNfts() {
  //logger.info("[burnMergedNfts] Starting burn process (single TX per item)...");

  // 1) Open admin wallet
  const wallet = await openWallet(process.env.MNEMONIC!.split(" "));
  if (!wallet) {
    logger.error("[burnMergedNfts] Could not open admin wallet. Exiting.");
    return;
  }

  // 2) Find items with mergeStatus="merged"
  const mergedItems = await db
    .select()
    .from(tokenCampaignNftItems)
    .where(and(eq(tokenCampaignNftItems.mergeStatus, "merged"), isNull(tokenCampaignNftItems.burnTrxHash)))
    .execute();

  if (!mergedItems.length) {
    // logger.info("[burnMergedNfts] No items to burn.");
    return;
  }
  logger.info(`[burnMergedNfts] Found ${mergedItems.length} items to burn.`, mergedItems);

  // 3) For each item => single message
  for (const item of mergedItems) {
    logger.info(`[burnMergedNfts] Burning item #${item.id} => ${item.nftAddress} ...`);

    try {
      // Build the burn cell
      const burnPayload = createBurnTransferCell();

      // The NFT contract address is item.nftAddress
      const nftAddr = Address.parse(item.nftAddress);

      // Get current seqno
      const seqnoBefore = await wallet.contract.getSeqno();

      // Send a single message
      await wallet.contract.sendTransfer({
        seqno: seqnoBefore,
        secretKey: wallet.keyPair.secretKey,
        messages: [
          internal({
            to: nftAddr,
            value: toNano("0.065"), // Enough gas for the NFT contract
            body: burnPayload,
          }),
        ],
        sendMode: SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY,
      });

      // Wait for seqno to increment => main TX is on-chain
      const seqnoAfter = await waitSeqno(seqnoBefore, wallet);
      logger.info(`[burnMergedNfts] item #${item.id} => seqno after: ${seqnoAfter}`);

      // Check sub-transaction success
      const subTxHash = await checkBurnSuccess(item.nftAddress);
      if (!subTxHash) {
        logger.warn(`[burnMergedNfts] item #${item.id} => burn subTx fail => remain "merged"`);
        // Do not update the DB => we can re-try next time
        continue;
      }

      // Mark as burned, store subTx hash
      await db
        .update(tokenCampaignNftItems)
        .set({
          mergeStatus: "burned",
          burnTrxHash: subTxHash,
        })
        .where(eq(tokenCampaignNftItems.id, item.id))
        .execute();

      logger.info(`[burnMergedNfts] item #${item.id} => burned, subTxHash=${subTxHash}`);

      // short sleep to avoid spamming
      await sleep(2000);
    } catch (err) {
      logger.error(`[burnMergedNfts] item #${item.id} => TX error:`, err);
      // if we fail the top-level TX, we skip it => remain "merged" => re-try later
    }
  }

  logger.info("[burnMergedNfts] Completed burning 'merged' items, one by one.");
}
