import { db } from "@/db/db";
import { eventCategories } from "@/db/schema/eventCategories";
import { EventCategoryRow } from "@/db/schema/eventCategories";
import { redisTools } from "@/lib/redisTools";
import { asc, eq } from "drizzle-orm";

// --------------------------------------------------
// Redis Cache Keys
// --------------------------------------------------
export const getCategoryIdCacheKey = (categoryId: number) => `${redisTools.cacheKeys.category_id}${categoryId}`;

// --------------------------------------------------
// Fetch Methods
// --------------------------------------------------

export const fetchCategoryById = async (categoryId: number): Promise<EventCategoryRow | null> => {
  // Try fetching from cache first
  const cached = await redisTools.getCache(getCategoryIdCacheKey(categoryId));
  if (cached) {
    return cached;
  }

  // Otherwise, fetch from DB
  const result = (
    await db.select().from(eventCategories).where(eq(eventCategories.category_id, categoryId)).execute()
  ).pop();

  if (result) {
    // Save to cache
    await redisTools.setCache(getCategoryIdCacheKey(categoryId), result, redisTools.cacheLvl.long);

    return result;
  }

  return null;
};

/**
 * Fetch all categories (optionally only the enabled ones),
 * sorted by `sort_order` ascending (you can adjust the orderBy as needed).
 */
export const fetchAllCategories = async (onlyEnabled: boolean = false): Promise<EventCategoryRow[]> => {
  const whereClause = onlyEnabled ? eq(eventCategories.enabled, true) : undefined;
  // If you like, you can add caching for the entire categories list as well,
  // but note it will be overwritten quickly if you do frequent changes.

  return await db
    .select()
    .from(eventCategories)
    .where(whereClause ?? undefined)
    .orderBy(asc(eventCategories.sort_order))
    .execute();
};

// --------------------------------------------------
// DB Module Export
// --------------------------------------------------
const eventCategoriesDB = {
  // Cache & internal helpers

  fetchCategoryById,
  fetchAllCategories,
};

export default eventCategoriesDB;
