import { db } from "@/db/db";
import { eventTokens, EventTokenRow } from "@/db/schema/eventTokens";
import { desc, eq } from "drizzle-orm";

const listTokens = async (): Promise<EventTokenRow[]> =>
  db.select().from(eventTokens).orderBy(desc(eventTokens.is_native), eventTokens.symbol).execute();

const getTokenById = async (tokenId: number): Promise<EventTokenRow | null> =>
  db
    .select()
    .from(eventTokens)
    .where(eq(eventTokens.token_id, tokenId))
    .execute()
    .then((rows) => rows[0] ?? null);

const getTokenBySymbol = async (symbol: string): Promise<EventTokenRow | null> =>
  db
    .select()
    .from(eventTokens)
    .where(eq(eventTokens.symbol, symbol))
    .execute()
    .then((rows) => rows[0] ?? null);

const eventTokensDB = {
  listTokens,
  getTokenById,
  getTokenBySymbol,
};

export default eventTokensDB;
