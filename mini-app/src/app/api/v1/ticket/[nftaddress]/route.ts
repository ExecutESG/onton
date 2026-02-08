import { db } from "@/db/db";
import { eventRegistrants, nftItems, orders, tickets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/server/auth";
import tonCenter from "@/services/tonCenter";
import { decodePayloadToken, verifyToken } from "@/server/utils/jwt";
import { logger } from "@/server/utils/logger";
const updateTicketSchema = z.object({
  data: z.object({
    full_name: z.string(),
    telegram: z.string(),
    company: z.string(),
    position: z.string(),
  }),
  proof_token: z.string(),
});

export async function PUT(req: NextRequest, { params }: { params: { nftaddress: string } }) {
  try {
    const nft_address = params.nftaddress;

    /* -------------------------------------------------------------------------- */
    const body = await req.json();
    const parsedData = updateTicketSchema.safeParse(body);
    if (!parsedData.success) {
      return Response.json(
        { error: "invalid input" },
        {
          status: 400,
        }
      );
    }
    /* -------------------------------------------------------------------------- */
    /* ---------------------------------- Auth ---------------------------------- */
    const [userId, unauthorized] = getAuthenticatedUser();
    /* -------------------------------------------------------------------------- */

    if (unauthorized) {
      logger.warn(`Unauthorized access attempt for ticket update: ${nft_address}`);
      return unauthorized;
    }

    const proof_token = parsedData.data.proof_token;

    if (!proof_token) {
      return Response.json(
        {
          message: "Uer wallet ton proof is missing",
          code: "proof_token_required",
        },
        {
          status: 400,
        }
      );
    }

    let decoded;
    try {
      if (!(await verifyToken(proof_token))) {
        return Response.json(
          {
            message: "invalid token",
            code: "invalid_proof_token",
          },
          {
            status: 401,
          }
        );
      }

      decoded = {
        address: decodePayloadToken(proof_token)?.address,
      };
    } catch {
      return Response.json(
        {
          message: "invalid token",
          code: "invalid_proof_token",
        },
        {
          status: 401,
        }
      );
    }

    if (!decoded.address) {
      return Response.json(
        {
          message: "address is missing in token",
          code: "token_address_missing",
        },
        {
          status: 400,
        }
      );
    }

    const walletAddress = decoded.address;
    const nftItem = await tonCenter.fetchNFTItemsWithRetry(walletAddress, "", nft_address);
    // Check if nftItem is valid and contains nft_items
    if (!nftItem || !nftItem.nft_items || nftItem.nft_items.length === 0) {
      return Response.json(
        {
          message: "NFT not found or does not belong to wallet",
          code: "nft_item_update_fail",
        },
        { status: 401 }
      );
    }

    const nft_db = (await db.select().from(nftItems).where(eq(nftItems.nft_address, nft_address)).execute()).pop();

    if (!nft_db) {
      return Response.json(
        {
          error: "nft_not_found",
          message: "nft not found",
        },
        { status: 404 }
      );
    }
    await db.transaction(async (trx) => {
      if (nft_db.owner) {
        // Nft Belongs To Someone else and we have to transfer ownership
        /* ---------------------- Reject Last owner Registrant ---------------------- */
        await trx
          .update(eventRegistrants)
          .set({ status: "rejected" })
          .where(and(eq(eventRegistrants.event_uuid, nft_db.event_uuid), eq(eventRegistrants.user_id, nft_db.owner!)))
          .execute();
      }
      /* ------------------------ Add/Update New Registrant ----------------------- */
      await trx
        .insert(eventRegistrants)
        .values({
          event_uuid: nft_db.event_uuid,
          user_id: userId, // new user
          register_info: parsedData.data.data,
          status: "approved",
        })
        .onConflictDoUpdate({
          target: [eventRegistrants.event_uuid, eventRegistrants.user_id],
          set: {
            register_info: parsedData.data.data,
            status: "approved",
          },
        })
        .execute();
      /* ------------------------- Transfer NFT OwnerShip ------------------------- */
      await trx.update(nftItems).set({ owner: userId }).where(eq(nftItems.nft_address, nft_address)).execute();
    });

    // await modules.update(eventRegistrants).set(
    //   {
    //     status : "rejected",

    //   }
    // ).where(
    //   and(
    //     eq(eventRegistrants.event_uuid , order_data[0].nft_items.event_uuid),
    //     eq(eventRegistrants.user_id , order_data[0].orders.user_id),
    //   )
    // )
    // await modules
    //   .update(tickets)
    //   .set({
    //     telegram: parsedData.data.data.telegram,
    //     name: parsedData.data.data.full_name,
    //     company: parsedData.data.data.company,
    //     position: parsedData.data.data.position,

    //     user_id: userId,
    //     updatedBy: `${userId}`,
    //     updatedAt: new Date(),
    //   })
    //   .where(eq(tickets.nftAddress, nft_address))
    //   .execute();

    logger.log(`route api ticket nft address : User ${userId} claimed ticket info for NFT ${nft_address}`);

    // logger.log(`route api ticket nft address : Deal room refresh result ${JSON.stringify(result)}`);
    return Response.json({ message: "user ticket info updated" });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: "invalid_body", message: "invalid json body provided" }, { status: 400 });

    logger.error("nft claim update error ", error);
    return Response.json({ error: "internal_server_error", message: "internal_server_error" }, { status: 500 });
  }
}
