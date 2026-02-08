import { NonVerifiedHubsIds } from "@/constants";
import { db } from "@/db/db";
import eventCategoriesDB from "@/db/modules/eventCategories.db";
import eventFieldsDB from "@/db/modules/eventFields.db";
import { eventRegistrantsDB } from "@/db/modules/eventRegistrants.db";
import eventDB from "@/db/modules/events.db";
import eventTokensDB from "@/db/modules/eventTokens.db";
import { organizerTsVerified, userHasModerationAccess } from "@/db/modules/userFlags.db";
import { userRolesDB } from "@/db/modules/userRoles.db";
import { getUserCacheKey, usersDB } from "@/db/modules/users.db";
import { EventCategoryRow, eventFields, eventPayment, events, orders } from "@/db/schema";
import { EventPaymentSelectType } from "@/db/schema/eventPayment";
import { EventTokenRow } from "@/db/schema/eventTokens";
import { hashPassword } from "@/lib/bcrypt";
import { timestampToIsoString } from "@/lib/DateAndTime";
import { redisTools } from "@/lib/redisTools";
import {
  getEventsChannelBotInstance,
  renderAddEventMessage,
  renderModerationEventMessage,
  renderModerationFlowup,
  renderUpdateEventMessage,
  sendLogNotification,
  sendToEventsTgChannel,
} from "@/lib/tgBot";
import { registerActivity, tonSocietyClient, updateActivity } from "@/lib/ton-society-api";
import { getObjectDifference, removeKey } from "@/lib/utils";
import { tgBotModerationMenu } from "@/moderationBot/menu";
import { logger } from "@/server/utils/logger";
import { CreateTonSocietyDraft } from "@/services/tonSocietyService";
import { EventDataSchema, UpdateEventDataSchema } from "@/types";
import { TonSocietyRegisterActivityT } from "@/types/event.types";
import searchEventsInputZod from "@/zodSchema/searchEventsInputZod";
import { TRPCError } from "@trpc/server";
import dotenv from "dotenv";
import { and, eq, ne } from "drizzle-orm";
import { Bot } from "grammy";
import { Message } from "grammy/types";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { config, configProtected } from "../config";
import {
  adminOrganizerProtectedProcedure,
  eventManagementProtectedProcedure as eventManagerPP,
  initDataProtectedProcedure,
  router,
} from "../trpc";
import { internal_server_error } from "../utils/error_utils";

dotenv.config();

const getEvent = initDataProtectedProcedure.input(z.object({ event_uuid: z.string() })).query(async (opts) => {
  const userId = opts.ctx.user.user_id;
  const userRole = opts.ctx.user.role;
  const event_uuid = opts.input.event_uuid;
  type PaymentDetailsWithToken = Partial<EventPaymentSelectType & { token?: EventTokenRow | null }>;

  let eventData = {
    payment_details: {} as PaymentDetailsWithToken,
    category: {} as EventCategoryRow,
    ...(await eventDB.selectEventByUuid(event_uuid)),
  };
  let capacity_filled = false;
  let registrant_status: "pending" | "rejected" | "approved" | "checkedin" | "" = "";
  let registrant_uuid = "";

  if (!eventData.event_id) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "event not found",
    });
  }

  //update sbt_collection_address from ton-society if not exists
  await eventDB.updateEventSbtCollection(
    eventData.start_date,
    eventData.end_date,
    eventData.activity_id,
    eventData.sbt_collection_address,
    eventData.event_uuid
  );

  //If event is hidden or not enabled
  if (eventData.hidden || !eventData.enabled) {
    if (userId !== eventData.owner && userRole !== "admin" && !(await userHasModerationAccess(userId, userRole))) {
      throw new TRPCError({ code: "UNPROCESSABLE_CONTENT", message: "event is not published yet" });
    }
  }
  // If event is not enabled, we don't need to fetch the category
  if (eventData.category_id) {
    const fetchedCategory = await eventCategoriesDB.fetchCategoryById(eventData.category_id);
    if (fetchedCategory) {
      eventData.category = fetchedCategory;
    }
  }
  //    Fetch user data for event owner
  //    We'll rename org_* fields to 'organizer: { ... }' in the returned object.
  const ownerUserId = eventData.owner; // This is the user_id who created the event
  const ownerUser = await usersDB.selectUserById(Number(ownerUserId));
  const is_ts_verified = await organizerTsVerified(Number(ownerUserId));

  // Build an organizer object with the org_* fields (or null if no user found)
  const organizer = ownerUser
    ? {
        org_channel_name:
          ownerUser.org_channel_name === null
            ? `${ownerUser.first_name} ${ownerUser.last_name}`
            : ownerUser.org_channel_name,
        org_support_telegram_user_name: ownerUser.org_support_telegram_user_name,
        org_x_link: ownerUser.org_x_link,
        org_bio: ownerUser.org_bio,
        org_image: ownerUser.org_image === null ? ownerUser.photo_url : ownerUser.org_image,
        user_id: ownerUser.user_id,
        username: ownerUser.username,
        first_name: ownerUser.first_name,
        hosted_event_count: ownerUser.hosted_event_count,
        is_ts_verified,
      }
    : null;

  const accessData = await userRolesDB.listActiveUserRolesForEvent("event", Number(eventData.event_id));
  const accessRoles = accessData.map(({ userId, role }) => ({
    user_id: userId,
    role: role,
  }));

  const registrationFromSchema = {
    // isCustom: await userFlagsDB.checkUserCustomFlagBoolean(eventData.owner!, "custom_registration_1"),
    isCustom: true,
  };

  // If the event does NOT require registration, just return data
  if (!eventData.has_registration) {
    return {
      capacity_filled,
      registrant_status,
      organizer,
      registrationFromSchema,
      accessRoles,
      ...eventData,
      registrant_uuid,
    };
  }
  /* ------------------------ Event Needs Registration ------------------------ */

  const user_request = await eventRegistrantsDB.getRegistrantRequest(event_uuid, userId);

  const userIsAdminOrOwner = eventData.owner == userId || userRole == "admin";
  let mask_event_capacity = !userIsAdminOrOwner;

  if (userIsAdminOrOwner) {
    //event payment info
    if (eventData.has_payment) {
      const payment_details = (
        await db.select().from(eventPayment).where(eq(eventPayment.event_uuid, event_uuid)).execute()
      ).pop();
      if (!payment_details) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Event Payment Data Not found (Corrupted Event)",
        });
      }
      const token = await eventTokensDB.getTokenById(payment_details.token_id);
      eventData.payment_details = {
        ...payment_details,
        token,
      };
    }
  }

  if (!user_request && !userIsAdminOrOwner && eventData.participationType === "online" && eventData.has_registration) {
    eventData.location = "visible after registration";
    logger.log("eventData", eventData);
    logger.log("user_request", user_request);
  }
  if (user_request) {
    // Registrant Already has a request
    registrant_status = user_request.status;
    if (registrant_status === "approved" || registrant_status === "checkedin") {
      registrant_uuid = user_request.registrant_uuid;
    }
    // avoid showing the location to the user if the event is online and the user is not approved
    if (
      !(user_request.status === "approved" || user_request.status === "checkedin") &&
      !userIsAdminOrOwner &&
      eventData.participationType === "online" &&
      eventData.has_registration
    ) {
      eventData.location = "visible after approval";
    }
    return {
      capacity_filled,
      registrant_status,
      organizer,
      registrationFromSchema,
      accessRoles,
      ...eventData,
      registrant_uuid,
      capacity: mask_event_capacity ? 99 : eventData.capacity,
    };
  }

  // no status for registrant
  if (eventData.capacity) {
    const approved_requests_count = await eventRegistrantsDB.getApprovedRequestsCount(event_uuid);
    if (approved_requests_count >= eventData.capacity) {
      // Event capacity filled
      capacity_filled = true;
      return {
        capacity_filled,
        registrant_status,
        organizer,
        registrationFromSchema,
        accessRoles,
        ...eventData,
        registrant_uuid,
        capacity: mask_event_capacity ? 99 : eventData.capacity,
      };
    }
  }

  // NO Status
  return {
    capacity_filled,
    registrant_status,
    organizer,
    registrationFromSchema,
    accessRoles,
    ...eventData,
    registrant_uuid,
    capacity: mask_event_capacity ? 99 : eventData.capacity,
  };
});

const listPaymentTokens = adminOrganizerProtectedProcedure.query(async () => {
  const tokens = await eventTokensDB.listTokens();
  return tokens.map((token) => ({
    token_id: token.token_id,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    master_address: token.master_address,
    is_native: token.is_native,
    logo_url: token.logo_url,
  }));
});

/* -------------------------------------------------------------------------- */
/*                                  🆕Add Event🆕                            */
/* -------------------------------------------------------------------------- */
// private
const addEvent = adminOrganizerProtectedProcedure.input(z.object({ eventData: EventDataSchema })).mutation(async (opts) => {
  const input_event_data = opts.input.eventData;

  const user_id = opts.ctx.user.user_id;
  const userCacheKey = getUserCacheKey(user_id);
  const is_ts_verified = await organizerTsVerified(user_id);
  if (!is_ts_verified && !NonVerifiedHubsIds.includes(input_event_data.society_hub.id))
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid HUBS for non verified organizer" });
  const category = await eventCategoriesDB.fetchCategoryById(input_event_data.category_id);
  if (!category || !category.enabled) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or disabled category" });
  }
  try {
    const result = await db.transaction(async (trx) => {
      const event_has_payment = input_event_data.paid_event && input_event_data.paid_event.has_payment;
      const event_in_person = input_event_data.eventLocationType === "in_person";
      let hashedSecretPhrase = undefined;
      let inputSecretPhrase = undefined;
      if (!event_in_person && input_event_data?.secret_phrase) {
        inputSecretPhrase = input_event_data?.secret_phrase.trim().toLowerCase();
        hashedSecretPhrase = Boolean(inputSecretPhrase) ? await hashPassword(inputSecretPhrase) : undefined;
        if (!hashedSecretPhrase) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid secret phrase" });
      }
      /* ------------------------------ Invalid Dates ----------------------------- */
      if (!input_event_data.end_date || !input_event_data.start_date) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid start-date/end-date" });
      }

      /* ------------------- paid events must have registration ------------------- */
      input_event_data.has_registration = event_has_payment ? true : input_event_data.has_registration;
      const is_paid = !!input_event_data.paid_event?.has_payment;
      if (is_paid && !config?.ONTON_WALLET_ADDRESS) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ONTON_WALLET_ADDRESS NOT SET error" });
      }

      const event_should_hidden = await eventDB.shouldEventBeHidden(is_paid, user_id);

      const newEvent = await trx
        .insert(events)
        .values({
          category_id: input_event_data.category_id,
          type: input_event_data.type,
          event_uuid: uuidv4(),
          title: input_event_data.title,
          subtitle: input_event_data.subtitle,
          description: input_event_data.description,
          image_url: input_event_data.image_url,
          society_hub: input_event_data.society_hub.name,
          society_hub_id: input_event_data.society_hub.id,
          secret_phrase: hashedSecretPhrase,
          start_date: input_event_data.start_date,
          end_date: input_event_data.end_date,
          timezone: input_event_data.timezone,
          location: input_event_data.location,
          owner: user_id,
          participationType: input_event_data.eventLocationType, // right now paid event only can be in_person
          countryId: input_event_data.countryId,
          tsRewardImage: input_event_data.ts_reward_url,
          tsRewardVideo: input_event_data.video_url,
          cityId: input_event_data.cityId,
          /* --------------------------- Event Registration --------------------------- */
          has_registration: input_event_data.has_registration,
          has_approval: input_event_data.has_approval,
          capacity: input_event_data.capacity,
          has_waiting_list: input_event_data.has_waiting_list,

          /* -------------------------- Publish Event Or Not -------------------------- */
          enabled: true,
          hidden: event_should_hidden,
          /* ------------------------------- Paid Event ------------------------------- */
          has_payment: is_paid,
          ticketToCheckIn: is_paid, // Duplicated Column same as has_payment 😐
          wallet_address: is_paid ? config?.ONTON_WALLET_ADDRESS : null,
          /* ------------------------------- Paid Event ------------------------------- */
        })
        .returning();

      const eventData = newEvent[0];
      /* -------------------------------------------------------------------------- */
      /*                     Paid Event : Insert Payment Details                    */
      /* -------------------------------------------------------------------------- */

      if (input_event_data.paid_event && event_has_payment) {
        if (!input_event_data.capacity)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Capacity Required for paid events" });

        if (opts.input.eventData?.paid_event?.ticket_type === undefined)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket Type Required for paid events" });

        const tokenId = input_event_data.paid_event.token_id;
        if (tokenId === undefined)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Payment token required for paid events" });

        const paymentToken = await eventTokensDB.getTokenById(tokenId);
        if (!paymentToken)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown payment token selected" });

        const ticketType = opts.input.eventData?.paid_event?.ticket_type;
        const order_price = eventDB.getPaidEventPrice(input_event_data.capacity, ticketType);

        const tonToken = await eventTokensDB.getTokenBySymbol("TON");
        if (!tonToken) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TON token not configured" });

        await trx.insert(orders).values({
          event_uuid: eventData.event_uuid,
          user_id: user_id,
          total_price: order_price,
          token_id: tonToken.token_id,
          state: "new",
          order_type: "event_creation",
          owner_address: "",
        });

        let event_ticket_price = Math.max(input_event_data.paid_event.payment_amount || 0, 0.001); // Price > 0.001
        event_ticket_price = Math.round(event_ticket_price * 1000) / 1000; // Round to 3 Decimals
        event_ticket_price = event_ticket_price || 0.001;

        await trx.insert(eventPayment).values({
          event_uuid: newEvent[0].event_uuid,
          /* -------------------------------------------------------------------------- */
          token_id: paymentToken.token_id,
          price: event_ticket_price,
          recipient_address: input_event_data.paid_event.payment_recipient_address,
          bought_capacity: input_event_data.capacity,
          /* -------------------------------------------------------------------------- */
          ticket_type: ticketType,
          ticketImage: input_event_data.paid_event.nft_image_url,
          ticketVideo: input_event_data.paid_event.nft_video_url,
          title: input_event_data.paid_event.nft_title,
          description: input_event_data.paid_event.nft_description,
          collectionAddress: null,
        });
      }

      // Insert dynamic fields
      for (let i = 0; i < input_event_data.dynamic_fields.length; i++) {
        const field = input_event_data.dynamic_fields[i];
        await eventFieldsDB.insertEventField(trx, {
          emoji: field.emoji,
          title: field.title,
          description: field.description,
          placeholder: field.type === "button" ? field.url : field.placeholder,
          type: field.type,
          order_place: i,
          event_id: newEvent[0].event_id,
          updatedBy: user_id.toString(),
        });
      }

      // Insert secret phrase field if applicable
      if (!event_in_person && input_event_data?.secret_phrase && input_event_data?.secret_phrase && inputSecretPhrase) {
        await eventFieldsDB.insertEventField(trx, {
          emoji: "🔒",
          title: "secret_phrase_onton_input",
          description: "Enter the event password",
          placeholder: "Enter the event password",
          type: "input",
          order_place: input_event_data.dynamic_fields.length,
          event_id: newEvent[0].event_id,
          updatedBy: user_id.toString(),
        });
      }

      const eventDraft = await CreateTonSocietyDraft(input_event_data, eventData.event_uuid);

      logger.log("eventDraft", JSON.stringify(eventDraft));
      logger.log("eventData", eventData);

      // Clear the organizer user cache so it will be reloaded next time
      await redisTools.deleteCache(userCacheKey);

      // Skip Register to ts if :
      //  local development  || paid event registers organizer pays initial payment || org must be verified
      const register_to_ts = !event_should_hidden;

      // IN CASE OF ERROR ROLLBACK
      // WE WILL USE THESE IDS TO DELETE THEM
      let tsActivityId: number | undefined = undefined;
      const sentTelegramMsgs: Message[] = [];

      /**
       * THIRD PARTY REQUESTS
       * in case of failures we will rollback the requests by deleting the
       * created activity and msgs
       */
      try {
        if (register_to_ts) {
          const res = await registerActivity(eventDraft);
          tsActivityId = res.data.activity_id;

          await trx
            .update(events)
            .set({
              activity_id: res.data.activity_id,
              updatedBy: user_id.toString(),
              updatedAt: new Date(),
            })
            .where(eq(events.event_uuid, newEvent[0].event_uuid as string))
            .execute();
        }

        /* ------------- Generate the message using the render function ------------- */
        if (is_ts_verified && !is_paid) {
          /* -------------------------- Just Send The Message ------------------------- */
          const logMessage = renderAddEventMessage(opts.ctx.user.username || user_id, eventData);

          const notificationMsg = await sendLogNotification({
            message: logMessage,
            topic: "event",
          });
          sentTelegramMsgs.push(notificationMsg);

          const eventsMsg = await sendToEventsTgChannel({
            image: eventData.image_url,
            title: eventData.title,
            subtitle: eventData.subtitle,
            s_date: eventData.start_date,
            e_date: eventData.end_date,
            timezone: eventData.timezone,
            event_uuid: eventData.event_uuid,
            participationType: eventData.participationType,
          });

          eventsMsg && sentTelegramMsgs.push(eventsMsg);
        } else if (!is_paid) {
          /* --------------------------- Moderation Message --------------------------- */

          const moderation_group_id = configProtected?.moderation_group_id;
          const logMessage = await renderModerationEventMessage(opts.ctx.user.username || user_id, eventData);

          // SEND MESSAGE TO TELEGRAM MODERATION GROUP
          const moderationMessageResult = await sendLogNotification({
            group_id: moderation_group_id,
            image: eventData.image_url,
            message: logMessage,
            topic: "no_topic",
            inline_keyboard: tgBotModerationMenu(eventData.event_uuid),
            media_group: [
              { type: "photo", url: eventData.tsRewardImage!! },
              {
                type: "video",
                url: eventData.tsRewardVideo!!,
              },
            ],
          });

          await trx
            .update(events)
            .set({ moderationMessageId: moderationMessageResult.message_id })
            .where(eq(events.event_id, eventData.event_id))
            .execute();

          sentTelegramMsgs.push(moderationMessageResult);

          logger.log(
            `moderationMessageResult: for ${eventData.event_id} ${eventData.event_uuid} with message_id ${moderationMessageResult.message_id}`
          );
        }
      } catch (error) {
        // ❄ THIRD PARTY CLEANUP ❄
        // rollback thirdparty requests

        // remove activity
        if (tsActivityId) {
          try {
            await tonSocietyClient.delete("/activities/" + tsActivityId);
          } catch (error) {
            // if failed do nothing
            logger.error(`error_while_deleting_activity`, error);
          }
        }

        try {
          let { bot_token_logs: BOT_TOKEN_LOGS } = configProtected;
          const tgEventsBot = await getEventsChannelBotInstance();
          const tgLogsBot = BOT_TOKEN_LOGS && new Bot(BOT_TOKEN_LOGS);
          // remove messages
          for (const msg of sentTelegramMsgs) {
            try {
              if (msg.chat.id === Number(configProtected.events_channel)) {
                await tgEventsBot.api.deleteMessage(msg.chat.id, msg.message_id);
              } else {
                if (tgLogsBot) {
                  await tgLogsBot.api.deleteMessage(msg.chat.id, msg.message_id);
                }
              }
            } catch (error) {
              logger.error(`error_while_deleting_message`, error);
            }
          }
        } catch (error) {
          logger.error(`error_while_creating_bot_instances_for_delete`, error);
        }

        throw error;
      }

      return newEvent;
    });

    return {
      success: true,
      eventId: result[0].event_id,
      eventHash: result[0].event_uuid,
    } as const;
  } catch (error) {
    logger.error(`error_while_adding_event`, error);
    if (error instanceof TRPCError) {
      throw error;
    }
    internal_server_error(error, "Internal Error while adding event");
  }
});

/* -------------------------------------------------------------------------- */
/*                                🐳🦞Update Event🐳🦞                      */
/* -------------------------------------------------------------------------- */

const updateEvent = eventManagerPP
  .input(
    z.object({
      eventData: UpdateEventDataSchema,
    })
  )
  .mutation(async (opts) => {
    const eventData = opts.input.eventData;
    const eventUuid = opts.ctx.event.event_uuid;
    const eventId = opts.ctx.event.event_id;
    const user_id = opts.ctx.user.user_id;
    const category = await eventCategoriesDB.fetchCategoryById(eventData.category_id);
    if (!category || !category.enabled) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or disabled category" });
    }

    try {
      return await db.transaction(async (trx) => {
        const inputSecretPhrase = eventData.secret_phrase ? eventData.secret_phrase.trim().toLowerCase() : undefined;
        const hashedSecretPhrase = inputSecretPhrase ? await hashPassword(inputSecretPhrase) : undefined;
        const oldEvent = (await trx.select().from(events).where(eq(events.event_uuid, eventUuid!)).execute()).pop();

        if (!oldEvent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Old Event Not Found",
          });
        }

        const canUpdateRegistrationSetting = oldEvent.has_registration;
        const is_paid = oldEvent.has_payment;
        const is_ts_verified = await organizerTsVerified(user_id);
        const canSendModerationMessage = Boolean(
          oldEvent.moderationMessageId && !is_paid && !is_ts_verified && !oldEvent.activity_id
        );

        /* -------------------------------------------------------------------------- */
        /*                                 Paid Event                                 */
        /* -------------------------------------------------------------------------- */
        //can't have capacity null if it's paid event
        //should create order for increasing capacity
        if (oldEvent.has_payment) {
          /* -------------------------------------------------------------------------- */
          //can't have capacity null if it's paid event
          if (!eventData.capacity)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Paid Events Must have capacity",
            });

          /* -------------------------------------------------------------------------- */
          const paymentInfo = (
            await trx.select().from(eventPayment).where(eq(eventPayment.event_uuid, eventUuid)).execute()
          ).pop();

          if (!paymentInfo)
            throw new TRPCError({ code: "BAD_REQUEST", message: `error: paymentInfo not found for ${eventUuid}` });
          if (paymentInfo.ticket_type === undefined) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Ticket Type Required for paid events" });
          }
          // Update Create Order If Event is not published yet
          if (!oldEvent.enabled && eventData.capacity < paymentInfo!.bought_capacity) {
            const where_condition = and(
              eq(orders.event_uuid, eventUuid),
              eq(orders.order_type, "event_creation"),
              ne(orders.state, "processing"),
              ne(orders.state, "completed")
            );
            const createEventOrder = await trx.query.orders.findFirst({ where: where_condition });
            const ticketType = paymentInfo.ticket_type;
            if (createEventOrder) {
              await trx
                .update(orders)
                .set({ total_price: eventDB.getPaidEventPrice(eventData.capacity, ticketType) })
                .where(where_condition)
                .execute();
              await trx.update(eventPayment).set({ bought_capacity: eventData.capacity });
            }
          }

          /* ------------------- Create Order For Increase Capacity ------------------- */
          if (eventData.capacity > paymentInfo!.bought_capacity) {
            const tonToken = await eventTokensDB.getTokenBySymbol("TON");
            if (!tonToken) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TON token not configured" });
            // Increase in event capacity
            // create an update_capacity_order if not exists otherwise just update it
            const update_order = (
              await trx
                .select()
                .from(orders)
                .where(and(eq(orders.event_uuid, eventUuid), eq(orders.order_type, "event_capacity_increment")))
                .execute()
            ).pop();
            /* -------------------- update order exists and its paid -------------------- */
            if (update_order && update_order.state == "processing") {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "You Already have a Paid Capacity Update pending ... please try again in few minutes ",
              });
            }
            /* -------------------------------------------------------------------------- */
            /* ---------------------------- Update OR Insert ---------------------------- */
            const upsert_data = {
              event_uuid: eventUuid,
              order_type: "event_capacity_increment" as const,
              state: "new" as const,
              token_id: tonToken.token_id,
              total_price: 0.06 * (eventData.capacity - paymentInfo!.bought_capacity),
              user_id: user_id,
            };
            if (update_order && (update_order.state === "new" || update_order.state === "confirming")) {
              await trx.update(orders).set(upsert_data).where(eq(orders.uuid, update_order.uuid));
            } else {
              await trx.insert(orders).values(upsert_data);
            }
            //can't update capacity unless organizer pays
            eventData.capacity = oldEvent.capacity!;
          }
        }

        const updatedEvent = await trx
          .update(events)
          .set({
            category_id: eventData.category_id,
            type: eventData.type,
            title: eventData.title,
            subtitle: eventData.subtitle,
            description: eventData.description,
            image_url: eventData.image_url,
            society_hub: eventData.society_hub.name,
            society_hub_id: eventData.society_hub.id,
            secret_phrase: hashedSecretPhrase,
            start_date: eventData.start_date,
            end_date: eventData.end_date,
            location: eventData.location,
            participationType: eventData.eventLocationType,
            timezone: eventData.timezone,
            countryId: eventData.countryId,
            cityId: eventData.cityId,
            updatedBy: opts.ctx.user.user_id.toString(),
            updatedAt: new Date(),

            /* ------------------------ Event Registration Update ----------------------- */
            // Updating has_registration is not allowed
            has_approval: canUpdateRegistrationSetting ? eventData.has_approval : false,
            capacity: canUpdateRegistrationSetting ? eventData.capacity : null,
            has_waiting_list: canUpdateRegistrationSetting ? eventData.has_waiting_list : false,
            /* ------------------------ Event Registration Update ----------------------- */
          })
          .where(eq(events.event_uuid, eventUuid))
          .returning()
          .execute();

        await eventDB.deleteEventCache(eventUuid);
        if (canSendModerationMessage) {
          const followUpText = renderModerationFlowup(opts.ctx.user.username || opts.ctx.user.user_id);
          const moderation_group_id = configProtected?.moderation_group_id;
          try {
            const moderationMessageResponse = await sendLogNotification({
              group_id: moderation_group_id,
              message: followUpText,
              topic: "event",
              reply_to_message_id: oldEvent.moderationMessageId,
            });
            logger.log(
              `moderationMessage for ${eventUuid} with message_id ${moderationMessageResponse.message_id} was sent`
            );
          } catch (error) {
            logger.log(
              `error_while_sending_moderation_followup THE ADD EVENT MESSAGE WAS DELETED FOR ${eventUuid} AND ${oldEvent.moderationMessageId}`
            );

            const logMessage = await renderModerationEventMessage(opts.ctx.user.username || user_id, oldEvent, false);
            const moderationMessageResult = await sendLogNotification({
              group_id: moderation_group_id,
              image: eventData.image_url,
              message: logMessage,
              topic: "no_topic",
              inline_keyboard: tgBotModerationMenu(oldEvent.event_uuid),
              media_group: [
                { type: "photo", url: eventData.ts_reward_url!! },
                {
                  type: "video",
                  url: eventData.video_url!!,
                },
              ],
            });
            await trx
              .update(events)
              .set({ moderationMessageId: moderationMessageResult.message_id })
              .where(eq(events.event_id, oldEvent.event_id))
              .execute();
            logger.log(
              `moderationMessageResult_NEW_FOR_UPDATED: for ${oldEvent.event_id} ${oldEvent.event_uuid} with message_id ${moderationMessageResult.message_id}`
            );
          }
        }
        //Only recipient_address and price can be updated
        if (eventData.paid_event?.has_payment && oldEvent.has_payment) {
          let price = Math.max(eventData.paid_event.payment_amount || 0, 0.001); // Price > 0.001
          price = Math.round(price * 1000) / 1000; // Round to 3 Decimals

          await trx
            .update(eventPayment)
            .set({
              recipient_address: eventData.paid_event.payment_recipient_address,
              price: price,
            })
            .where(eq(eventPayment.event_uuid, oldEvent.event_uuid));
        }

        const currentFields = await eventFieldsDB.selectEventFieldsByEventId(trx, eventId!);

        const fieldsToDelete = currentFields.filter(
          (field) =>
            !eventData.dynamic_fields.some((newField) => newField.id === field.id) &&
            field.title !== "secret_phrase_onton_input"
        );

        for (const field of fieldsToDelete) {
          await eventFieldsDB.deleteEventFieldById(trx, field.id, eventId!);
        }

        const secretPhraseTask = await trx
          .select()
          .from(eventFields)
          .where(and(eq(eventFields.event_id, eventId!), eq(eventFields.title, "secret_phrase_onton_input")))
          .execute();

        if (hashedSecretPhrase || (hashedSecretPhrase === undefined && oldEvent.ticketToCheckIn === false)) {
          if (secretPhraseTask.length > 0) {
            // Update the existing secret phrase task
            await eventFieldsDB.updateEventFieldLog(trx, secretPhraseTask[0].id, opts.ctx.user.user_id.toString());
          } else {
            // Insert a new secret phrase task
            await eventFieldsDB.insertEventField(trx, {
              emoji: "🔒",
              title: "secret_phrase_onton_input",
              description: "Enter the event password",
              placeholder: "Enter the event password",
              type: "input",
              order_place: eventData.dynamic_fields.length,
              event_id: eventId,
              updatedBy: opts.ctx.user.user_id.toString(),
            });
          }
        }

        for (const [index, field] of eventData.dynamic_fields
          .filter((f) => f.title !== "secret_phrase_onton_input")
          .entries()) {
          await eventFieldsDB.upsertEventField(trx, field, index, opts.ctx.user.user_id.toString(), eventId);
        }

        const additional_info = z.string().url().safeParse(eventData).success ? "Online" : opts.input.eventData.location;

        const eventDraft: TonSocietyRegisterActivityT = {
          title: eventData.title,
          subtitle: eventData.subtitle,
          description: eventData.description,
          hub_id: parseInt(eventData.society_hub.id),
          start_date: timestampToIsoString(eventData.start_date),
          end_date: timestampToIsoString(eventData.end_date!),
          additional_info,
          cta_button: {
            link: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}`,
            label: "Enter Event",
          },
        };

        // Remove the description key from updated Event
        const updatedEventWithoutDescription = removeKey(updatedEvent[0], "description");
        // Remove the description key from old Event
        const oldEventWithoutDescription = removeKey(oldEvent, "description");

        const oldChanges = getObjectDifference(updatedEventWithoutDescription, oldEventWithoutDescription);

        const updateChanges = getObjectDifference(updatedEventWithoutDescription, oldEventWithoutDescription);

        // if it was a fully local setup we don't want to update the activity_id
        if (process.env.ENV !== "local" && oldEvent.activity_id) {
          try {
            await updateActivity(eventDraft, opts.ctx.event.activity_id as number);
          } catch (error) {
            logger.log("update_event_ton_society_failed", JSON.stringify(eventDraft));

            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to update ton Society activity_id : ${opts.ctx.event.activity_id}`,
            });
          }
        }

        /* -------------------------------------------------------------------------- */
        /*   If this is a paid event with TSCSBT ticket, also update the ticket's    */
        /*   separate activity. (We assume there's a ticket_activity_id to update.)  */
        /* -------------------------------------------------------------------------- */
        if (oldEvent.has_payment) {
          // fetch the updated payment info
          const [updatedPaymentInfo] = await trx
            .select()
            .from(eventPayment)
            .where(eq(eventPayment.event_uuid, eventUuid))
            .execute();

          if (updatedPaymentInfo && updatedPaymentInfo.ticket_type === "TSCSBT" && updatedPaymentInfo.ticketActivityId) {
            // Build a separate ticketDraft if you need different data for the ticket
            // For now, reusing the updated event data
            const nowInSeconds = Math.floor(Date.now() / 1000);
            const ticketDraft: TonSocietyRegisterActivityT = {
              ...eventDraft,
              title: updatedPaymentInfo.title ?? `${eventData.title} - Ticket`,
              subtitle: updatedPaymentInfo.description ?? eventData.subtitle,
              start_date: timestampToIsoString(nowInSeconds),
              end_date: timestampToIsoString(eventData.end_date),
            };

            try {
              logger.log(
                `Updating TSCSBT ticket activity: ID ${updatedPaymentInfo.ticketActivityId} for event ${eventUuid} and ticket ${updatedPaymentInfo.id}`,
                ticketDraft
              );
              if (process.env.ENV !== "local") {
                await updateActivity(ticketDraft, updatedPaymentInfo.ticketActivityId);
              }

              logger.log(`TSCSBT ticket activity updated: ID ${updatedPaymentInfo.ticketActivityId}`);
            } catch (error) {
              logger.log("update_ts_csbt_activity_failed", JSON.stringify(ticketDraft));
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to update TSCSBT ticket activity_id: ${updatedPaymentInfo.ticketActivityId}`,
              });
            }
          } else if (
            updatedPaymentInfo &&
            updatedPaymentInfo.ticket_type === "TSCSBT" &&
            !updatedPaymentInfo.ticketActivityId
          ) {
            logger.log(`No ticketActivityId found for TSCSBT ticket in event ${eventUuid}`);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `No ticketActivityId found for TSCSBT ticket in event ${eventUuid}`,
            });
          }
        }
        const logMessage = renderUpdateEventMessage(
          opts.ctx.user.username || opts.ctx.user.user_id,
          eventUuid,
          eventData.title,
          oldChanges,
          updateChanges
        );
        logger.log("update event telegram notification sent", logMessage);
        await sendLogNotification({ message: logMessage, topic: "event" });

        return { success: true, eventId: opts.ctx.event.event_uuid } as const;
      });
    } catch (err) {
      logger.error(`[eventRouter]_update_event failed id: ${opts.ctx.event.event_uuid}, error: ${err}`, {
        input: opts.input,
      });

      internal_server_error(err, `Failed to update event ${opts.ctx.event.event_uuid}`);
    }
  });

const getEventsWithFilters = initDataProtectedProcedure.input(searchEventsInputZod).query(async (opts) => {
  if (!opts.ctx.user.user_id) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized access, invalid user" });
  }

  if (opts.input.filter?.organizer_user_id) {
    const organizer = await usersDB.selectUserById(opts.input.filter.organizer_user_id);

    if (organizer?.role !== "organizer" && organizer?.role !== "admin") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Organizer not found" });
    }
  }

  try {
    const events = await eventDB.getEventsWithFilters(opts.input, opts.ctx.user.user_id);

    return { status: "success", data: events.eventsData, totalCount: events.rowsCount };
  } catch (error) {
    logger.error("Error fetching events:", error);

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Error fetching events",
    });
  }
});

export const getEventsWithFiltersInfinite = initDataProtectedProcedure.input(searchEventsInputZod).query(async (opts) => {
  const input = opts.input;
  if (!opts.ctx.user.user_id) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized access, invalid user" });
  }
  if (input.filter?.organizer_user_id) {
    const organizer = await usersDB.selectUserById(input.filter.organizer_user_id);
    if (organizer?.role !== "organizer" && organizer?.role !== "admin" && organizer?.CustomAccessRoles?.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Organizer not found" });
    }
  }
  // Instead of passing `limit`, pass `limit + 1`
  const dbResult = await eventDB.getEventsWithFilters(
    {
      ...input,
      // tell the DB function: fetch an extra row
      limit: (input.limit ?? 10) + 1,
    },
    opts.ctx.user.user_id
  );

  const actualLimit = input.limit ?? 10;
  let nextCursor: number | null = null;

  if (dbResult.eventsData.length > actualLimit) {
    nextCursor = input.cursor + 1;
    dbResult.eventsData.pop(); // remove the extra row
  }

  return {
    items: dbResult,
    nextCursor,
  };
});

const getCategories = initDataProtectedProcedure.query(async () => {
  try {
    return await eventCategoriesDB.fetchAllCategories(true);
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Error fetching enabled categories",
      cause: error,
    });
  }
});
/* -------------------------------------------------------------------------- */
/*                                   Router                                   */
/* -------------------------------------------------------------------------- */
export const eventsRouter = router({
  getEvent,
  // getEvents, // private
  addEvent, //private
  updateEvent, //private
  getEventsWithFilters,
  getEventsWithFiltersInfinite,
  getCategories,
  listPaymentTokens,
});
