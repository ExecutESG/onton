import axios from "axios";
import tonCenter from "@/services/tonCenter";
import snapshotCollectionsDB from "@/db/modules/snapshotCollections.db";
import userScoreSnapshotDB from "@/db/modules/userScoreSnapshot.db";

import { SnapshotCollectionInsert } from "@/db/schema/snapshotCollections";
import { usersScore } from "@/db/schema/usersScore";

import { db } from "@/db/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import { UserScoreSnapshotInsert } from "@/db/schema/userScoreSnapshots";
import { ONION_RAW_COLLECTION_ADDRESS } from "@/constants";

/* -------------------------------------------------------------------------- */
/*  Constants & helpers                                                       */
/* -------------------------------------------------------------------------- */

const pageSize = 100;
const ipfsGateway = "https://ipfs.io/ipfs/";
const maxConcurrency = 10; // balance / metadata fetches in parallel

const normaliseIpfsUri = (uri: string): string =>
  uri.startsWith("ipfs://") ? `${ipfsGateway}${uri.replace("ipfs://", "")}` : uri;

const fetchMetadataJson = async (uri: string): Promise<string> => {
  if (!uri) return "{}";
  try {
    const url = normaliseIpfsUri(uri);
    const resp = await axios.get(url, { timeout: 10_000 });
    return JSON.stringify(resp.data);
  } catch (err) {
    logger.warn(`Metadata fetch failed for ${uri}: ${err}`);
    return "{}";
  }
};

/* -------------------------------------------------------------------------- */
/*  MAIN CRON TASK                                                            */
/* -------------------------------------------------------------------------- */

export const runCollectionSnapshot = async (collectionAddress = ONION_RAW_COLLECTION_ADDRESS): Promise<void> => {
  const runtime = new Date();

  /* =========================================================
     1. QUICK SCAN  →  collect (nft, owner, uri, index)
  ========================================================= */
  type ProtoRow = {
    nftAddress: string;
    ownerAddress: string;
    nftIndex: number;
    uri: string;
  };

  const protoRows: ProtoRow[] = [];
  let offset = 0;

  while (true) {
    const page = await tonCenter.fetchNFTItemsWithRetry(
      "", // ownerAddress → “all”
      collectionAddress,
      "",
      -1,
      pageSize,
      offset
    );
    if (!page?.nft_items?.length) break;

    for (const item of page.nft_items) {
      protoRows.push({
        nftAddress: item.address,
        ownerAddress: item.owner_address,
        nftIndex: Number(item.index),
        uri: item.content?.uri ?? "",
      });
    }
    offset += pageSize;
  }

  if (!protoRows.length) {
    logger.warn(`Snapshot job: collection ${collectionAddress} returned zero items`);
    return;
  }

  /* =========================================================
     2. BALANCE + METADATA  (batched, cached per owner)
  ========================================================= */
  const ownerBalanceCache = new Map<string, number>();
  const nftRows: SnapshotCollectionInsert[] = [];
  let cursor = 0;

  while (cursor < protoRows.length) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const slice = protoRows.slice(cursor, cursor + maxConcurrency);
    cursor += maxConcurrency;

    const promises = slice.map(async (p): Promise<SnapshotCollectionInsert> => {
      /* balance */
      let balance = ownerBalanceCache.get(p.ownerAddress);
      if (balance === undefined) {
        balance = await tonCenter.getAccountBalance(p.ownerAddress).catch(() => 0);
        ownerBalanceCache.set(p.ownerAddress, balance);
      }

      /* metadata */
      const meta = await fetchMetadataJson(p.uri);

      return {
        snapshotRuntime: runtime,
        collectionAddress,
        nftAddress: p.nftAddress,
        ownerAddress: p.ownerAddress,
        nftIndex: p.nftIndex,
        claimStatus: "not_claimed", // default value, not used in this snapshot
        ownerBalance: balance.toString(), // Drizzle numeric as string
        metadata: meta,
      };
    });

    nftRows.push(...(await Promise.all(promises)));
  }

  /* =========================================================
     3. PERSIST NFT snapshot rows
  ========================================================= */
  const nftInserted = await snapshotCollectionsDB.insertSnapshotRows(nftRows);
  logger.info(
    `NFT Snapshot: ${nftInserted}/${nftRows.length} rows stored for ${collectionAddress} @ ${runtime.toISOString()}`
  );

  /* ----------------------------------------------------------
   4.  Aggregate users_score → one row per user
---------------------------------------------------------- */

  type PgRow = {
    user_id: number;
    total_score: string;
    free_online_event: string | null;
    free_offline_event: string | null;
    paid_online_event: string | null;
    paid_offline_event: string | null;
    join_onton: string | null;
    join_onton_affiliate: string | null;
    free_play2win: string | null;
    paid_play2win: string | null;
  };

  /*  Build eight separate fragments … *once*. */
  const sums = {
    free_online_event:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'free_online_event'    THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "free_online_event"
      ),
    free_offline_event:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'free_offline_event'   THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "free_offline_event"
      ),
    paid_online_event:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'paid_online_event'    THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "paid_online_event"
      ),
    paid_offline_event:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'paid_offline_event'   THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "paid_offline_event"
      ),
    join_onton:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'join_onton'           THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "join_onton"
      ),
    join_onton_affiliate:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'join_onton_affiliate' THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "join_onton_affiliate"
      ),
    free_play2win:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'free_play2win'        THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "free_play2win"
      ),
    paid_play2win:
      sql<string>`SUM(CASE WHEN ${usersScore.activityType} = 'paid_play2win'        THEN ${usersScore.point}::numeric ELSE 0 END)`.as(
        "paid_play2win"
      ),
  };

  const total_score = sql<string>`SUM(${usersScore.point}::numeric)`.as("total_score");

  /*  Drizzle query — note object keys *differ* from SQL aliases  */
  const aggregated: PgRow[] = await db
    .select({
      user_id: usersScore.userId,
      ...sums,
      total_score,
    })
    .from(usersScore)
    .where(eq(usersScore.active, true))
    .groupBy(usersScore.userId)
    .execute();

  /* ----------------------------------------------------------
     5.  Map PG row → snapshot row (camel-case keys)
  ---------------------------------------------------------- */
  const scoreRows: UserScoreSnapshotInsert[] = aggregated.map((r) => ({
    userId: r.user_id,
    snapshotRuntime: runtime,
    totalScore: r.total_score ?? "0",
    claimStatus: "not_claimed", // default value, not used in this snapshot
    freeOnlineEvent: r.free_online_event ?? "0",
    freeOfflineEvent: r.free_offline_event ?? "0",
    paidOnlineEvent: r.paid_online_event ?? "0",
    paidOfflineEvent: r.paid_offline_event ?? "0",
    joinOnton: r.join_onton ?? "0",
    joinOntonAffiliate: r.join_onton_affiliate ?? "0",
    freePlay2Win: r.free_play2win ?? "0",
    paidPlay2Win: r.paid_play2win ?? "0",
  }));

  /* ----------------------------------------------------------
     6.  Bulk-insert in safe chunks
  ---------------------------------------------------------- */
  const chunk = 1000;
  let insertedTotal = 0;

  for (let i = 0; i < scoreRows.length; i += chunk) {
    const slice = scoreRows.slice(i, i + chunk);
    insertedTotal += await userScoreSnapshotDB.insertUserScoreSnapshots(slice);
  }

  logger.info(`User-score Snapshot: ${insertedTotal}/${scoreRows.length} rows stored @ ${runtime.toISOString()}`);

  return;
};

export default runCollectionSnapshot;
