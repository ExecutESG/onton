import { db } from "@/db/db";
import { giataCity } from "@/db/schema";
import { and, eq, ilike, sql, SQLWrapper } from "drizzle-orm";
import { redisTools } from "@/lib/redisTools";

type Country = {
  id: number;
  title: string;
  giataCode: number;
  abbreviatedCode: string;
};

interface City {
  id: number;
  title: string;
  parentId: number; // or any other relevant fields
}

// Function to get countries
export async function fetchCountries(search?: string): Promise<Country[]> {
  const cacheKey = `countries:${search || "all"}`;

  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const whereOptions: SQLWrapper[] = [eq(giataCity.parentId, 0)];
  if (search) {
    whereOptions.push(ilike(giataCity.title, `%${search}%`));
  }

  const result = await db
    .select()
    .from(giataCity)
    .where(and(...whereOptions))
    .execute();

  await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.long);

  return result as Country[];
}

// Function to get cities
export async function fetchCities(countryId: number, search?: string): Promise<City[]> {
  const cacheKey = `cities:${countryId}:${search || "all"}`;

  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const whereOptions: SQLWrapper[] = [eq(giataCity.parentId, countryId)];
  if (search) {
    whereOptions.push(ilike(giataCity.title, `%${search}%`));
  }

  let query = db
    .select()
    .from(giataCity)
    .where(and(...whereOptions));

  if (search) {
    // @ts-expect-error
    query = query.orderBy(sql`similarity(${giataCity.title}, ${search}) DESC`);
  }

  const result = await query.limit(7).execute();

  await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.long);

  return result as City[];
}

// Function to get city by ID
export async function fetchCityById(cityId: number): Promise<City | undefined> {
  const cacheKey = redisTools.cacheKeys.city + cityId;

  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result = await db
    .select()
    .from(giataCity)
    .where(eq(giataCity.id, cityId))
    .limit(1)
    .execute()
    .then((results) => results[0]);

  if (result) {
    await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.long);
  }

  return result as City | undefined;
}

// Function to get country by ID
export async function fetchCountryById(countryId: number): Promise<Country | undefined> {
  const cacheKey = redisTools.cacheKeys.country + countryId;

  const cachedResult = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result = await db
    .select()
    .from(giataCity)
    .where(and(eq(giataCity.id, countryId), eq(giataCity.parentId, 0))) // Ensure it's a country
    .limit(1)
    .execute()
    .then((results) => results[0]);

  if (result) {
    await redisTools.setCache(cacheKey, result, redisTools.cacheLvl.long);
  }

  return result as Country | undefined;
}
