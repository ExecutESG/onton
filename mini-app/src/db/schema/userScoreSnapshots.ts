import { pgTable, serial, bigint, timestamp, decimal, uniqueIndex, index, varchar } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { users } from "@/db/schema";
import { claimStatusEnum } from "../enum";

/* -------------------------------------------------------------------------- */
/*  Per-user score snapshot (aggregated)                                      */
/* -------------------------------------------------------------------------- *
 *  ‣ One row per user *per runtime*                                          *
 *  ‣ Column for every activity-type total                                    *
 *  ‣ `totalScore` = Σ of all activity columns                                *
 * -------------------------------------------------------------------------- */

export const userScoreSnapshots = pgTable(
  "user_score_snapshot",
  {
    /* identifiers */
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.user_id),
    snapshotRuntime: timestamp("snapshot_runtime", { withTimezone: true }).notNull(),

    /* activity subtotals (default 0) */
    freeOnlineEvent: decimal("free_online_event", { precision: 20, scale: 6 }).default("0"),
    freeOfflineEvent: decimal("free_offline_event", { precision: 20, scale: 6 }).default("0"),
    paidOnlineEvent: decimal("paid_online_event", { precision: 20, scale: 6 }).default("0"),
    paidOfflineEvent: decimal("paid_offline_event", { precision: 20, scale: 6 }).default("0"),
    joinOnton: decimal("join_onton", { precision: 20, scale: 6 }).default("0"),
    joinOntonAffiliate: decimal("join_onton_affiliate", { precision: 20, scale: 6 }).default("0"),
    freePlay2Win: decimal("free_play2win", { precision: 20, scale: 6 }).default("0"),
    paidPlay2Win: decimal("paid_play2win", { precision: 20, scale: 6 }).default("0"),
    claimStatus: claimStatusEnum("claim_status").default("not_claimed").notNull(),
    /* grand total (redundant but quick-to-query) */
    totalScore: decimal("total_score", { precision: 20, scale: 6 }).notNull(),
  },
  (t) => ({
    userRuntimeUnique: uniqueIndex("user_score_snapshot_user_runtime_idx").on(t.userId, t.snapshotRuntime),
    userIdIndex: index("user_score_snapshot_user_id_idx").on(t.userId),
    runtimeIndex: index("user_score_snapshot_runtime_idx").on(t.snapshotRuntime),
  })
);

export type UserScoreSnapshotRow = InferSelectModel<typeof userScoreSnapshots>;
export type UserScoreSnapshotInsert = Omit<UserScoreSnapshotRow, "id">;
