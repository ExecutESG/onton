// app/api/collections/[collectionId]/status/route.ts
import { nftApiCollectionsDB } from "@/db/modules/nftApiCollections.db";
import { getAuthenticatedNftApi } from "@/server/utils/getAuthenticatedNftApi";
import { logger } from "@/server/utils/logger";
import { nftApiMinterWalletsDB } from "@/db/modules/nftApiMinterWallets.db";

export async function GET(request: Request, { params }: { params: { collectionId: string } }) {
  // 1) Authenticate
  const [apiKeyRecord, authError] = await getAuthenticatedNftApi(request);
  if (authError) return authError;
  if (!apiKeyRecord) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    // 2) parse collectionId
    const id = parseInt(params.collectionId, 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid collectionId param" }), { status: 400 });
    }

    // 3) fetch from DB
    const coll = await nftApiCollectionsDB.getById(id);
    if (!coll) {
      return new Response(JSON.stringify({ error: "Collection not found" }), { status: 404 });
    }

    // check ownership (coll.apiKeyId === apiKeyRecord.id) if you want
    if (coll.apiKeyId !== apiKeyRecord.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    // 4) return data
    // e.g. {collectionId, address, status, minterAddress, collectionData}
    const responseBody = {
      collectionId: coll.id.toString(),
      address: coll.address,
      friendlyAddress: coll.friendlyAddress,
      status: coll.status,
      minterAddress: await nftApiMinterWalletsDB.findById(coll.minterWalletId),
      collectionData: {
        name: coll.name,
        description: coll.description,
        image: coll.image,
        cover_image: coll.coverImage,
        social_links: coll.socialLinks,
        royalties: coll.royalties,
      },
    };

    return new Response(JSON.stringify(responseBody), { status: 200 });
  } catch (err) {
    logger.error("GET /collections/:collectionId/status error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
