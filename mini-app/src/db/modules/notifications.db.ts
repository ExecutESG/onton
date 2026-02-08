import { db } from "@/db/db";
import { NotificationItemType, notifications, NotificationStatus, NotificationType } from "@/db/schema";
import { redisTools } from "@/lib/redisTools";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { QueueNames, NOTIFICATION_TIMEOUT_MARGIN, MAIN_NOTIFICATION_TTL } from "@/sockets/constants";
import { rabbitMQService } from "@/services/rabbitMQService";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/server/utils/logger";
/**
 * Represents the shape of notification data required for insertion.
 */
type NotificationData = {
  userId: number;
  type: NotificationType;
  title?: string;
  desc?: string;
  priority?: number;
  icon?: string;
  image?: string;
  link?: string;
  actionTimeout?: number;
  actionReply?: object;
  additionalData?: object;
  status?: NotificationStatus; // Default: "WAITING_TO_SEND"
  createdAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  itemId?: number;
  item_type?: NotificationItemType;
};

// Cache key generator for notifications
const getNotificationCacheKey = (notificationId: number) => `${redisTools.cacheKeys.notification}${notificationId}`;

// Add a new notification
export const addNotification = async (notificationData: {
  userId: number;
  type: NotificationType;
  title?: string;
  desc?: string;
  priority?: number;
  icon?: string;
  image?: string;
  link?: string;
  actionTimeout?: number;
  actionReply?: object;
  additionalData?: object;
  status?: NotificationStatus; // Default: "WAITING_TO_SEND"
  createdAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  itemId?: number;
  item_type?: NotificationItemType;
}) => {
  try {
    const result = await db
      .insert(notifications)
      .values({
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        desc: notificationData.desc,
        priority: notificationData.priority || 1,
        icon: notificationData.icon || null,
        image: notificationData.image || null,
        link: notificationData.link || null,
        actionTimeout: notificationData.actionTimeout,
        actionReply: null,
        additionalData: notificationData.additionalData,
        status: notificationData.status || "WAITING_TO_SEND",
        createdAt: notificationData.createdAt || new Date(),
        readAt: notificationData.readAt || null,
        expiresAt: notificationData.expiresAt,
        itemId: notificationData.itemId,
        item_type: notificationData.item_type || "UNKNOWN",
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id }) // Return the ID of the inserted row
      .execute();

    // Check if the result is empty, indicating the record already existed
    if (result.length === 0) {
      logger.log(`Notification already exists.`, result);
      return { success: false, message: "Record already exists." };
    }
    // add to rabbitMQ
    const notificationId = result[0].id;

    // Push the notification to RabbitMQ
    const message = {
      notificationId,
      ...notificationData,
    };

    await rabbitMQService.pushMessageToQueue(QueueNames.NOTIFICATIONS, message);
    logger.log(
      `Notification added for User ${notificationData.userId} with ID ${notificationId} and type ${notificationData.type}`
    );
    return { success: true, notificationId: result[0].id }; // Return the ID of the inserted notification
  } catch (error) {
    logger.error("Error adding notification:", error);
    throw error;
  }
};

// Get notifications by status
export const getNotificationsByStatusAndItemId = async (itemId: number, status: NotificationStatus) => {
  try {
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.itemId, itemId), eq(notifications.status, status)))
      .execute();

    logger.log(`Notifications with status "${status}" retrieved:`, result);
    return result;
  } catch (error) {
    logger.error("Error getting notifications by status:", error);
    throw error;
  }
};

// Update notification status
export const updateNotificationStatus = async (notificationId: number, newStatus: NotificationStatus) => {
  try {
    await db.update(notifications).set({ status: newStatus }).where(eq(notifications.id, notificationId)).execute();

    await redisTools.deleteCache(getNotificationCacheKey(notificationId)); // Clear cache
    logger.log(`Notification ${notificationId} status updated to ${newStatus}`);
  } catch (error) {
    logger.error(`Error updating notification ${notificationId} status updated to ${newStatus}:`, error);
    throw error;
  }
};

export const updateNotificationAsRead = async (notificationId: number) => {
  const status: NotificationStatus = "READ";
  if (Number.isNaN(notificationId) || notificationId === undefined) {
    throw new Error("Notification ID is required to update notification as read");
  }
  try {
    await db
      .update(notifications)
      .set({ status: status, readAt: new Date() })
      .where(eq(notifications.id, notificationId))
      .execute();

    await redisTools.deleteCache(getNotificationCacheKey(notificationId)); // Clear cache
    logger.log(`Notification ${notificationId} status updated to ${status}`);
  } catch (error) {
    logger.error(`Error updating notification ${notificationId} status updated to ${status}:`, error);
    throw error;
  }
};

// Update notification status and action reply
export const updateNotificationStatusAndReply = async (
  notificationId: number,
  newStatus: NotificationStatus,
  actionReply: object
) => {
  try {
    await db
      .update(notifications)
      .set({ status: newStatus, actionReply: actionReply })
      .where(eq(notifications.id, notificationId))
      .execute();

    await redisTools.deleteCache(getNotificationCacheKey(notificationId)); // Clear cache
    logger.log(`Notification ${notificationId} status updated to ${newStatus} with action reply`);
  } catch (error) {
    logger.error("Error updating notification status and reply:", error);
    throw error;
  }
};

// Delete notifications with expiration date less than a specific date
export const deleteNotificationsByExpiry = async (expiryDate: Date) => {
  try {
    const result = await db.delete(notifications).where(lt(notifications.expiresAt, expiryDate)).execute();

    logger.log(`Deleted notifications with expiry date less than ${expiryDate}:`, result);
    return result;
  } catch (error) {
    logger.error("Error deleting expired notifications:", error);
    throw error;
  }
};

export const getNotificationById = async (notificationId: number) => {
  try {
    const foundNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1)
      .execute();

    return foundNotifications.length > 0 ? foundNotifications[0] : null;
  } catch (error) {
    logger.error("Error getting notification by ID:", error);
    throw error;
  }
};

export const addNotifications = async (
  notificationsToAdd: NotificationData[],
  persist = true // or `storeInDB = true`, or `isTransient = false` etc.
): Promise<{ success: boolean; count: number }> => {
  try {
    if (!persist) {
      /**
       * 1) Generate unique IDs for each notification since they're NOT going to be stored in DB
       * 2) Enqueue them to RabbitMQ without inserting into the database
       */
      const rabbitMQMessages = notificationsToAdd.map((notification) => {
        const generatedId = uuidv4(); // or some other unique ID logic
        return {
          notificationId: generatedId,
          userId: notification.userId,
          type: notification.type,
          title: notification.title ?? null,
          desc: notification.desc ?? null,
          priority: notification.priority ?? 1,
          icon: notification.icon ?? null,
          image: notification.image ?? null,
          link: notification.link ?? null,
          actionTimeout: notification.actionTimeout ?? undefined,
          actionReply: notification.actionReply ?? null,
          additionalData: notification.additionalData ?? null,
          status: notification.status ?? "WAITING_TO_SEND",
          createdAt: notification.createdAt ?? new Date(),
          readAt: notification.readAt ?? null,
          expiresAt: notification.expiresAt ?? null,
          itemId: notification.itemId ?? undefined,
          item_type: notification.item_type ?? "UNKNOWN",
        };
      });

      // Enqueue all messages
      const enqueuePromises = rabbitMQMessages.map(async (msg) => {
        try {
          await rabbitMQService.pushMessageToQueue(QueueNames.NOTIFICATIONS, msg);
          logger.log(`Notification ID ${msg.notificationId} enqueued successfully.`);
        } catch (mqError) {
          logger.error(`Failed to enqueue ID ${msg.notificationId}:`, mqError);
        }
      });

      await Promise.all(enqueuePromises);

      return { success: true, count: rabbitMQMessages.length };
    } else {
      /**
       *  If persist = true, store them in DB, then enqueue them.
       */
      const insertValues = notificationsToAdd.map((notification) => ({
        userId: notification.userId,
        type: notification.type,
        title: notification.title ?? null,
        desc: notification.desc ?? null,
        priority: notification.priority ?? 1,
        icon: notification.icon ?? null,
        image: notification.image ?? null,
        link: notification.link ?? null,
        actionTimeout: notification.actionTimeout ?? undefined,
        actionReply: notification.actionReply ?? null,
        additionalData: notification.additionalData ?? null,
        status: notification.status ?? "WAITING_TO_SEND",
        createdAt: notification.createdAt ?? new Date(),
        readAt: notification.readAt ?? null,
        expiresAt: notification.expiresAt ?? null,
        itemId: notification.itemId ?? undefined,
        item_type: notification.item_type ?? "UNKNOWN",
      }));

      const insertedNotifications = await db
        .insert(notifications)
        .values(insertValues)
        .returning({
          id: notifications.id,
          userId: notifications.userId,
          type: notifications.type,
          title: notifications.title,
          desc: notifications.desc,
          priority: notifications.priority,
          icon: notifications.icon,
          image: notifications.image,
          link: notifications.link,
          actionTimeout: notifications.actionTimeout,
          additionalData: notifications.additionalData,
          status: notifications.status,
          createdAt: notifications.createdAt,
          readAt: notifications.readAt,
          expiresAt: notifications.expiresAt,
          itemId: notifications.itemId,
          item_type: notifications.item_type,
        })
        .execute();

      logger.log(`Added ${insertedNotifications.length} notifications to DB.`);

      const rabbitMQMessages = insertedNotifications.map((notification) => ({
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        desc: notification.desc,
        priority: notification.priority,
        icon: notification.icon,
        image: notification.image,
        link: notification.link,
        actionTimeout: notification.actionTimeout,
        additionalData: notification.additionalData,
        status: notification.status,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
        expiresAt: notification.expiresAt,
        itemId: notification.itemId,
        item_type: notification.item_type,
      }));

      // Enqueue all inserted notifications
      const enqueuePromises = rabbitMQMessages.map(async (msg) => {
        try {
          await rabbitMQService.pushMessageToQueue(QueueNames.NOTIFICATIONS, msg);
          logger.log(`Notification ID ${msg.notificationId} enqueued successfully.`);
        } catch (mqError) {
          logger.error(`Failed to enqueue ID ${msg.notificationId}:`, mqError);
        }
      });

      await Promise.all(enqueuePromises);

      return { success: true, count: insertedNotifications.length };
    }
  } catch (error) {
    logger.error("Error adding notifications:", error);
    throw error;
  }
};

export async function getRepliedPoaPasswordNotificationsForEvent(eventId: number, userIds: number[]) {
  return await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.type, "POA_PASSWORD"),
        eq(notifications.status, "REPLIED"),
        inArray(notifications.userId, userIds),
        sql`((${notifications.additionalData})->>'eventId')::int = ${eventId}`
      )
    )
    .execute();
}
//
export const expireReadNotifications = async () => {
  try {
    // Update notifications that are READ and whose readAt + actionTimeout is in the past
    logger.log("Expiring read notifications that exceeded their action timeout...");
    const expiredNotifications = await db
      .update(notifications)
      .set({ status: "EXPIRED" })
      .where(
        and(
          or(eq(notifications.status, "READ")),
          sql`${notifications.readAt} IS NOT NULL`,
          sql`${notifications.actionTimeout} IS NOT NULL`,
          sql`(${notifications.readAt} + INTERVAL '1 second' * (${notifications.actionTimeout} + ${NOTIFICATION_TIMEOUT_MARGIN})) < NOW()`
        )
      )
      .returning({ id: notifications.id })
      .execute();
    logger.log(`Expired ${expiredNotifications.length} notifications that exceeded their action timeout.`);
    logger.log("Expiring waiting notifications that exceeded their action timeout...");
    const expiredNotificationsWaiting = await db
      .update(notifications)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(notifications.status, "WAITING_TO_SEND"),
          sql`${notifications.actionTimeout} IS NOT NULL`,
          sql`${notifications.createdAt}::timestamptz + (${MAIN_NOTIFICATION_TTL}) * INTERVAL '1 second' < NOW()`
        )
      )
      .returning({ id: notifications.id })
      .execute();
    logger.log(`Expired ${expiredNotifications.length} notifications that exceeded their action timeout.`);
    logger.log(`Expired ${expiredNotificationsWaiting.length} notifications that exceeded their action timeout.`);
    return { success: true, count: expiredNotifications.length };
  } catch (error) {
    logger.error("Error expiring read notifications:", error);
    throw error;
  }
};
// Export all functions as a single object
export const notificationsDB = {
  addNotification,
  getNotificationsByStatusAndItemId,
  updateNotificationStatus,
  updateNotificationStatusAndReply,
  deleteNotificationsByExpiry,
  getNotificationById,
  addNotifications,
  updateNotificationAsRead,
  getRepliedPoaPasswordNotificationsForEvent,
  expireReadNotifications,
};
