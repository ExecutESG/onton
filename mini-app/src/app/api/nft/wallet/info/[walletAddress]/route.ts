import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";
import { logger } from "@/server/utils/logger";
import { getAccountBalance } from "@/services/tonCenter"; // or wherever you have a function to fetch balance
import { rawToFriendlyAddress } from "@/server/utils/rawToFriendlyAddress";

export async function GET(request: Request, { params }: { params: { walletAddress: string } }) {
  // 1) Handle preflight if needed
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // 2) Authenticate
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) {
    return authError; // 401 or 500
  }
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // 3) parse path param
  const { walletAddress } = params;
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: "walletAddress is required" }), { status: 400 });
  }

  try {
    // 4) parse optional friendlyAddress query param

    // 5) check if wallet belongs to the current API key
    //    either we do a simple: findByAddress(apiKeyId, walletAddress)
    const walletRow = await nftApiMinterWalletsDB.findByAddress(apiKeyRecord.id, walletAddress);
    if (!walletRow) {
      // you might return 403 if it is not in the user’s wallet list
      return new Response(JSON.stringify({ error: "Wallet is not authorized for this API key" }), { status: 403 });
    }

    // 6) fetch the balance (string or number)
    let balanceStr = "0";
    try {
      const balance = await getAccountBalance(walletAddress);
      balanceStr = balance.toString(); // e.g. "12.345"
    } catch (err) {
      logger.error(`Error fetching balance for wallet=${walletAddress}`, err);
      // you can decide to fail or just return a balance of "0"
      return new Response(JSON.stringify({ error: "Failed to fetch wallet balance" }), { status: 500 });
    }

    // 7) build final JSON
    const responseBody = {
      walletAddress, // from the param
      friendlyAddress: rawToFriendlyAddress(walletAddress),
      balance: balanceStr, // from TonCenter or whichever service
    };

    return new Response(JSON.stringify(responseBody), { status: 200 });
  } catch (error) {
    logger.error(`GET /wallets/info/${params.walletAddress} error:`, error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
