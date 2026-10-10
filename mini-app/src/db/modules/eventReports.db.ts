import { db } from "@/db/db";
import { eventReports, EventReportInsert, EventReportRow } from "@/db/schema/eventReports";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

let reportsTableEnsured = false;

export async function ensureEventReportsTable(): Promise<void> {
  if (reportsTableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "public"."event_reports" (
        "id" serial PRIMARY KEY NOT NULL,
        "event_uuid" varchar(255) NOT NULL,
        "user_id" bigint NOT NULL,
        "reason" varchar(100) NOT NULL,
        "notes" text DEFAULT '' NOT NULL,
        "status" varchar(50) DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp(3) DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "event_reports_event_user_uq" ON "public"."event_reports" ("event_uuid", "user_id");
      CREATE INDEX IF NOT EXISTS "event_reports_event_uuid_idx" ON "public"."event_reports" ("event_uuid");
      CREATE INDEX IF NOT EXISTS "event_reports_user_id_idx" ON "public"."event_reports" ("user_id");
    `);
    reportsTableEnsured = true;
  } catch (error) {
    logger.error("Error ensuring event_reports table:", error);
  }
}

export const eventReportsDB = {
  /**
   * Insert a new event abuse report.
   */
  async createReport(data: EventReportInsert): Promise<EventReportRow | null> {
    await ensureEventReportsTable();
    try {
      const [inserted] = await db
        .insert(eventReports)
        .values(data)
        .returning()
        .execute();
      return inserted;
    } catch (error) {
      logger.error("eventReportsDB.createReport error:", error);
      return null;
    }
  },

  /**
   * Check if a specific user has already submitted a report for an event.
   */
  async hasUserReported(eventUuid: string, userId: number): Promise<boolean> {
    await ensureEventReportsTable();
    try {
      const existing = await db
        .select({ id: eventReports.id })
        .from(eventReports)
        .where(and(eq(eventReports.event_uuid, eventUuid), eq(eventReports.user_id, userId)))
        .limit(1)
        .execute();
      return existing.length > 0;
    } catch (error) {
      logger.error("eventReportsDB.hasUserReported error:", error);
      return false;
    }
  },

  /**
   * Count distinct reports for an event submitted since a given timestamp.
   */
  async getRecentReportsCount(eventUuid: string, sinceDate: Date): Promise<number> {
    await ensureEventReportsTable();
    try {
      const res = await db
        .select({ count: count() })
        .from(eventReports)
        .where(
          and(
            eq(eventReports.event_uuid, eventUuid),
            gte(eventReports.created_at, sinceDate)
          )
        )
        .execute();
      return Number(res[0]?.count || 0);
    } catch (error) {
      logger.error("eventReportsDB.getRecentReportsCount error:", error);
      return 0;
    }
  },

  /**
   * Update all reports for an event with a resolution status.
   */
  async updateReportStatus(
    eventUuid: string,
    status: "pending" | "delisted" | "dismissed"
  ): Promise<void> {
    await ensureEventReportsTable();
    try {
      await db
        .update(eventReports)
        .set({ status, updated_at: new Date() })
        .where(eq(eventReports.event_uuid, eventUuid))
        .execute();
    } catch (error) {
      logger.error("eventReportsDB.updateReportStatus error:", error);
    }
  },

  /**
   * Fetch all reports for an event.
   */
  async getReportsForEvent(eventUuid: string): Promise<EventReportRow[]> {
    await ensureEventReportsTable();
    try {
      return await db
        .select()
        .from(eventReports)
        .where(eq(eventReports.event_uuid, eventUuid))
        .execute();
    } catch (error) {
      logger.error("eventReportsDB.getReportsForEvent error:", error);
      return [];
    }
  },
};

export default eventReportsDB;
