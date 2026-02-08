// src/db/modules/userScoreRulesDB.ts
// ---------------------------------------------------------------
// CRUD + helper queries for the `user_score_rules` table
// ---------------------------------------------------------------

import { db } from "@/db/db";
import {
  userScoreRules, // ← the table created earlier
  UsersScoreActivityType,
  userScoreItem,
  scoreRuleRole,
} from "@/db/schema";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { logger } from "@/server/utils/logger";

/* ------------------------------------------------------------------ *
 *  3. ── Create
 * ------------------------------------------------------------------ */

export const createUserScoreRule = async (ruleData: {
  subjectUserId?: number | null; // NULL → global rule
  subjectRole?: (typeof scoreRuleRole.enumValues)[number] | null;
  activityType: UsersScoreActivityType;
  itemType: (typeof userScoreItem.enumValues)[number];
  itemId?: number | null; // NULL → blanket rule
  point: number;
  priority?: number;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  active?: boolean;
}) => {
  try {
    const inserted = await db
      .insert(userScoreRules)
      .values({
        subjectUserId: ruleData.subjectUserId ?? null,
        subjectRole: ruleData.subjectRole ?? null,
        activityType: ruleData.activityType,
        itemType: ruleData.itemType,
        itemId: ruleData.itemId ?? null,
        point: ruleData.point.toString(),
        priority: ruleData.priority ?? 0,
        effectiveFrom: ruleData.effectiveFrom ?? null,
        effectiveTo: ruleData.effectiveTo ?? null,
        active: ruleData.active ?? true,
        createdAt: new Date(),
      })
      .returning();

    logger.log("UserScoreRule created:", inserted);
    return inserted;
  } catch (err) {
    logger.error("Error creating UserScoreRule:", err);
    throw err;
  }
};

/* ------------------------------------------------------------------ *
 *  4. ── Toggle active flag
 * ------------------------------------------------------------------ */

export const changeUserScoreRuleStatus = async (id: bigint, newStatus: boolean) => {
  try {
    await db.update(userScoreRules).set({ active: newStatus }).where(eq(userScoreRules.id, id)).execute();

    logger.log(`UserScoreRule ${id} status changed to ${newStatus}`);
  } catch (err) {
    logger.error("Error toggling UserScoreRule status:", err);
    throw err;
  }
};

/* ------------------------------------------------------------------ *
 *  5. ── Update point / priority
 * ------------------------------------------------------------------ */

export const updateUserScoreRule = async (
  id: bigint,
  updates: Partial<{
    point: number;
    priority: number;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  }>
) => {
  try {
    const values: Record<string, unknown> = {};
    if (updates.point !== undefined) values.point = updates.point.toString();
    if (updates.priority !== undefined) values.priority = updates.priority;
    if ("effectiveFrom" in updates) values.effectiveFrom = updates.effectiveFrom;
    if ("effectiveTo" in updates) values.effectiveTo = updates.effectiveTo;

    await db.update(userScoreRules).set(values).where(eq(userScoreRules.id, id)).execute();
    logger.log(`UserScoreRule ${id} updated`, updates);
  } catch (err) {
    logger.error("Error updating UserScoreRule:", err);
    throw err;
  }
};

/* ------------------------------------------------------------------ *
 *  6. ── Find the best-matching rule for an award
 *       (implements the ordering recommended in the schema answer)
 * ------------------------------------------------------------------ */

export type MatchParams = {
  subjectUserId?: number | null; // Nullable → allow global
  activityType: UsersScoreActivityType;
  itemType: (typeof userScoreItem.enumValues)[number];
  itemId?: number | null; // Nullable → no item context
  at?: Date; // default now()
};

export const getMatchingUserScoreRule = async (params: MatchParams) => {
  const { subjectUserId, activityType, itemType, itemId, at = new Date() } = params;

  // 2) Build query
  const rule =
    (
      await db
        .select()
        .from(userScoreRules)
        .where(
          and(
            eq(userScoreRules.activityType, activityType),
            eq(userScoreRules.itemType, itemType),
            // user-specific OR global
            or(isNull(userScoreRules.subjectUserId), eq(userScoreRules.subjectUserId, subjectUserId ?? -1)),
            // item-specific OR blanket
            or(isNull(userScoreRules.itemId), eq(userScoreRules.itemId, itemId ?? -1)),
            eq(userScoreRules.active, true),
            or(isNull(userScoreRules.effectiveFrom), lte(userScoreRules.effectiveFrom, at)),
            or(isNull(userScoreRules.effectiveTo), gte(userScoreRules.effectiveTo, at))
          )
        )
        // ORDER BY:
        //   1) user-specific before global
        //   2) item-specific before blanket
        //   3) priority DESC
        .orderBy(
          asc(sql`CASE WHEN ${userScoreRules.subjectUserId} IS NULL THEN 1 ELSE 0 END`),
          asc(sql`CASE WHEN ${userScoreRules.itemId}     IS NULL THEN 1 ELSE 0 END`),
          desc(userScoreRules.priority)
        )
        .limit(1)
    ).pop() ?? null;

  return rule;
};

/* ------------------------------------------------------------------ *
 *  7. ── Module export
 * ------------------------------------------------------------------ */

export const userScoreRulesDB = {
  createUserScoreRule,
  changeUserScoreRuleStatus,
  updateUserScoreRule,
  getMatchingUserScoreRule,
};
