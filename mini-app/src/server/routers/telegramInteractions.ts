import {
  eventManagementProtectedProcedure,
  eventManagementProtectedProcedure as evntManagerPP,
  initDataProtectedProcedure,
} from "@/server/trpc";
import { z } from "zod";
import eventDB, { getEventByUuid } from "@/db/modules/events.db";
import { logger } from "@/server/utils/logger";
import telegramService from "@/services/telegramService";
import { TRPCError } from "@trpc/server";
import { router } from "@/server/trpc";
import { db } from "@/db/db";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { users } from "@/db/schema/users";
import { and, eq, or } from "drizzle-orm";
import Papa from "papaparse";
import { selectVisitorsByEventUuid } from "@/db/modules/visitors.db";
import { VisitorsWithDynamicFields } from "@/db/modules/dynamicType/VisitorsWithDynamicFields";
import axios from "axios";
import { getSBTClaimedStatus } from "@/lib/ton-society-api";
import { usersDB } from "@/db/modules/users.db";
import couponSchema from "@/zodSchema/couponSchema";
import { couponDefinitionsDB } from "@/db/modules/couponDefinitions.db";
import { couponItemsDB } from "@/db/modules/couponItems.db";
import { convertSvgToJpegBuffer } from "@/lib/convertSvgToJpegBuffer";
import { tournamentsDB } from "@/db/modules/tournaments.db";
import { fromNano } from "@ton/core";
import { sumSpinCountByAffiliateHash, tokenCampaignOrdersDB } from "@/db/modules/tokenCampaignOrders.db";
import { affiliateLinksDB, getAffiliateLinkForOnionCampaign } from "@/db/modules/affiliateLinks.db";

const requestShareEvent = initDataProtectedProcedure
  .input(
    z.object({
      eventUuid: z.string(), // Accept only the event UUID
      platform: z.string().optional(), // Optional platform (e.g., "telegram", "twitter")
    })
  )
  .mutation(async (opts) => {
    try {
      const { eventUuid } = opts.input;

      // Step 1: Fetch the event data by UUID
      const event = await getEventByUuid(eventUuid);

      if (!event) {
        logger.log(`Event not found ${eventUuid} for user ${opts.ctx.user.user_id}`, opts);
        return { status: "fail", data: `Event not found  ${eventUuid}` };
      }

      const { event_uuid } = event;
      // Step 2: Make the request to share the event
      const result = await telegramService.shareEventRequest(opts.ctx.user.user_id.toString(), event_uuid.toString());

      if (result.success) {
        // logger.log("Event shared successfully:", result.data);
        return { status: "success", data: null };
      } else {
        logger.error("Failed to share the event:", result.error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to share the event",
          cause: result.error,
        });
      }
    } catch (error) {
      logger.error("Error while sharing event: ", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to share the event",
        cause: error,
      });
    }
  });

const requestExportFile = evntManagerPP.mutation(async (opts) => {
  const event_uuid = opts.input.event_uuid;
  const event = opts.ctx.event;
  const dynamic_fields = !(event.has_registration && event.participationType === "in_person");

  const eventData = await eventDB.selectEventByUuid(event_uuid);

  let csvString = "";
  let count = 0;

  /* -------------------------------------------------------------------------- */
  /*                              EVENT REGISTRANTS                             */
  /* -------------------------------------------------------------------------- */
  if (eventData?.has_registration) {
    const condition = eventData.has_payment
      ? and(
          or(eq(eventRegistrants.status, "approved"), eq(eventRegistrants.status, "checkedin")),
          eq(eventRegistrants.event_uuid, event_uuid)
        )
      : eq(eventRegistrants.event_uuid, event_uuid);

    const result = await db
      .select()
      .from(eventRegistrants)
      .innerJoin(users, eq(eventRegistrants.user_id, users.user_id))
      .where(condition)
      .execute();

    count = result.length;
    /* -------------------------------------------------------------------------- */

    /* ------------------------ Get Sbt Claims In Chunks ------------------------ */
    const chunkArray = (array: any, size: any) => {
      const chunks = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    };

    const processInBatches = async (data: any, batchSize: any) => {
      const chunks = chunkArray(data, batchSize);
      const result = [];

      for (const chunk of chunks) {
        const batchResult = await Promise.all(
          chunk.map(async (row: any) => {
            const registerInfo =
              typeof row.event_registrants.register_info === "object"
                ? row.event_registrants.register_info
                : JSON.parse(String(row.event_registrants.register_info || "{}"));

            const sbtClaimStatus = await getSBTClaimedStatus(eventData.activity_id!, row.users.user_id);

            const expandedRow = {
              ...row.event_registrants,
              ...row.users,
              ...registerInfo,
              sbt_claim_status: sbtClaimStatus.status,
            };

            delete expandedRow.register_info;

            return expandedRow;
          })
        );
        result.push(...batchResult);
      }

      return result;
    };

    // Call the function with a batch size
    const batchSize = 50; // Adjust based on API limits
    const dataForCsv = await processInBatches(result, batchSize);
    /* ----------------------------------- END ---------------------------------- */

    /* -------------------------------------------------------------------------- */
    /*                                 CSV CREATE                                 */
    /* -------------------------------------------------------------------------- */
    /* -------------------------------------------------------------------------- */
    csvString = Papa.unparse(dataForCsv || [], {
      header: true,
    });
  } else {
    /* -------------------------------------------------------------------------- */
    /*                                  VISITORS                                  */
    /* -------------------------------------------------------------------------- */
    const chunkArray = (array: any, size: number) => {
      const chunks = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    };

    const processVisitorsInBatches = async (visitors: any, batchSize: any) => {
      const chunks = chunkArray(visitors, batchSize);
      const result = [];

      for (const chunk of chunks) {
        const batchResult = await Promise.all(
          chunk.map(async (visitor: any) => {
            const visitorData: Partial<VisitorsWithDynamicFields> = {
              ...visitor,
              ticket_status: "ticket_status" in visitor ? (visitor.ticket_status ?? undefined) : undefined,
              wallet_address: visitor.wallet_address as string | null | undefined,
              username: visitor.username === "null" ? null : visitor.username,
            };

            if (!eventData?.ticketToCheckIn && "has_ticket" in visitorData) {
              delete visitorData.has_ticket;
              delete visitorData.ticket_status;
              delete visitorData.ticket_id;
            }

            const sbtClaimStatus = await getSBTClaimedStatus(eventData?.activity_id!, visitorData.user_id!);

            delete visitorData.dynamicFields;
            return {
              ...visitorData,
              // dynamicFields: JSON.stringify(visitor.dynamicFields),
              sbt_claim_status: sbtClaimStatus.status,
            };
          })
        );
        result.push(...batchResult);
      }

      return result;
    };

    const visitors = await selectVisitorsByEventUuid(opts.input.event_uuid, -1, 0, dynamic_fields, "");
    const batchSize = 50; // Adjust batch size as needed
    const dataForCsv = await processVisitorsInBatches(visitors.visitorsWithDynamicFields, batchSize);

    csvString = Papa.unparse(dataForCsv || [], {
      header: true,
    });
    count = visitors.visitorsWithDynamicFields?.length || 0;
  }
  /* -------------------------------------------------------------------------- */
  /*                                  SEND CSV                                  */
  /* -------------------------------------------------------------------------- */
  try {
    const formData = new FormData();

    // Add BOM at the beginning of the CSV string for UTF-8 encoding
    const bom = "\uFEFF";
    const csvContentWithBom = bom + csvString;

    const fileBlob = new Blob([csvContentWithBom], {
      type: "text/csv;charset=utf-8;",
    });
    formData.append("file", fileBlob, "visitors.csv");
    // Include the custom message in the form data
    let customMessage = "Here is the guest list for your event.";
    if (eventData && eventData?.title) {
      customMessage = `📂 Download Guest List Report \n\n🟢 ${eventData?.title} \n\n👤 Count of Guests ${count}`;
    }
    formData.append("message", customMessage);
    formData.append("fileName", eventData?.title || "visitors");
    const userId = opts.ctx.user.user_id;
    const response = await axios.post(
      `http://${process.env.IP_TELEGRAM_BOT}:${process.env.TELEGRAM_BOT_PORT}/send-file?id=${userId}`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.status === 200 ? { status: "success", data: null } : { status: "fail", data: response.data };
  } catch (error) {
    logger.error("Error while sending file: ", error);
    return { status: "fail", data: null };
  }
});

const requestSendQRCode = evntManagerPP
  .input(z.object({ url: z.string(), hub: z.string().optional() }))
  .mutation(async (opts) => {
    try {
      const response = await axios.get(
        `http://${process.env.IP_TELEGRAM_BOT}:${process.env.TELEGRAM_BOT_PORT}/generate-qr`,
        {
          params: {
            id: opts.ctx.user.user_id,
            url: opts.input.url,
            hub: opts.input.hub,
          },
        }
      );

      return response.status === 200 ? { status: "success", data: null } : { status: "fail", data: response.data };
    } catch (error) {
      logger.error("Error while generating QR Code: ", error);
      return { status: "fail", data: null };
    }
  });

const requestShareOrganizer = initDataProtectedProcedure
  .input(
    z.object({
      organizerId: z.number(), // The ID of the organizer (must be role='organizer')
      platform: z.string().optional(),
    })
  )
  .mutation(async (opts) => {
    try {
      // Step 1: Fetch the organizer user data
      const organizer = await usersDB.selectUserById(opts.input.organizerId);
      if (!organizer) {
        return { status: "fail", data: `Organizer not found: ${opts.input.organizerId}` };
      }
      if (organizer.role !== "organizer" && organizer.role !== "admin") {
        return { status: "fail", data: "User is not an organizer or admin" };
      }
      let finalImageUrl = (organizer.org_image?.trim() === "" ? organizer.photo_url : organizer.org_image) ?? "";

      let jpegBuffer: Buffer | undefined;
      // If it's an SVG, convert it to JPEG
      if (finalImageUrl.toLowerCase().endsWith(".svg")) {
        try {
          jpegBuffer = await convertSvgToJpegBuffer(finalImageUrl);
        } catch (err) {
          logger.error("Error converting SVG to JPEG:", err);
          // fallback to a default image or simply skip the image
          jpegBuffer = undefined;
        }
      }

      // Step 2: Call telegramService to share the organizer
      const result = await telegramService.shareOrganizerRequest(
        // The user who is requesting the share
        opts.ctx.user.user_id.toString(),
        // The actual organizer to share
        organizer.user_id.toString(),
        // Additional data for constructing the share message
        {
          org_channel_name: organizer.org_channel_name,
          org_support_telegram_user_name: organizer.org_support_telegram_user_name,
          org_x_link: organizer.org_x_link,
          org_bio: organizer.org_bio,
          org_image: jpegBuffer ?? finalImageUrl ?? "",
        }
      );
      logger.log("result", result);
      // Step 3: Check for success
      if (result.success) {
        return { status: "success", data: null };
      } else {
        logger.error("Failed to share the organizer:", result.error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to share the organizer",
          cause: result.error,
        });
      }
    } catch (error) {
      logger.error("Error while sharing organizer: ", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to share the organizer",
        cause: error,
      });
    }
  });

const getCouponItemsCSV = eventManagementProtectedProcedure
  .input(
    couponSchema.getItemsSchema.extend({
      event_uuid: couponSchema.getDefinitionsSchema.shape.event_uuid,
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { coupon_definition_id, event_uuid } = input;

    try {
      // 1) Validate Event
      const eventData = await eventDB.getEventByUuid(event_uuid);
      if (!eventData?.event_uuid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No event found.",
        });
      }

      // 2) Validate Definition
      const definition = await couponDefinitionsDB.getCouponDefinitionById(coupon_definition_id);
      if (!definition) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No coupon definition found.",
        });
      }

      // 3) Fetch coupon items
      const items = await couponItemsDB.getCouponItemsByDefinitionId(coupon_definition_id);
      const itemCount = items.length;

      // 4) Enrich each item with definition + event data
      //    This avoids a DB join but still adds helpful columns.
      const itemsForCsv = items.map((item) => ({
        ...item, // original coupon_items fields
        definition_type: definition.cpd_type,
        definition_status: definition.cpd_status,
        definition_value: definition.value,
        definition_start_date: definition.start_date?.toISOString?.() ?? definition.start_date,
        definition_end_date: definition.end_date?.toISOString?.() ?? definition.end_date,
        definition_count: definition.count,
        definition_used: definition.used,
        event_title: eventData.title,
        event_start_date: eventData.start_date,
        event_end_date: eventData.end_date,
        // ... add more event fields as needed
      }));

      // 5) Convert to CSV
      const csvString = Papa.unparse(itemsForCsv, { header: true });

      // 6) Add BOM for UTF-8
      const bom = "\uFEFF";
      const csvContentWithBom = bom + csvString;

      // 7) Prepare a Blob
      const fileBlob = new Blob([csvContentWithBom], {
        type: "text/csv;charset=utf-8;",
      });

      // 8) Build form data
      const formData = new FormData();
      formData.append("file", fileBlob, "coupon_items.csv");

      // Create a custom message with event + definition info
      let customMessage = `Here is the coupon items list for definition #${definition.id}.`;
      if (eventData.title) {
        customMessage =
          `📂 Download Coupon Items\n\n` +
          `🟢 Event: ${eventData.title}\n` +
          `🪪 Definition Code: ${definition.id}\n` +
          `📅 Discount Start Date: ${definition.start_date?.toLocaleDateString?.() ?? definition.start_date}\n` +
          `📅 Discount End Date: ${definition.end_date?.toLocaleDateString?.() ?? definition.end_date}\n` +
          `💰 Value: ${definition.value}${definition.cpd_type === "percent" ? "%" : ""}\n` +
          `👤 Total Count of Codes: ${itemCount}\n` +
          `📊 Used Codes: ${definition.used}\n`;
      }
      formData.append("message", customMessage);
      formData.append("fileName", `coupon_items_${definition.id}`);

      // 9) Send to your Telegram Bot service
      try {
        const userId = ctx.user.user_id;
        const response = await axios.post(
          `http://${process.env.IP_TELEGRAM_BOT}:${process.env.TELEGRAM_BOT_PORT}/send-file?id=${userId}`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (response.status === 200) {
          return {
            status: "success",
            message: `CSV file for coupon definition #${definition.id} sent successfully.`,
          };
        } else {
          return { status: "fail", data: response.data };
        }
      } catch (error) {
        logger.log("Error while sending coupon items CSV file to Telegram: ", error);
        return { status: "fail", data: null };
      }
    } catch (err: any) {
      logger.error("Error fetching coupon items", { error: err, input });
      if (err instanceof TRPCError) {
        throw err;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred while fetching coupon items.",
        cause: err,
      });
    }
  });

export const requestShareTournament = initDataProtectedProcedure
  .input(
    z.object({
      tournamentId: z.number(), // The ID in your local DB
      platform: z.string().optional(),
    })
  )
  .mutation(async (opts) => {
    try {
      // 1) Fetch the tournament record from DB
      const tournament = await tournamentsDB.getTournamentById(opts.input.tournamentId);
      if (!tournament) {
        return { status: "fail", data: `Tournament not found: ${opts.input.tournamentId}` };
      }

      // 2) Decide finalImageUrl
      let finalImageUrl = tournament.imageUrl?.trim() ?? "";
      let jpegBuffer: Buffer | undefined;

      // If it's an SVG -> convert to JPEG
      if (finalImageUrl.toLowerCase().endsWith(".svg")) {
        try {
          jpegBuffer = await convertSvgToJpegBuffer(finalImageUrl);
        } catch (err) {
          logger.error("Error converting SVG to JPEG:", err);
          jpegBuffer = undefined;
        }
      }
      // 3) Prepare the data object for shareTournamentRequest
      const tournamentDataForBot = {
        name: tournament.name || `Tournament #${tournament.id}`,
        startDate: tournament.startDate ? Math.floor(new Date(tournament.startDate).getTime() / 1000) : null,
        endDate: tournament.endDate ? Math.floor(new Date(tournament.endDate).getTime() / 1000) : null,
        imageUrl: jpegBuffer ?? finalImageUrl, // either a buffer or a string
        state: tournament.state,
        entryFee: Number(fromNano(Number(tournament.entryFee))) || 0,
      };

      // 4) Call the telegramService method
      const result = await telegramService.shareTournamentRequest(
        // The user who is requesting the share
        opts.ctx.user.user_id.toString(),
        // The local tournament ID or hostTournamentId if needed
        tournament.id.toString(),
        // Additional data
        tournamentDataForBot
      );

      logger.log("shareTournamentRequest => ", result);

      if (result.success) {
        return { status: "success", data: null };
      } else {
        logger.error("Failed to share the tournament:", result.error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to share the tournament",
          cause: result.error,
        });
      }
    } catch (error) {
      logger.error("Error while sharing tournament: ", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to share the tournament",
        cause: error,
      });
    }
  });
export const requestShareAffiliateOnionCampaign = initDataProtectedProcedure.mutation(async ({ ctx }) => {
  try {
    // 1) Verify user
    const userId = ctx.user?.user_id;

    // 2) Fetch onion-campaign affiliate link & spin data
    const affiliateResult = await affiliateLinksDB.getAffiliateLinkForOnionCampaign(userId);
    if (!affiliateResult) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `requestShareAffiliateOnionCampaign: Affiliate link not found for user #${userId}`,
      });
    }
    const linkHash = affiliateResult.linkHash;
    const totalSpins = Number(affiliateResult.totalPurchase) || 0;
    // 3) Prepare share link data
    const shareLink = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=campaign-aff-${linkHash}`;
    const fallbackUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL}/genesis-onions/?affiliate=${linkHash}`;

    // 4) Build your “affiliate” object to pass to Telegram
    const affiliateDataForBot = {
      linkHash,
      totalSpins,
      // Your fixed image:
      imageUrl: "https://mohammad-storage.toncloud.observer/campaign/photo_2025-04-01_08-41-17.jpg",
    };

    // 5) Call telegramService to share
    const result = await telegramService.shareAffiliateLinkRequest(
      userId.toString(),
      linkHash,
      shareLink,
      fallbackUrl,
      affiliateDataForBot
    );

    logger.info("requestShareAffiliateOnionCampaign: shareAffiliateLinkRequest => ", result);

    if (result.success) {
      return { status: "success", data: null };
    } else {
      logger.error(
        `requestShareAffiliateOnionCampaign: Failed to share the affiliate link for user #${userId}:`,
        result.error
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to share affiliate link",
        cause: result.error,
      });
    }
  } catch (error) {
    logger.error(
      `requestShareAffiliateOnionCampaign: Error while sharing affiliate link for user #${ctx.user?.user_id}:`,
      error
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to share affiliate link",
      cause: error,
    });
  }
});

export const telegramInteractionsRouter = router({
  requestShareEvent,
  requestExportFile,
  requestSendQRCode,
  requestShareOrganizer,
  getCouponItemsCSV,
  requestShareTournament,
  requestShareAffiliateOnionCampaign,
});
