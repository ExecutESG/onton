import { db } from "@/db/db";
import {
  tokenCampaignClaimOnion,
  TokenCampaignClaimOnionInsert,
  TokenCampaignClaimOnionRow,
} from "@/db/schema/tokenCampaignClaimOnion";
import { eq, desc, sql, and, ne } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

/* -------------------------------------------------------------------------- */
/*  WRITE helpers                                                             */
/* -------------------------------------------------------------------------- */

export const createClaim = async (
  claim: TokenCampaignClaimOnionInsert & { txHash?: string }
): Promise<TokenCampaignClaimOnionRow> => {
  const [row] = await db
    .insert(tokenCampaignClaimOnion)
    .values({ ...claim, txHash: claim.txHash ?? null })
    .returning()
    .execute();

  logger.info(`ONION claim inserted for wallet ${row.walletAddress}, user ${row.userId}`);
  return row;
};

/* -------------------------------------------------------------------------- */
/*  READ helpers                                                              */
/* -------------------------------------------------------------------------- */

export const walletAlreadyClaimed = async (walletAddress: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: tokenCampaignClaimOnion.id })
    .from(tokenCampaignClaimOnion)
    .where(eq(tokenCampaignClaimOnion.walletAddress, walletAddress))
    .limit(1)
    .execute();

  return !!row;
};
/**
 * Returns true when someone *other* than `userId` has already
 * claimed something with this `walletAddress`.
 */
export const walletAlreadyClaimedByOtherUser = async (walletAddress: string, userId: number): Promise<boolean> => {
  const [row] = await db
    .select({ id: tokenCampaignClaimOnion.id })
    .from(tokenCampaignClaimOnion)
    .where(and(eq(tokenCampaignClaimOnion.walletAddress, walletAddress), ne(tokenCampaignClaimOnion.userId, userId)))
    .limit(1)
    .execute();

  return !!row;
};

export const fetchClaimsByUser = async (userId: number): Promise<TokenCampaignClaimOnionRow[]> =>
  db
    .select()
    .from(tokenCampaignClaimOnion)
    .where(eq(tokenCampaignClaimOnion.userId, userId))
    .orderBy(desc(tokenCampaignClaimOnion.createdAt))
    .execute();

export const fetchClaimByWallet = async (walletAddress: string): Promise<TokenCampaignClaimOnionRow | null> =>
  (
    await db
      .select()
      .from(tokenCampaignClaimOnion)
      .where(eq(tokenCampaignClaimOnion.walletAddress, walletAddress))
      .limit(1)
      .execute()
  ).pop() ?? null;

/* -------------------------------------------------------------------------- */
/*  Aggregate helper                                                          */
/* -------------------------------------------------------------------------- */

/** COALESCE (SUM(total_onions), 0) aliased as "total" */
const totalSum = sql<number>`
  coalesce(sum(${tokenCampaignClaimOnion.totalOnions}), 0)
`.as("total");

export const totalOnionsClaimedByUser = async (userId: number): Promise<number> => {
  const [row] = await db
    .select({ total: totalSum })
    .from(tokenCampaignClaimOnion)
    .where(eq(tokenCampaignClaimOnion.userId, userId))
    .execute();

  return row?.total ?? 0;
};

/* -------------------------------------------------------------------------- */
/*  Module export                                                             */
/* -------------------------------------------------------------------------- */

const tokenCampaignClaimOnionDB = {
  createClaim,
  walletAlreadyClaimed,
  fetchClaimsByUser,
  fetchClaimByWallet,
  totalOnionsClaimedByUser,
  walletAlreadyClaimedByOtherUser,
};

export default tokenCampaignClaimOnionDB;
