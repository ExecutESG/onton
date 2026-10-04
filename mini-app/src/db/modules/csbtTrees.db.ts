import { db } from "@/db/db";
import { csbtTrees, CsbtTreeRow, CsbtTreeInsert } from "@/db/schema/csbtTrees";
import { events } from "@/db/schema/events";
import { and, eq, isNull, lte, sql } from "drizzle-orm";

export const csbtTreesDB = {
  /**
   * Retrieves a specific cSBT tree by event UUID and kind ('native' | 'legacy').
   */
  async getCsbtTree(eventUuid: string, kind: "native" | "legacy"): Promise<CsbtTreeRow | null> {
    const rows = await db
      .select()
      .from(csbtTrees)
      .where(and(eq(csbtTrees.eventUuid, eventUuid), eq(csbtTrees.kind, kind)))
      .limit(1);
    return rows[0] || null;
  },

  /**
   * Retrieves the authoritative frozen tree for an event (prefers native over legacy).
   */
  async getCsbtTreeByEvent(eventUuid: string): Promise<CsbtTreeRow | null> {
    const rows = await db
      .select()
      .from(csbtTrees)
      .where(eq(csbtTrees.eventUuid, eventUuid))
      .orderBy(sql`CASE WHEN ${csbtTrees.kind} = 'native' THEN 1 ELSE 2 END`)
      .limit(1);
    return rows[0] || null;
  },

  /**
   * Inserts a frozen cSBT tree record. Idempotent on conflict.
   */
  async insertCsbtTree(data: CsbtTreeInsert): Promise<CsbtTreeRow> {
    const rows = await db
      .insert(csbtTrees)
      .values(data)
      .onConflictDoNothing({
        target: [csbtTrees.eventUuid, csbtTrees.kind],
      })
      .returning();

    if (rows.length > 0) {
      return rows[0];
    }

    const existing = await this.getCsbtTree(data.eventUuid, data.kind);
    return existing!;
  },

  /**
   * Retrieves all frozen cSBT trees that have not yet been anchored on-chain.
   */
  async getUnanchoredTrees(limit = 50): Promise<CsbtTreeRow[]> {
    return await db
      .select()
      .from(csbtTrees)
      .where(isNull(csbtTrees.anchoredAt))
      .orderBy(csbtTrees.id)
      .limit(limit);
  },

  /**
   * Records successful on-chain anchoring of a tree.
   */
  async markTreeAnchored(id: number, anchorTxHash: string): Promise<void> {
    await db
      .update(csbtTrees)
      .set({
        anchorTxHash,
        anchoredAt: new Date(),
      })
      .where(eq(csbtTrees.id, id));
  },

  /**
   * Finds events ended more than 24h ago with no native cSBT tree.
   * Note: events.end_date is stored as unix timestamp in seconds.
   */
  async getEndedEventsWithoutNativeTree(cutoffTimestampSec: number, limit = 50) {
    return await db
      .select({
        eventUuid: events.event_uuid,
        title: events.title,
        endDate: events.end_date,
      })
      .from(events)
      .where(
        and(
          lte(events.end_date, cutoffTimestampSec),
          sql`NOT EXISTS (
            SELECT 1 FROM ${csbtTrees}
            WHERE ${csbtTrees.eventUuid} = ${events.event_uuid}
              AND ${csbtTrees.kind} = 'native'
          )`
        )
      )
      .limit(limit);
  },
};

export default csbtTreesDB;
