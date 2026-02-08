import { z } from "zod";
import { notificationsDB } from "@/db/modules/notifications.db";
import { NotificationStatus } from "@/db/schema";
import { eventPoaResultsDB } from "@/db/modules/eventPoaResults.db";
import { eventPoaTriggersDB } from "@/db/modules/eventPoaTriggers.db";
import { NOTIFICATION_TIMEOUT_MARGIN, PASSWORD_RETRY_LIMIT } from "@/sockets/constants";
import { validateNotificationReply } from "@/sockets/helpers/validateNotificationReply";
import { getEventById } from "@/db/modules/events.db";
import { eventRegistrantsDB } from "@/db/modules/eventRegistrants.db";
import eventFieldsDB from "@/db/modules/eventFields.db";
import bcryptLib from "@/lib/bcrypt";
import userEventFieldsDB from "@/db/modules/userEventFields.db";
import { logger } from "@/server/utils/logger";

import { getCache, setCache, deleteCache, cacheKeys } from "@/lib/redisTools";
import { Server } from "socket.io";
import visitorsDB from "@/db/modules/visitors.db";
import rewardDB from "@/db/modules/rewards.db";

type CallbackFunction = (response: { status: string; message: string }) => void;

/**
 * handleNotificationReply - Extended to check password attempts via Redis
 */
export const handleNotificationReply = async (
  io: Server,
  data: any,
  callback: CallbackFunction,
  sanitizedUsername: string,
  userId: number
) => {
  try {
    // Validate input
    const validatedData = validateNotificationReply(data);
    if (!validatedData.valid) {
      callback({ status: "error", message: "Invalid input for handleNotificationReply" });
      return;
    }

    const { notificationId, answer, type } = validatedData;
    const notificationIdNumber = Number(notificationId);
    logger.log(
      `Received notification_reply from ${sanitizedUsername}: notificationId=${notificationId}, answer=${answer} type=${type}`
    );

    if (isNaN(notificationIdNumber)) {
      callback({ status: "error", message: "Invalid notification ID" });
      return;
    }

    // Fetch the notification by ID
    const foundNotification = await notificationsDB.getNotificationById(notificationIdNumber);
    if (!foundNotification) {
      callback({ status: "error", message: "Notification not found" });
      logger.warn(`Notification ${notificationIdNumber} not found.`);
      return;
    }

    const foundNotificationUserId = Number(foundNotification.userId);
    if (isNaN(foundNotificationUserId)) {
      callback({ status: "error", message: "Invalid notification owner" });
      logger.warn(`Notification ${notificationIdNumber} has invalid owner.`);
      return;
    }

    // Check ownership
    if (foundNotificationUserId !== userId) {
      logger.warn(
        `User ${sanitizedUsername} (ID: ${userId}) attempted to reply to a notification they don't own (Notification ID: ${notificationIdNumber}).`
      );
      callback({ status: "error", message: "Unauthorized: You do not own this notification." });
      return;
    }

    // Check if notification is unread
    if (foundNotification.readAt === null) {
      logger.warn(
        `User ${sanitizedUsername} (ID: ${userId}) attempted to reply to an unread notification (Notification ID: ${notificationIdNumber}).`
      );
      callback({ status: "error", message: `You can't reply to an unread notification.` });
      return;
    }

    // Time-based expiration check
    const currentTime = Math.floor(Date.now() / 1000);
    const readAtTimestamp = Math.floor(new Date(foundNotification.readAt).getTime() / 1000);
    const timeoutToCheck = foundNotification.actionTimeout ? Number(foundNotification.actionTimeout) : 0;
    const notificationTimeout = readAtTimestamp + timeoutToCheck + NOTIFICATION_TIMEOUT_MARGIN;
    logger.log(
      `readAtTimestamp: ${readAtTimestamp}, foundNotification.actionTimeout: ${foundNotification.actionTimeout}, currentTime: ${currentTime}, notificationTimeout: ${notificationTimeout}`
    );
    if (notificationTimeout < currentTime) {
      logger.warn(
        `User ${sanitizedUsername} (ID: ${userId}) attempted to reply after timeout (Notification ID: ${notificationIdNumber}).`
      );
      callback({ status: "error", message: `You can't reply to this notification after the timeout.` });
      return;
    }

    // Check the related POA trigger
    const relatedPOATrigger = await eventPoaTriggersDB.getEventPoaTriggerById(foundNotification.itemId);
    if (!relatedPOATrigger) {
      logger.warn(`Event POA Trigger not found for ID ${foundNotification.itemId}`);
      callback({ status: "error", message: `Event POA Trigger not found for ID ${foundNotification.itemId}` });
      return;
    }

    // Fetch the event
    const eventData = await getEventById(relatedPOATrigger.eventId);
    if (!eventData) {
      logger.warn(`Event not found for ID ${relatedPOATrigger.eventId}`);
      callback({ status: "error", message: `Event not found for ID ${relatedPOATrigger.eventId}` });
      return;
    }

    // Ensure event is active
    const startDate = Number(eventData.start_date) * 1000;
    const endDate = Number(eventData.end_date) * 1000;
    if (Date.now() < startDate || Date.now() > endDate) {
      logger.warn(
        `User ${sanitizedUsername} (ID: ${userId}) attempted to reply to an inactive event (Notification ID: ${notificationIdNumber}).`
      );
      callback({
        status: "error",
        message: `You can't reply to this notification for an event that is not active.`,
      });
      return;
    }

    // Check if the user is registered in the event
    const getRegisteredUser = await eventRegistrantsDB.getByEventUuidAndUserId(eventData.event_uuid, userId);
    if (!getRegisteredUser) {
      logger.warn(
        `User ${sanitizedUsername} (ID: ${userId}) attempted to reply to a notification for an event they are not registered (Notification ID: ${notificationIdNumber}).`
      );
      callback({
        status: "error",
        message: `You can't reply to this notification for an event you are not registered.`,
      });
      return;
    }

    /**
     * ------------------------------------------------------
     * PASSWORD LOGIC FOR "POA_PASSWORD" WITH REDIS ATTEMPTS
     * ------------------------------------------------------
     */
    if (foundNotification.type === "POA_PASSWORD") {
      // Retrieve maxTry from the DB-stored additionalData (default to PASSWORD_RETRY_LIMIT if not provided)
      // @ts-ignore
      const maxTry = foundNotification.additionalData?.maxTry || PASSWORD_RETRY_LIMIT;

      // Build a Redis key for attempts.  e.g. "notification:1234:tries"
      const redisKey = `${cacheKeys.notification}${notificationIdNumber}:tries`;

      // Current tries from Redis
      let currentTries = await getCache(redisKey); // returns string or undefined
      currentTries = currentTries ? parseInt(currentTries, 10) : 0;

      if (currentTries >= maxTry) {
        // Already at or above max tries => Mark as EXPIRED
        await notificationsDB.updateNotificationStatusAndReply(notificationIdNumber, "EXPIRED", {
          answer: "Exceeded max tries",
        });
        callback({
          status: "error",
          message: "You have reached the maximum number of password attempts. Notification is expired.",
        });
        return;
      }

      // If not yet exceeded, check the password
      const inputField = await eventFieldsDB.getEventFieldByTitleAndEventId(
        "secret_phrase_onton_input",
        relatedPOATrigger.eventId
      );
      if (!inputField) {
        logger.warn(`Event Field not found for ID ${relatedPOATrigger.eventId}`);
        callback({
          status: "error",
          message: `Event Field not found for ID ${relatedPOATrigger.eventId}`,
        });
        return;
      }

      // "Fixed password" logic
      const today = new Date();
      const dayOfMonth = today.getDate();
      const monthNameShort = today.toLocaleString("en-US", { month: "short" });
      const fixedPassword = `${dayOfMonth}ShahKey@${monthNameShort}`;

      const enteredPassword = answer.trim().toLowerCase();
      const isFixedPasswordCorrect = enteredPassword === fixedPassword.toLowerCase();
      const isRealPasswordCorrect = eventData.secret_phrase
        ? await bcryptLib.comparePassword(enteredPassword, eventData.secret_phrase)
        : false;

      if (!isFixedPasswordCorrect && !isRealPasswordCorrect) {
        // Wrong password => increment tries
        currentTries += 1;
        await setCache(redisKey, currentTries); // store the new count

        if (currentTries >= maxTry) {
          // Now we've hit the limit => Expire notification
          await notificationsDB.updateNotificationStatusAndReply(notificationIdNumber, "EXPIRED", {
            answer: "Exceeded max tries",
          });
          callback({
            status: "password_attempts_error",
            message: "You have reached the maximum number of password attempts. Notification is expired.",
          });
          return;
        }

        logger.warn(
          `User ${sanitizedUsername} (ID: ${userId}) wrong password attempt ${currentTries}/${maxTry} (Notification ID: ${notificationIdNumber}).`
        );
        callback({
          status: "password_error",
          message: "Password incorrect, try again",
        });
        return;
      }

      // If correct password => clear tries from Redis, proceed
      await deleteCache(redisKey);

      try {
        // Hash & store the entered password as userEventField
        const hashedPassword = await bcryptLib.hashPassword(enteredPassword);
        logger.log(
          `SBT::UserEventFields::Upserting user event field for user ${userId} and event ${relatedPOATrigger.eventId}`
        );
        const userEventField = await userEventFieldsDB.upsertUserEventFields(
          userId,
          relatedPOATrigger.eventId,
          inputField.id,
          hashedPassword
        );
        logger.log(
          `SBT::UserEventFields::Upserted user event field for user ${userId} and event ${relatedPOATrigger.eventId}`,
          userEventField
        );
        logger.log(`SBT::Reward::Creating user reward for user ${userId} and event ${relatedPOATrigger.eventId}`);

        const visitor = await visitorsDB.addVisitor(userId, eventData.event_uuid);

        if (!visitor) {
          logger.error(`Visitor ${userId} not found for event ${eventData.event_uuid} in handleNotificationReply`);
          throw new Error(`Visitor ${userId} not found`);
        }
        const existingReward = await rewardDB.checkExistingRewardWithType(visitor?.id, "ton_society_sbt");
        if (!existingReward) {
          const reward = await rewardDB.insertRewardRow(
            visitor.id,
            null,
            userId,
            "ton_society_sbt",
            "pending_creation",
            eventData
          );
          logger.log(
            `SBT::Reward::Created user reward for user ${userId} and event ${relatedPOATrigger.eventId} with result notification ID ${notificationIdNumber}:`,
            reward
          );
        } else {
          logger.log(
            `SBT::Reward::User reward already exists for user ${userId} and event ${relatedPOATrigger.eventId} notification ID ${notificationIdNumber}`
          );
        }
      } catch (e) {
        logger.error(`SBT::Reward::Error creating user reward for user ${userId} and event ID ${relatedPOATrigger.eventId}`);
        logger.error(e);
      }
    }

    // If it's not POA_PASSWORD, or password check was correct, continue
    const newStatus: NotificationStatus = "REPLIED";
    const actionReply = {
      answer: foundNotification.type === "POA_PASSWORD" ? await bcryptLib.hashPassword(answer) : answer,
    };
    logger.log(`Updating notification ${notificationIdNumber} status to ${newStatus} with reply:`, actionReply);
    await notificationsDB.updateNotificationStatusAndReply(notificationIdNumber, newStatus, actionReply);

    // If item_type === "POA_TRIGGER", handle POA result insertion
    if (foundNotification.item_type === "POA_TRIGGER") {
      const eventPoaTrigger = await eventPoaTriggersDB.getEventPoaTriggerById(foundNotification.itemId);
      if (!eventPoaTrigger) {
        logger.warn(`Event POA Trigger not found for ID ${foundNotification.itemId}`);
      } else {
        logger.log(`Inserting POA result for User ${userId} and Event ${eventPoaTrigger.eventId}`);
        await eventPoaResultsDB.insertPoaResult({
          userId,
          eventId: eventPoaTrigger.eventId,
          poaId: foundNotification.itemId,
          poaAnswer: foundNotification.type === "POA_PASSWORD" ? "correct_password" : answer,
          status: "REPLIED",
          repliedAt: new Date(),
          notificationId: notificationIdNumber,
        });

        // Also notify the organizer that the user answered
        // const eventId = eventPoaTrigger.eventId;
        // //const eventDetails = await getEventById(eventId);
        // const organizerId = eventPoaTrigger.creator_user_id;
        // if (!organizerId) {
        //   logger.warn(`Organizer ID not found for Event POA Trigger ID ${eventPoaTrigger.id}`);
        // } else {
        //   const userAnswerNotification = {
        //     userId: organizerId,
        //     type: "USER_ANSWER_POA" as NotificationType,
        //     title: `User ${userId} has responded to your POA`,
        //     desc: `User ID ${userId} replied '${answer}' to your POA for Event ID ${eventPoaTrigger.eventId}.`,
        //     actionTimeout: 0,
        //     additionalData: {
        //       participant_id: userId,
        //       event_id: eventPoaTrigger.eventId,
        //       poa_id: foundNotification.itemId,
        //     },
        //     priority: 2,
        //     itemId: foundNotification.itemId,
        //     item_type: "POA_TRIGGER" as NotificationItemType,
        //     status: "WAITING_TO_SEND" as NotificationStatus,
        //     createdAt: new Date(),
        //     expiresAt: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000), // 30 days
        //   };
        //
        //   await notificationsDB.addNotifications([userAnswerNotification] , false);
        //   logger.log(`USER_ANSWER_POA notification created for Organizer ID ${organizerId}`);
        // }
      }
    }

    // Emit an event to all user devices to close the POA notification
    // This is triggered after successfully replying with the correct password.
    if (foundNotification.type === "POA_PASSWORD") {
      io.to(`user_${userId}`).emit("notification_close", { notificationId: notificationIdNumber });
    }
    // Finally, respond to the user
    if (callback) {
      callback({
        status: "success",
        message: `Notification ${notificationIdNumber} reply '${answer}' processed successfully`,
      });
    }
  } catch (error) {
    logger.error("Error processing notification_reply:", error);

    let errorMessage = "An unexpected error occurred.";
    if (error instanceof z.ZodError && error.errors.length > 0) {
      errorMessage = error.errors[0].message;
    }

    if (callback) {
      callback({
        status: "error",
        message: errorMessage,
      });
    }
  }
};
