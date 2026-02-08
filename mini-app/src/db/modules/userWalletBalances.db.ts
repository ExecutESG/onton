import { db } from "@/db/db";
import { PlaceOfWalletConnection, userWalletBalances } from "@/db/schema/userWalletBalances";
import { sql } from "drizzle-orm";

/**
 * Upsert (insert or update) a user's wallet balance entry.
 * We'll use a composite key of (userId, walletAddress, placeOfConnection)
 * when calling onConflictDoUpdate.
 */
export const upsertUserWalletBalance = async (
  userId: number,
  walletAddress: string,
  newBalance: number,
  placeOfConnection: PlaceOfWalletConnection
): Promise<void> => {
  await db
    .insert(userWalletBalances)
    .values({
      userId,
      walletAddress,
      lastBalance: newBalance,
      placeOfConnection,
      // Example for a numeric column storing JS timestamps in ms
      lastCheckedAt: sql`NOW
          ()`,
    })
    .onConflictDoUpdate({
      target: [userWalletBalances.userId, userWalletBalances.walletAddress, userWalletBalances.placeOfConnection],
      set: {
        lastBalance: newBalance,
        lastCheckedAt: sql`NOW
            ()`,
      },
    });
};

export const userWalletBalancesDB = {
  upsertUserWalletBalance,
};
