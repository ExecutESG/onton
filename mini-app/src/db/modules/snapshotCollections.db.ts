import { db } from "@/db/db";
import { snapshotCollections, SnapshotCollectionInsert, SnapshotCollectionRow } from "@/db/schema/snapshotCollections";
import { asc, eq } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*  Write helpers (pure SQL - no service logic)                               */
/* -------------------------------------------------------------------------- */

/** Bulk-insert snapshot rows. Returns number actually written. */
export const insertSnapshotRows = async (rows: SnapshotCollectionInsert[]): Promise<number> => {
  if (!rows.length) return 0;

  // Ask Postgres to return the primary-key of rows that *did* get inserted
  const inserted = await db
    .insert(snapshotCollections)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: snapshotCollections.id }) //  <<< returning something lightweight
    .execute();

  // `inserted` is an array; its length == rows actually written
  return inserted.length;
};

/* -------------------------------------------------------------------------- */
/*  Read helpers                                                              */
/* -------------------------------------------------------------------------- */

export const fetchSnapshotsForCollection = async (collectionAddress: string): Promise<SnapshotCollectionRow[]> =>
  db
    .select()
    .from(snapshotCollections)
    .where(eq(snapshotCollections.collectionAddress, collectionAddress))
    .orderBy(asc(snapshotCollections.snapshotRuntime), asc(snapshotCollections.nftIndex))
    .execute();

/* -------------------------------------------------------------------------- */
/*  Module export                                                             */
/* -------------------------------------------------------------------------- */

const snapshotCollectionsDB = {
  insertSnapshotRows,
  fetchSnapshotsForCollection,
};

export default snapshotCollectionsDB;
