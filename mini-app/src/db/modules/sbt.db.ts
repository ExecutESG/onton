import { db } from "@/db/db";
import { sbtCollections, SbtCollectionInsert, SbtCollectionRow, SbtCollectionUpdate } from "@/db/schema/sbtCollections";
import { sbtItems, SbtItemInsert, SbtItemRow, SbtItemUpdate } from "@/db/schema/sbtItems";
import { and, desc, eq, sql } from "drizzle-orm";

let tablesEnsured = false;

export async function ensureSbtTables(): Promise<void> {
  if (tablesEnsured) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "public"."sbt_collections" (
        "id" serial PRIMARY KEY NOT NULL,
        "event_uuid" varchar(255) NOT NULL,
        "collection_address" varchar(255) NOT NULL,
        "owner_address" varchar(255) NOT NULL,
        "authority_address" varchar(255) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "image" varchar(500),
        "metadata_url" varchar(500) NOT NULL,
        "common_content_url" varchar(500) DEFAULT '',
        "next_item_index" bigint DEFAULT 0 NOT NULL,
        "total_minted" bigint DEFAULT 0 NOT NULL,
        "status" varchar(50) DEFAULT 'active' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp (3) DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sbt_collections_event_uuid_idx" ON "public"."sbt_collections" USING btree ("event_uuid");
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sbt_collections_address_idx" ON "public"."sbt_collections" USING btree ("collection_address");
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "public"."sbt_items" (
        "id" serial PRIMARY KEY NOT NULL,
        "sbt_collection_id" bigint NOT NULL,
        "item_index" bigint NOT NULL,
        "item_address" varchar(255) NOT NULL,
        "recipient_user_id" bigint,
        "recipient_wallet_address" varchar(255) NOT NULL,
        "metadata_url" varchar(500) NOT NULL,
        "status" varchar(50) DEFAULT 'minted' NOT NULL,
        "transaction_hash" varchar(255),
        "revoked_at" timestamp,
        "metadata" json,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp (3) DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sbt_items_collection_id_idx" ON "public"."sbt_items" USING btree ("sbt_collection_id");
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sbt_items_address_idx" ON "public"."sbt_items" USING btree ("item_address");
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sbt_items_recipient_wallet_idx" ON "public"."sbt_items" USING btree ("recipient_wallet_address");
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sbt_items_recipient_user_idx" ON "public"."sbt_items" USING btree ("recipient_user_id");
    `);

    tablesEnsured = true;
  } catch (err) {
    console.error("ensureSbtTables error:", err);
  }
}

export const sbtDB = {
  // Collection operations
  async findCollectionByEventUuid(eventUuid: string): Promise<SbtCollectionRow | null> {
    await ensureSbtTables();
    const rows = await db
      .select()
      .from(sbtCollections)
      .where(eq(sbtCollections.eventUuid, eventUuid))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findCollectionByAddress(collectionAddress: string): Promise<SbtCollectionRow | null> {
    await ensureSbtTables();
    const rows = await db
      .select()
      .from(sbtCollections)
      .where(eq(sbtCollections.collectionAddress, collectionAddress))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findCollectionById(id: number): Promise<SbtCollectionRow | null> {
    await ensureSbtTables();
    const rows = await db
      .select()
      .from(sbtCollections)
      .where(eq(sbtCollections.id, id))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async insertSbtCollection(data: SbtCollectionInsert): Promise<SbtCollectionRow> {
    await ensureSbtTables();
    const rows = await db
      .insert(sbtCollections)
      .values(data)
      .returning()
      .execute();
    return rows[0];
  },

  async updateSbtCollection(id: number, data: SbtCollectionUpdate): Promise<SbtCollectionRow | null> {
    await ensureSbtTables();
    const rows = await db
      .update(sbtCollections)
      .set(data)
      .where(eq(sbtCollections.id, id))
      .returning()
      .execute();
    return rows[0] || null;
  },

  async incrementCollectionIndex(id: number): Promise<SbtCollectionRow | null> {
    await ensureSbtTables();
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
    await ensureSbtTables();
    const rows = await db
      .select()
      .from(sbtItems)
      .where(and(eq(sbtItems.sbtCollectionId, collectionId), eq(sbtItems.itemIndex, itemIndex)))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findSbtItemByAddress(itemAddress: string): Promise<SbtItemRow | null> {
    await ensureSbtTables();
    const rows = await db
      .select()
      .from(sbtItems)
      .where(eq(sbtItems.itemAddress, itemAddress))
      .limit(1)
      .execute();
    return rows[0] || null;
  },

  async findUserSbtItems(userId: number): Promise<SbtItemRow[]> {
    await ensureSbtTables();
    return db
      .select()
      .from(sbtItems)
      .where(eq(sbtItems.recipientUserId, userId))
      .orderBy(desc(sbtItems.createdAt))
      .execute();
  },

  async findWalletSbtItems(walletAddress: string): Promise<SbtItemRow[]> {
    await ensureSbtTables();
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
    await ensureSbtTables();
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
