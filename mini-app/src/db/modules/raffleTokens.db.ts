import { db } from "@/db/db";
import { raffleTokens, RaffleTokenRow } from "@/db/schema/raffleTokens";
import { desc, eq } from "drizzle-orm";

const listTokens = async (): Promise<RaffleTokenRow[]> =>
  db.select().from(raffleTokens).orderBy(desc(raffleTokens.is_native), raffleTokens.symbol).execute();

const getTokenById = async (tokenId: number): Promise<RaffleTokenRow | null> =>
  db.select().from(raffleTokens).where(eq(raffleTokens.token_id, tokenId)).execute().then((rows) => rows[0] ?? null);

const raffleTokensDB = {
  listTokens,
  getTokenById,
};

export default raffleTokensDB;
