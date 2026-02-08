import { db } from "@/db/db";
import { and, eq, ilike, sql } from "drizzle-orm";
import { tokenCampaignClaimOnion, TokenCampaignClaimOnionInsert } from "@/db/schema/tokenCampaignClaimOnion";
import { snapshotCollections } from "@/db/schema/snapshotCollections";
import { userScoreSnapshots } from "@/db/schema/userScoreSnapshots";
import { POINTS_PER_ONION, NFT_POINTS, SNAPSHOT_DATE } from "@/constants";
import { ClaimStatusEnum } from "@/db/enum";
import { logger } from "@/server/utils/logger";

export type WalletSummary = {
  walletAddress: string;
  isPrimary: boolean;
  claimStatus: ClaimStatusEnum;
  nft: {
    counts: { platinum: number; gold: number; silver: number; bronze: number };
    onions: { platinum: number; gold: number; silver: number; bronze: number };
    totalOnions: number;
  };
  totalScore: number; // only for primary wallets
  scoreOnions: number; // ONIONs from user-score (primary only)
  totalOnions: number; // nft.totalOnions + scoreOnions
  partnershipOnions?: number; // ONIONs from partnership (if any)
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const jsonColorExpr = sql<string>`
  (
    SELECT (a->>'value')
    FROM jsonb_path_query_first(
             ${snapshotCollections.metadata}::jsonb,
             '$.attributes[*] ? (@.trait_type == "color")'
         ) AS a
  )
`.as("clr");

async function nftCounts(wallet: string) {
  const rows = await db
    .select({ clr: jsonColorExpr, cnt: sql<number>`count(*)` })
    .from(snapshotCollections)
    .where(
      and(
        ilike(snapshotCollections.ownerAddress, wallet),
        eq(snapshotCollections.snapshotRuntime, SNAPSHOT_DATE),
        eq(snapshotCollections.claimStatus, "not_claimed")
      )
    )
    .groupBy(jsonColorExpr)
    .execute();
  logger.log(`NFT counts for ${wallet}:`, rows);
  const base = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  logger.log(`NFT counts  base for ${wallet}:`, base);
  for (const r of rows) {
    const key = (r.clr || "").toLowerCase() as keyof typeof base;
    if (key in base) base[key] = Number(r.cnt);
  }
  return base;
}
async function unclaimedScoreOnions(userId: number): Promise<{ points: number; onionOnPoints: number }> {
  const [row] = await db
    .select({ val: userScoreSnapshots.totalScore })
    .from(userScoreSnapshots)
    .where(
      and(
        eq(userScoreSnapshots.userId, userId),
        eq(userScoreSnapshots.snapshotRuntime, SNAPSHOT_DATE),
        eq(userScoreSnapshots.claimStatus, "not_claimed")
      )
    )
    .limit(1)
    .execute();

  const pts = Number(row?.val ?? 0);
  return { points: pts, onionOnPoints: pts * POINTS_PER_ONION } as const;
}

/* -------------------------------------------------------------------------- */
/* Main builder                                                               */
/* -------------------------------------------------------------------------- */
export async function buildClaimOverview(userId: number, connectedWallet: string): Promise<WalletSummary[]> {
  /* 1️⃣  Previously-claimed wallets ------------------------------------- */
  const previous = await db
    .select()
    .from(tokenCampaignClaimOnion)
    .where(eq(tokenCampaignClaimOnion.userId, userId))
    .orderBy(tokenCampaignClaimOnion.createdAt) // oldest → newest
    .execute();
  logger.log(`ONION_CLAIM: Build claimOverview: ${previous} for user ${userId}`);
  const hasPrimary = previous.some((r) => r.walletType === "primary");

  logger.log(`ONION_CLAIM: Has primary wallet: ${hasPrimary} for user ${userId}`);
  const walletAlreadyClaimed = previous.find((r) => r.walletAddress === connectedWallet);
  logger.log(
    `ONION_CLAIM: Wallet ${connectedWallet} already claimed: ${walletAlreadyClaimed ? "yes" : "no"}  for user ${userId}`
  );
  /* 2️⃣  Convert them into WalletSummary objects ------------------------ */
  const summaries: WalletSummary[] = previous.map((r) => ({
    walletAddress: r.walletAddress,
    isPrimary: r.walletType === "primary",
    claimStatus: "claimed",

    nft: {
      counts: {
        platinum: Number(r.platinumNftCount),
        gold: Number(r.goldNftCount),
        silver: Number(r.silverNftCount),
        bronze: Number(r.bronzeNftCount),
      },
      onions: {
        platinum: Number(r.onionsFromPlatinum),
        gold: Number(r.onionsFromGold),
        silver: Number(r.onionsFromSilver),
        bronze: Number(r.onionsFromBronze),
      },
      totalOnions:
        Number(r.onionsFromPlatinum) +
        Number(r.onionsFromGold) +
        Number(r.onionsFromSilver) +
        Number(r.onionsFromBronze) +
        Number(r.onionsFromPartnership),
    },
    totalScore: r.walletType === "primary" ? Number(r.onionsFromScore) * POINTS_PER_ONION : 0,
    partnershipOnions: Number(r.onionsFromPartnership),
    scoreOnions: r.walletType === "primary" ? Number(r.onionsFromScore) : 0,
    totalOnions: Number(r.totalOnions),
  }));
  logger.log(`ONION_CLAIM: Build claimOverview: ${previous}  for user ${userId} => summaries:`, summaries);
  /* 3️⃣  Connected wallet – if not claimed yet, compute live ------------ */
  if (!walletAlreadyClaimed) {
    const counts = await nftCounts(connectedWallet);
    logger.log(`ONION_CLAIM: NFT counts for ${connectedWallet}:`, counts);
    const onionsPerTier = {
      platinum: counts.platinum * NFT_POINTS.platinum,
      gold: counts.gold * NFT_POINTS.gold,
      silver: counts.silver * NFT_POINTS.silver,
      bronze: counts.bronze * NFT_POINTS.bronze,
    };
    const nftTotal = Object.values(onionsPerTier).reduce((a, b) => a + b, 0);
    const scoreOnion = hasPrimary
      ? {
          points: 0,
          onionOnPoints: 0,
        }
      : await unclaimedScoreOnions(userId);
    logger.log(`ONION_CLAIM: NFT counts  for user ${userId}  for ${connectedWallet}:`, scoreOnion);
    summaries.push({
      walletAddress: connectedWallet,
      isPrimary: !hasPrimary,
      claimStatus: "not_claimed",

      nft: {
        counts,
        onions: onionsPerTier,
        totalOnions: nftTotal,
      },
      totalScore: scoreOnion.points,
      scoreOnions: scoreOnion.onionOnPoints,
      totalOnions: nftTotal + scoreOnion.onionOnPoints,
    });
  }
  logger.log(`ONION_CLAIM: Build claimOverview: ${previous}  for user ${userId}` + ` => summaries:`, summaries);
  logger.log(
    `ONION_CLAIM: Build claimOverview: ${previous}  for user ${userId}` + ` => summaries.length:`,
    summaries.length,
    [...summaries.filter((w) => w.isPrimary), ...summaries.filter((w) => !w.isPrimary)]
  );
  /* 4️⃣  Sort: primary first, then others ------------------------------- */
  return [...summaries.filter((w) => w.isPrimary), ...summaries.filter((w) => !w.isPrimary)];
}

/* ——— mark rows claimed ——————————————————————————— */

export const markScoreRowsClaimedTx = async (tx: typeof db, userId: number) =>
  tx
    .update(userScoreSnapshots)
    .set({ claimStatus: "claimed" })
    .where(
      and(
        eq(userScoreSnapshots.userId, userId),
        eq(userScoreSnapshots.snapshotRuntime, SNAPSHOT_DATE),
        eq(userScoreSnapshots.claimStatus, "not_claimed")
      )
    )
    .execute();

export const markNftRowsClaimedTx = async (tx: typeof db, wallet: string) =>
  tx
    .update(snapshotCollections)
    .set({ claimStatus: "claimed" })
    .where(
      and(
        eq(snapshotCollections.ownerAddress, wallet),
        eq(snapshotCollections.snapshotRuntime, SNAPSHOT_DATE),
        eq(snapshotCollections.claimStatus, "not_claimed")
      )
    )
    .execute();

/* ——— insert claim row ——————————————————————————— */

export const insertClaimRowTx = async (tx: typeof db, data: TokenCampaignClaimOnionInsert) =>
  tx.insert(tokenCampaignClaimOnion).values(data).returning().execute();
