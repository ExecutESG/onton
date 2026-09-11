import { db } from "@/db/db";
import { sbtCollections, SbtCollectionInsert, SbtCollectionRow, SbtCollectionUpdate } from "@/db/schema/sbtCollections";
import { sbtItems, SbtItemInsert, SbtItemRow, SbtItemUpdate } from "@/db/schema/sbtItems";
import { and, desc, eq, sql } from "drizzle-orm";

export const sbtDB = {
  // Collection operations
  async findCollectionByEventUuid(eventUuid: string): Promise<SbtCollectionRow | null> {
    const rows = await db
      .select()
      .from(sbtCollections)
      .where(eq(sbtCollections.eventUuid, eventUuid))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findCollectionByAddress(collectionAddress: string): Promise<SbtCollectionRow | null> {
    const rows = await db
      .select()
      .from(sbtCollections)
      .where(eq(sbtCollections.collectionAddress, collectionAddress))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findCollectionById(id: number): Promise<SbtCollectionRow | null> {
    const rows = await db
      .select()
      .from(sbtCollections)
      .where(eq(sbtCollections.id, id))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async insertSbtCollection(data: SbtCollectionInsert): Promise<SbtCollectionRow> {
    const rows = await db
      .insert(sbtCollections)
      .values(data)
      .returning()
      .execute();
    return rows[0];
  },

  async updateSbtCollection(id: number, data: SbtCollectionUpdate): Promise<SbtCollectionRow | null> {
    const rows = await db
      .update(sbtCollections)
      .set(data)
      .where(eq(sbtCollections.id, id))
      .returning()
      .execute();
    return rows[0] || null;
  },

  async incrementCollectionIndex(id: number): Promise<SbtCollectionRow | null> {
    const rows = await db
      .update(sbtCollections)
      .set({
        nextItemIndex: sql`${sbtCollections.nextItemIndex} + 1`,
        totalMinted: sql`${sbtCollections.totalMinted} + 1`,
      })
      .where(eq(sbtCollections.id, id))
      .returning()
      .execute();
    return rows[0] || null;
  },

  // Item operations
  async findSbtItemByCollectionAndIndex(collectionId: number, itemIndex: number): Promise<SbtItemRow | null> {
    const rows = await db
      .select()
      .from(sbtItems)
      .where(and(eq(sbtItems.sbtCollectionId, collectionId), eq(sbtItems.itemIndex, itemIndex)))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findSbtItemByAddress(itemAddress: string): Promise<SbtItemRow | null> {
    const rows = await db
      .select()
      .from(sbtItems)
      .where(eq(sbtItems.itemAddress, itemAddress))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findUserSbtItems(userId: number): Promise<SbtItemRow[]> {
    return db
      .select()
      .from(sbtItems)
      .where(eq(sbtItems.recipientUserId, userId))
      .orderBy(desc(sbtItems.createdAt))
      .execute();
  },

  async findWalletSbtItems(walletAddress: string): Promise<SbtItemRow[]> {
    return db
      .select()
      .from(sbtItems)
      .where(eq(sbtItems.recipientWalletAddress, walletAddress))
      .orderBy(desc(sbtItems.createdAt))
      .execute();
  },

  async findUserSbtForEvent(userId: number, eventUuid: string): Promise<SbtItemRow | null> {
    const collection = await this.findCollectionByEventUuid(eventUuid);
    if (!collection) return null;

    const rows = await db
      .select()
      .from(sbtItems)
      .where(and(eq(sbtItems.sbtCollectionId, collection.id), eq(sbtItems.recipientUserId, userId)))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async insertSbtItem(data: SbtItemInsert): Promise<SbtItemRow> {
    const rows = await db
      .insert(sbtItems)
      .values(data)
      .returning()
      .execute();
    return rows[0];
  },

  async updateSbtItemStatus(
    id: number,
    status: string,
    transactionHash?: string,
    revokedAt?: Date
  ): Promise<SbtItemRow | null> {
    const updateData: Partial<SbtItemRow> = { status };
    if (transactionHash) updateData.transactionHash = transactionHash;
    if (revokedAt) updateData.revokedAt = revokedAt;

    const rows = await db
      .update(sbtItems)
      .set(updateData)
      .where(eq(sbtItems.id, id))
      .returning()
      .execute();
    return rows[0] || null;
  },
};

export default sbtDB;
