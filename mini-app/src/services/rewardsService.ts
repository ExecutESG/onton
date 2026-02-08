import rewardDB from "@/db/modules/rewards.db";

import { createUserRewardLink } from "@/lib/ton-society-api";
import { getAndValidateVisitor } from "@/services/visitorService";

import { db } from "@/db/db";
import { eventRegistrants, rewards } from "@/db/schema";
import eventPaymentDB from "@/db/modules/eventPayment.db";
import eventDB, { selectEventByUuid } from "@/db/modules/events.db";
import rewardsDb from "@/db/modules/rewards.db";
import visitorsDB, { addVisitor, findVisitorByUserAndEventUuid, selectValidVisitorById } from "@/db/modules/visitors.db";
import { validateEventData, validateEventDates } from "@/services/eventService";
import { logger } from "@/server/utils/logger";
import { sleep } from "@/utils";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { RewardDataTyepe } from "@/db/schema/rewards";
import { usersDB } from "@/db/modules/users.db";
import { rewardLinkZod } from "@/types/user.types";
import { EventRow } from "@/db/schema/events";
import { ExtendedUser } from "@/types/extendedUserTypes";
import { eventRegistrantsDB } from "@/db/modules/eventRegistrants.db";
import userEventFieldsDB from "@/db/modules/userEventFields.db";

// --- Helper Validation Functions ----------------------------------

function validateEventActivityId(eventData: EventRow) {
  if (!eventData.activity_id || eventData.activity_id < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This event does not have a valid activity_id: ${eventData?.activity_id}`,
    });
  }
}

function validateEventDateRange(eventData: EventRow) {
  const startDate = Number(eventData.start_date) * 1000;
  const endDate = Number(eventData.end_date) * 1000;
  const now = Date.now();

  if (now < startDate || now > endDate) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Event is ended or not yet started",
    });
  }
}

async function validateRegistrationIfNeeded(eventData: EventRow, userData: ExtendedUser) {
  if (!eventData.has_registration) {
    return;
  }

  const eventRegistrantRequest = await eventRegistrantsDB.getRegistrantRequest(eventData.event_uuid, userData.user_id);

  if (!eventRegistrantRequest) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Event requires registration, but no registration found for this user.",
    });
  }

  if (eventRegistrantRequest.status !== "approved") {
    const eventType = eventData.participationType === "online" ? "Online" : "In-person";
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${eventType} event requires approved registration.`,
    });
  }
}

async function validateTaskCompletionIfNeeded(eventData: EventRow, user_id: number) {
  // If it's an in-person event, no password task is required
  if (eventData.participationType === "in_person") {
    return;
  }

  // Otherwise, check the password task
  const taskCompleted = await userEventFieldsDB.checkPasswordTask(user_id, eventData.event_id);
  if (!taskCompleted) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "You have not completed the required task for this event.",
    });
  }
}

//TODO - Put this in modules functions files
async function getRegistrantRequest(event_uuid: string, user_id: number) {
  const result = (
    await db
      .select()
      .from(eventRegistrants)
      .where(and(eq(eventRegistrants.event_uuid, event_uuid), eq(eventRegistrants.user_id, user_id)))
      .execute()
  ).pop();

  return result;
}

// Main function to create a reward for a user
export const createUserRewardSBT = async (props: {
  user_id: number;
  event_uuid: string;
  ticketOrderUuid?: string | null;
}) => {
  const { user_id, event_uuid, ticketOrderUuid = null } = props;
  let reward = null;

  try {
    // Validate event data
    const eventValidationResult = await validateEventData(event_uuid);
    const eventData = eventValidationResult?.data;
    if (!eventValidationResult.success || !eventData || !eventData.start_date || !eventData.end_date) {
      return eventValidationResult; // Return the error in JSON format
    }

    // validate event date
    const validateEventDateResult = validateEventDates(eventData.start_date, eventData.end_date);
    if (!validateEventDateResult.success) {
      return validateEventDateResult;
    }

    // Validate visitor
    const visitorValidationResult = await getAndValidateVisitor(user_id, event_uuid, ticketOrderUuid);
    // logger.log("visitorValidationResult", visitorValidationResult);
    if (!visitorValidationResult.success || !visitorValidationResult.data) {
      return visitorValidationResult; // Return the error in JSON format
    }
    const visitor = visitorValidationResult.data;
    // Check if reward already exists

    reward = await rewardDB.checkExistingReward(visitor.id);
    if (!reward) {
      reward = await rewardDB.insertRewardRow(visitor.id, null, user_id, "ton_society_sbt", "pending_creation", eventData);
    }

    // Process reward creation

    // If reward creation failed, return error
    return {
      success: true,
      error: null,
      errorCode: null,
      data: reward,
    };
  } catch (error) {
    // logger.error(`Error in createUserRewardSBT:`, error);
    // Return a JSON response for any unexpected errors
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred.",
      errorCode: "INTERNAL_SERVER_ERROR",
      data: null,
    };
  }
};

/**
 * Creates a CSBT ticket reward for the given user/event.
 * 1) Checks if there's an existing reward; if so, returns immediately
 * 2) Looks up the eventPayment row to ensure it's TSCSBT + has a ticket_activity_id
 * 3) Calls createUserRewardLink(ticket_activity_id, ...)
 * 4) Inserts the new reward into the DB
 */
export async function CsbtTicket(event_uuid: string, user_id: number) {
  // 1) Create (or fetch) a visitor record for this user + event
  const visitor = await addVisitor(user_id, event_uuid);

  // 2) Fetch the main event (for organizer/society_hub info, etc.)
  const eventData = await selectEventByUuid(event_uuid);
  if (!eventData) {
    logger.error("CsbtTicketRewardService: eventData is null");
    throw new Error("CsbtTicketRewardService: eventData is null");
  }

  // 3) Fetch the eventPayment info to ensure TSCSBT + ticket_activity_id
  const paymentInfo = await eventPaymentDB.fetchPaymentInfoForCronjob(event_uuid);

  if (!paymentInfo) {
    logger.error(`CsbtTicketRewardService: No payment info found for event ${event_uuid}`);
    throw new Error(`No payment info found for event ${event_uuid}`);
  }
  if (paymentInfo.ticket_type !== "TSCSBT") {
    logger.error(`CsbtTicketRewardService: Event is not TSCSBT ${event_uuid}`);
    throw new Error("Event is not TSCSBT");
  }
  if (!paymentInfo.ticketActivityId) {
    logger.error(`CsbtTicketRewardService: Missing ticket_activity_id for TSCSBT event ${event_uuid}`);
    throw new Error("Missing ticket_activity_id for TSCSBT event");
  }
  if (!visitor) {
    logger.error(`CsbtTicketRewardService: Visitor not found for user ${user_id} and event ${event_uuid}`);
    throw new Error("Visitor not found for user ${user_id} and event ${event_uuid}");
  }
  // 4) Check if a reward already exists for this visitor
  const existingReward = await rewardDB.checkExistingRewardWithType(visitor.id, "ton_society_csbt_ticket");
  if (existingReward) {
    logger.debug(`Reward already exists for visitor ${visitor.id}, skipping creation`);
    return;
  }

  // 5) Build optional trait for "Organizer"
  const societyHubValue =
    typeof eventData.society_hub === "string" ? eventData.society_hub : eventData.society_hub?.name || "Onton";

  const attributes =
    eventData.society_hub && societyHubValue ? [{ trait_type: "Organizer", value: societyHubValue }] : undefined;

  // 6) Call Ton Society to create user reward link (using ticket_activity_id!)
  const res = await createUserRewardLink(paymentInfo.ticketActivityId, {
    telegram_user_id: user_id,
    attributes,
  });

  if (!res?.data?.data) {
    logger.error("Failed to create user reward link: response was empty");
    throw new Error("Failed to create user reward link.");
  }

  // 7) Insert the reward into the DB
  await rewardDB.insertRewardWithData(
    visitor.id,
    user_id.toString(),
    "ton_society_csbt_ticket", // Reward type
    res.data.data,
    "created"
  );

  logger.log(`CSBT Ticket reward created for user=${user_id}, event=${event_uuid}`);

  return res.data.data;
}

export const CsbtTicketForApi = async (event_uuid: string, user_id: number) => {
  // 1) Make sure there's a Visitor record
  const visitor = await visitorsDB.addVisitor(user_id, event_uuid);
  const eventData = await eventDB.selectEventByUuid(event_uuid);
  if (!eventData || !eventData.activity_id) {
    logger.error("CsbtTicketRewardService eventData or activity_id is null");
    // In a normal CsbtTicket, we'd throw. But let's do so here as well:
    throw new Error("CsbtTicketRewardService eventData or activity_id is null");
  }
  if (!visitor) {
    logger.error(`CsbtTicketRewardService: Visitor not found for user ${user_id} and event ${event_uuid}`);
    throw new Error(`Visitor not found for user ${user_id} and event ${event_uuid}`);
  }
  const paymentInfo = await eventPaymentDB.fetchPaymentInfoForCronjob(event_uuid);

  if (!paymentInfo) {
    logger.error(`CsbtTicketRewardService: No payment info found for event ${event_uuid}`);
    throw new Error(`No payment info found for event ${event_uuid}`);
  }
  if (paymentInfo.ticket_type !== "TSCSBT") {
    logger.error(`CsbtTicketRewardService: Event is not TSCSBT ${event_uuid}`);
    throw new Error("Event is not TSCSBT");
  }
  if (!paymentInfo.ticketActivityId) {
    logger.error(`CsbtTicketRewardService: Missing ticket_activity_id for TSCSBT event ${event_uuid}`);
    throw new Error("Missing ticket_activity_id for TSCSBT event");
  }
  // 2) Check if a reward already exists for this visitor
  const existingReward = await rewardDB.checkExistingRewardWithType(visitor.id, "ton_society_csbt_ticket");
  if (existingReward) {
    // If there's already a reward, we do nothing further
    logger.info(`Reward already exists for visitor ${visitor.id}, skipping creation.`);
    return existingReward.data; // Return the existing reward data
  }

  // Prepare the "Organizer" trait
  const society_hub_value =
    typeof eventData.society_hub === "string" ? eventData.society_hub : eventData.society_hub?.name || "Onton";

  while (true) {
    // Brief delay between attempts to avoid spamming the API
    await sleep(20);

    try {
      // 4) Call your external API to create the user reward link
      const response = await createUserRewardLink(paymentInfo.ticketActivityId, {
        telegram_user_id: user_id,
        attributes: [
          {
            trait_type: "Organizer",
            value: society_hub_value,
          },
        ],
      });

      // Make sure it's valid
      if (!response?.data?.data) {
        throw new Error("Failed to create user reward link: No 'data' returned.");
      }

      // 5) Insert the newly created reward into your DB
      await db
        .insert(rewards)
        .values({
          visitor_id: visitor.id,
          type: "ton_society_csbt_ticket",
          data: response.data.data as RewardDataTyepe,
          event_end_date: eventData?.end_date!,
          event_start_date: eventData?.start_date!,
          status: "created",
          updatedBy: user_id.toString(),
          tonSocietyStatus: "NOT_CLAIMED",
        })
        .returning()
        .execute();
      logger.info(`CSBT Ticket created successfully for user ${user_id}.`);
      return response.data.data; // Return the reward link data
    } catch (error) {
      console.error("Error creating CSBT ticket reward:", error);
      try {
        await db
          .insert(rewards)
          .values({
            visitor_id: visitor.id,
            type: "ton_society_csbt_ticket",
            data: null,
            event_end_date: eventData?.end_date!,
            event_start_date: eventData?.start_date!,
            status: "pending_creation",
            updatedBy: user_id.toString(),
            tonSocietyStatus: "NOT_CLAIMED",
          })
          .returning()
          .execute();
        break;
      } catch (insertErr) {
        // If even that fails, just log it
        logger.error("Error inserting pending creation reward record", insertErr);
      }
    }
  }
};
const createTonSocietySBTReward = async (event_uuid: string, user_id: number) => {
  try {
    // 1. Fetch event & user from DB
    const eventData = await eventDB.fetchEventByUuid(event_uuid);
    const userData = await usersDB.selectUserById(user_id);

    // 2. Validate event & user
    if (!eventData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Event not found",
      });
    }
    if (!userData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    validateEventActivityId(eventData);
    validateEventDateRange(eventData);

    // 3. Validate registration / tasks if needed
    await validateRegistrationIfNeeded(eventData, userData);
    await validateTaskCompletionIfNeeded(eventData, userData.user_id);

    // 4. Ensure visitor is created
    const visitor = await visitorsDB.addVisitor(userData.user_id, eventData.event_uuid);

    if (!visitor) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Visitor not found with the provided user ID and event UUID.",
      });
    }

    // 5. Check existing reward
    const existingReward = await rewardDB.checkExistingRewardWithType(visitor.id as number, "ton_society_sbt");

    // No existing reward → Insert and let user wait for creation
    if (!existingReward) {
      await rewardDB.insertRewardRow(visitor.id, null, userData.user_id, "ton_society_sbt", "pending_creation", eventData);

      return {
        type: "wait_for_reward",
        message: "We successfully collected your data; you'll receive your reward link through a bot message.",
        data: null,
      } as const;
    }

    // Reward exists but is still pending → Return waiting state
    if (existingReward.status === "pending_creation") {
      return {
        type: "wait_for_reward",
        message: "We successfully collected your data; you'll receive your reward link through a bot message.",
        data: null,
      } as const;
    }

    // Reward exists and presumably has data
    if (existingReward.data) {
      const dataValidation = rewardLinkZod.safeParse(existingReward.data);
      if (!dataValidation.success) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Reward data is invalid: ${JSON.stringify(existingReward.data)}`,
        });
      }

      return {
        ...existingReward,
        data: dataValidation.data.reward_link,
        type: "reward_link_generated",
      } as const;
    }

    // Fallback in case there's an edge scenario not covered above
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Reward found but invalid state or data.",
    });
  } catch (error) {
    logger.error("Error in getVisitorReward query:", error);
    if (error instanceof TRPCError) {
      throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred while retrieving visitor reward.",
    });
  }
};
const rewardService = {
  createUserRewardSBT,
  CsbtTicketForApi,
  createTonSocietySBTReward,
};

export default rewardService;
