import { config } from "@/server/config";
import { logger } from "@/server/utils/logger";
import { db } from "@/db/db";
import { walletChecks } from "@/db/schema/walletChecks";
import { eq, inArray, and, lt, count, or } from "drizzle-orm";
import tonCenter from "@/services/tonCenter";
import { tokenCampaignNftItems } from "@/db/schema/tokenCampaignNftItems";
import { tokenCampaignNftCollections } from "@/db/schema/tokenCampaignNftCollections";
import { tokenCampaignUserSpins } from "@/db/schema/tokenCampaignUserSpins";
import { tokenCampaignMergeTransactions } from "@/db/schema/tokenCampaignMergeTransactions";
import { is_prod_env } from "@/server/utils/evnutils";
import { Address } from "@ton/core";
/**
 * Returns the raw-hex form (`0:abcd…`) of any TON address that can be parsed.
 * If the string is already raw, you get the same value back.
 * If it cannot be parsed, `null` is returned.
 */
function toRawIfPossible(addr: string): string | null {
  try {
    return Address.parse(addr).toRawString(); // → 0:…64-hex…
  } catch {
    return null; // malformed address
  }
}
export async function checkMinterTransactions() {
  const minter_wallet_address = config?.ONTON_MINTER_WALLET;
  if (!minter_wallet_address) {
    logger.error("Minter wallet address not set in config!");
    return;
  }
  // 1) Fail all "pending" merges older than 2 minutes 30 seconds
  // => 150 seconds = 150,000 ms
  const twoMinutesThirtySecsAgo = new Date(Date.now() - 150_000); // 2m30s ago
  // Do this instead:
  const updatedRows = await db
    .update(tokenCampaignMergeTransactions)
    .set({ status: "failed" })
    .where(
      and(
        eq(tokenCampaignMergeTransactions.status, "pending"),
        lt(tokenCampaignMergeTransactions.createdAt, twoMinutesThirtySecsAgo)
      )
    )
    .returning({ id: tokenCampaignMergeTransactions.id })
    .execute();

  // updatedRows is an array of { id: number; } objects
  // The rowCount is simply the length of updatedRows
  const rowCount = updatedRows.length;

  if (rowCount > 0) {
    logger.info(`[checkMinterTransactions] Marked ${rowCount} "pending" merges as "failed" (older than 2m30s).`);
  }

  // Determine the range from walletChecks
  const three_hours_ago = Math.floor((Date.now() - 3600 * 1000) / 1000);
  const [existingRow] = await db
    .select({ checked_lt: walletChecks.checked_lt })
    .from(walletChecks)
    .where(eq(walletChecks.wallet_address, minter_wallet_address))
    .execute();

  let start_lt: bigint | null = null;
  if (existingRow?.checked_lt) {
    start_lt = existingRow.checked_lt + BigInt(1);
  }
  // const start_utime = start_lt ? null : three_hours_ago;
  const start_utime = three_hours_ago;

  // 1) Fetch new transactions from the minter wallet
  const transactions = await tonCenter.fetchAllTransactions(minter_wallet_address, start_utime, start_lt);
  if (!transactions?.length) {
    // logger.info(`[MinterCheck] No new transactions for ${minter_wallet_address}`);
    return;
  }

  // 2) Parse merges from in_msg
  const mergesFound = parseMinterMergesFromInMsg(transactions);

  // 3) For each found set of [gold, silver, bronze] indexes
  for (const mergeEvt of mergesFound) {
    const { txHash, userWallet, indexes } = mergeEvt;

    // 3a) Gather items from DB
    const dbRows = await db
      .select({
        nftItem: {
          itemId: tokenCampaignNftItems.itemId,
          nftAddress: tokenCampaignNftItems.nftAddress,
          index: tokenCampaignNftItems.index,
          mergeStatus: tokenCampaignNftItems.mergeStatus,
        },
        collection: {
          id: tokenCampaignNftCollections.id,
          name: tokenCampaignNftCollections.name,
          address: tokenCampaignNftCollections.address,
        },
      })
      .from(tokenCampaignNftItems)
      .innerJoin(tokenCampaignUserSpins, eq(tokenCampaignUserSpins.id, tokenCampaignNftItems.itemId))
      .innerJoin(tokenCampaignNftCollections, eq(tokenCampaignNftCollections.id, tokenCampaignUserSpins.nftCollectionId))
      .where(inArray(tokenCampaignNftItems.index, indexes.map(Number)))
      .execute();

    if (dbRows.length !== 3) {
      logger.warn(
        `[MinterCheck] TX ${txHash} claims indexes [${indexes.join(", ")}], but DB found ${dbRows.length}. Skipping.`
      );
      continue;
    }

    // Must have 1 gold, 1 silver, 1 bronze with mergeStatus="able_to_merge"
    const gold = dbRows.find((r) => r.collection.id === 1 && r.nftItem.mergeStatus === "able_to_merge");
    const silver = dbRows.find((r) => r.collection.id === 2 && r.nftItem.mergeStatus === "able_to_merge");
    const bronze = dbRows.find((r) => r.collection.id === 3 && r.nftItem.mergeStatus === "able_to_merge");

    if (!gold || !silver || !bronze) {
      logger.warn(`[MinterCheck] TX ${txHash} doesn't have a valid gold/silver/bronze set. Skipping.`);
      continue;
    }
    if (!gold.collection?.address || !bronze.collection?.address || !silver.collection?.address) {
      logger.warn(`[MinterCheck]  TX ${txHash} => Missing collection address for gold/silver/bronze. Skipping.`);
      continue;
    }
    try {
      // For each of the three items, fetch on-chain data
      // You likely need each collection's address for the call:
      // e.g. if gold.collection.id === 1 => we might have "SINGLE_COLLECTION_ADDRESS" or "goldCollectionAddress" somewhere.
      // Suppose tokenCampaignNftCollections has an `address` field that stores the collection contract address.
      // If so, do something like:

      const goldChainData = await tonCenter.fetchNFTItemsWithRetry(
        minter_wallet_address,
        gold.collection.address, // or however you store the collection's address
        gold.nftItem.nftAddress.toLowerCase()
      );
      const silverChainData = await tonCenter.fetchNFTItemsWithRetry(
        minter_wallet_address,
        silver.collection.address,
        silver.nftItem.nftAddress.toLowerCase()
      );
      const bronzeChainData = await tonCenter.fetchNFTItemsWithRetry(
        minter_wallet_address,
        bronze.collection.address,
        bronze.nftItem.nftAddress.toLowerCase()
      );

      // If the fetch result is empty or does not include the item, skip
      const goldOnChainItems = goldChainData?.nft_items ?? [];
      const silverOnChainItems = silverChainData?.nft_items ?? [];
      const bronzeOnChainItems = bronzeChainData?.nft_items ?? [];

      if (!goldOnChainItems.length) {
        logger.warn(
          `[MinterCheck] TX ${txHash} => Gold NFT ${gold.nftItem.nftAddress} not found in minter wallet. Skipping.`
        );
        continue;
      }
      if (!silverOnChainItems.length) {
        logger.warn(
          `[MinterCheck] TX ${txHash} => Silver NFT ${silver.nftItem.nftAddress} not found in minter wallet. Skipping.`
        );
        continue;
      }
      if (!bronzeOnChainItems.length) {
        logger.warn(
          `[MinterCheck] TX ${txHash} => Bronze NFT ${bronze.nftItem.nftAddress} not found in minter wallet. Skipping.`
        );
        continue;
      }

      logger.info(`[MinterCheck] TX ${txHash} => Confirmed gold/silver/bronze exist on-chain in minter wallet.`);
    } catch (err) {
      logger.error(`[MinterCheck] TX ${txHash} => On-chain NFT ownership check failed: ${err}`);
      // Optionally skip if the check can't confirm ownership
      continue;
    }
    // 3b) Find the corresponding "pending" row in token_campaign_merge_transactions
    // The user previously inserted a row with status="pending", walletAddress=userWallet,
    // goldNftAddress=gold.nftItem.nftAddress, etc.
    const rawUserWallet = toRawIfPossible(userWallet);
    const walletPredicate =
      rawUserWallet && rawUserWallet !== userWallet
        ? or(
            eq(tokenCampaignMergeTransactions.walletAddress, userWallet), // user-friendly / raw?
            eq(tokenCampaignMergeTransactions.walletAddress, rawUserWallet) // raw form
          )
        : eq(tokenCampaignMergeTransactions.walletAddress, userWallet);
    const [mergeRow] = await db
      .select()
      .from(tokenCampaignMergeTransactions)
      .where(
        and(
          walletPredicate,
          eq(tokenCampaignMergeTransactions.status, "pending"),
          eq(tokenCampaignMergeTransactions.goldNftAddress, gold.nftItem.nftAddress),
          eq(tokenCampaignMergeTransactions.silverNftAddress, silver.nftItem.nftAddress),
          eq(tokenCampaignMergeTransactions.bronzeNftAddress, bronze.nftItem.nftAddress)
        )
      )
      .execute();

    if (!mergeRow) {
      logger.warn(
        `[MinterCheck] TX ${txHash} found merges for wallet=${userWallet}, but no 'pending' row in token_campaign_merge_transactions. Possibly user never called addMergeTransaction? Skipping.`
      );
      continue;
    }

    // 4) Use a single transaction to:
    //    A) set items => "merging"
    //    B) update token_campaign_merge_transactions => status="completed", transactionHash= txHash
    await db.transaction(async (tx) => {
      // A) Update items => merging
      await tx
        .update(tokenCampaignNftItems)
        .set({ mergeStatus: "merging" })
        .where(
          inArray(tokenCampaignNftItems.nftAddress, [
            gold.nftItem.nftAddress,
            silver.nftItem.nftAddress,
            bronze.nftItem.nftAddress,
          ])
        )
        .execute();

      // B) Mark row => status="completed", transactionHash= txHash
      await tx
        .update(tokenCampaignMergeTransactions)
        .set({
          status: "completed",
          transactionHash: txHash,
          updatedAt: new Date(),
        })
        .where(eq(tokenCampaignMergeTransactions.id, mergeRow.id))
        .execute();
    });

    logger.info(
      `[MinterCheck] TX ${txHash}: merges G=${gold.nftItem.index}, S=${silver.nftItem.index}, B=${bronze.nftItem.index} => items=merging, rowId=${mergeRow.id}=completed.`
    );
  }

  // 5) Update walletChecks last_lt
  const last_lt = BigInt(transactions[transactions.length - 1].lt);
  if (start_lt) {
    await db
      .update(walletChecks)
      .set({ checked_lt: last_lt })
      .where(eq(walletChecks.wallet_address, minter_wallet_address))
      .execute();
  } else {
    await db.insert(walletChecks).values({ wallet_address: minter_wallet_address, checked_lt: last_lt }).execute();
  }

  logger.info(`[MinterCheck] Completed merges for ${minter_wallet_address}`);
}

/**
 * parseMinterMergesFromInMsg:
 *  - Looks at each transaction's in_msg
 *  - Checks if `decoded.comment` has "user=..." and "indexes=[x,y,z]"
 *  - Returns an array of { txHash, userWallet, indexes[] }
 */
function parseMinterMergesFromInMsg(transactions: any[]) {
  const merges: Array<{
    txHash: string;
    userWallet: string;
    indexes: number[];
  }> = [];

  for (const tx of transactions) {
    const inMsg = tx.in_msg;
    if (!inMsg) continue;

    const comment = inMsg?.message_content?.decoded?.comment || "";
    logger.log(`[MinterCheck] TX ${tx.hash} comment: ${comment}`);

    if (!comment.includes("user=") || !comment.includes("indexes=[")) {
      logger.log(`[MinterCheck] TX ${tx.hash} doesn't have user= or indexes=`);
      continue;
    }

    // parse user
    const userMatch = comment.match(/user=([^&\s]+)/);
    const userWallet = userMatch ? userMatch[1] : "unknown_user";

    // parse indexes
    const indexesMatch = comment.match(/indexes=\[([\s\S]*?)]/);
    if (!indexesMatch || !indexesMatch[1]) {
      logger.warn(`[MinterCheck] TX ${tx.hash} => invalid indexes format in comment: ${comment}`);
      continue;
    }

    const indexesStr = indexesMatch[1];
    const indexArr = indexesStr.split(",").map((s: string) => parseInt(s.trim(), 10));
    if (indexArr.length !== 3) {
      logger.warn(`[MinterCheck] TX ${tx.hash} => has ${indexArr.length} indexes, expected 3. Skipping.`);
      continue;
    }

    merges.push({
      txHash: tx.hash,
      userWallet,
      indexes: indexArr,
    });
  }

  return merges;
}
