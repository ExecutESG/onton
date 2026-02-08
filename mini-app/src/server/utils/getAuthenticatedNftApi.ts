import { nftApiKeysDB } from "@/db/modules/nftApiKeys.db";
import type { NftApiKeys } from "@/db/schema/nftApiKeys";

/**
 * Verifies the API key from request headers against `nft_api_keys` table.
 * Returns `[NftApiKeysRecord, null]` if found & active.
 * Otherwise, returns `[null, Response]` with the appropriate HTTP status.
 */
export async function getAuthenticatedNftApi(req: Request): Promise<[NftApiKeys | null, Response | null]> {
  // 1) Extract the API key from header
  const apiKey = req.headers.get("X-API-KEY") || req.headers.get("Authorization");

  if (!apiKey) {
    return [
      null,
      new Response(
        JSON.stringify({
          error: "Unauthorized: No API Key provided",
        }),
        { status: 401 }
      ),
    ];
  }

  // 2) Use the DB module to fetch an active API key record
  let record: NftApiKeys | undefined;
  try {
    record = await nftApiKeysDB.getByKeyAndActive(apiKey);
  } catch (err) {
    console.log("Error fetching API key from DB:", err);
    return [null, new Response(JSON.stringify({ error: "Something went wrong" }), { status: 500 })];
  }

  if (!record) {
    return [
      null,
      new Response(
        JSON.stringify({
          error: "Unauthorized: Invalid or inactive API Key",
        }),
        { status: 401 }
      ),
    ];
  }

  // 3) Return the record if valid
  return [record, null];
}
