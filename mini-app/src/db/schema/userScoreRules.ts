import { pgTable, bigserial, bigint, decimal, boolean, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { users, userScoreItem } from "@/db/schema";
import { usersScoreActivity } from "./usersScore";
import { InferSelectModel } from "drizzle-orm";

/* ── ENUMS   ───────────────────────── */

export const scoreRuleRole = pgEnum("score_rule_role", ["organizer", "user"] as const);

/* ── TABLE ─────────────────────────────────────────────────── */

export const userScoreRules = pgTable(
  "user_score_rules",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),

    /* NULL  ➜  rule applies to **everyone**                   */
    subjectUserId: bigint("subject_user_id", { mode: "number" }).references(() => users.user_id),

    subjectRole: scoreRuleRole("subject_role"), // optional hint

    /* Same two enums you already use in users_score           */
    activityType: usersScoreActivity("activity_type").notNull(),
    itemType: userScoreItem("item_type").notNull(),

    /* NULL  ➜  applies to every item of that type             */
    itemId: bigint("item_id", { mode: "number" }),

    point: decimal("point", { precision: 20, scale: 6 }).notNull(),
    priority: bigint("priority", { mode: "number" }).default(0),

    effectiveFrom: timestamp("effective_from", { precision: 6 }),
    effectiveTo: timestamp("effective_to", { precision: 6 }),
    active: boolean("active").default(true),

    createdAt: timestamp("created_at", { precision: 6 }).defaultNow(),
  },
  (t) => ({
    /* Covers user-specific and global rows alike              */
    idxForMatch: index("usr_score_rules_match_idx").on(t.activityType, t.itemType, t.itemId, t.subjectUserId),
  })
);

export type UserScoreRuleRow = InferSelectModel<typeof userScoreRules>;

export type UserScoreRuleRoleType = (typeof scoreRuleRole.enumValues)[number];
