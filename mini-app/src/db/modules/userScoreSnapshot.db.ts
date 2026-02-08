import { db } from "@/db/db";
import { userScoreSnapshots, UserScoreSnapshotInsert, UserScoreSnapshotRow } from "@/db/schema/userScoreSnapshots";
import { eq, desc, and } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*  WRITE helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Bulk-insert snapshot rows; ignore duplicates; return # inserted. */
export const insertUserScoreSnapshots = async (rows: UserScoreSnapshotInsert[]): Promise<number> => {
  if (!rows.length) return 0;

  const inserted = await db
    .insert(userScoreSnapshots)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: userScoreSnapshots.id })
    .execute();

  return inserted.length;
};

/* -------------------------------------------------------------------------- */
/*  READ helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Get the snapshot for (user, runtime) if it exists. */
export const fetchSnapshotByUserAndRuntime = async (userId: number, runtime: Date): Promise<UserScoreSnapshotRow | null> =>
  (
    await db
      .select()
      .from(userScoreSnapshots)
      .where(and(eq(userScoreSnapshots.userId, userId), eq(userScoreSnapshots.snapshotRuntime, runtime)))
      .execute()
  ).pop() ?? null;

/** Most-recent snapshot available for a user. */
export const fetchLatestSnapshotForUser = async (userId: number): Promise<UserScoreSnapshotRow | null> =>
  (
    await db
      .select()
      .from(userScoreSnapshots)
      .where(eq(userScoreSnapshots.userId, userId))
      .orderBy(desc(userScoreSnapshots.snapshotRuntime))
      .limit(1)
      .execute()
  ).pop() ?? null;

/* -------------------------------------------------------------------------- */
/*  Module export                                                             */
/* -------------------------------------------------------------------------- */

const userScoreSnapshotDB = {
  insertUserScoreSnapshots,
  fetchSnapshotByUserAndRuntime,
  fetchLatestSnapshotForUser,
};

export default userScoreSnapshotDB;
