import { db } from "@/db/db";
import { events } from "@/db/schema/events";
import { users } from "@/db/schema/users";
import { eventRegistrants } from "@/db/schema/eventRegistrants";
import { eventTicketTiers } from "@/db/schema/eventTicketTiers";
import userIdentitiesDB from "@/db/modules/userIdentities.db";
import { NotificationDispatcher } from "@/lib/notifications/notificationDispatcher";
import { sendLogNotification } from "@/lib/tgBot";
import { logger } from "@/server/utils/logger";
import { and, count, eq, or } from "drizzle-orm";

export interface TicketPaymentNotificationInput {
  orderUuid: string;
  eventUuid: string;
  buyerUserId: number;
  buyerName?: string | null;
  amount: number | string;
  currency: string;
  ticketTierName?: string | null;
  tierId?: number | null;
  platformFeeRaw?: bigint | null;
  feeBps?: number | null;
}

/**
 * Dispatches ticket payment notifications to the event organizer and the internal admin tickets channel.
 *
 * Guarantees:
 * - Content: Event title, buyer name, amount, currency, ticket tier, and updated attendee count (N / capacity).
 * - Privacy: Never leaks buyer's email or phone number.
 * - Delivery: Delivers via Telegram DM and falls back to Email for Google/Email organizers.
 * - Admin Alert: Posts summary to admin tickets_topic.
 * - Fault Isolation: Wraps in try/catch so notification failures never impact order completion or ticket issuance.
 */
export async function notifyOrganizerAndAdminOnTicketPayment(
  input: TicketPaymentNotificationInput
): Promise<{ success: boolean; organizerNotified: boolean; error?: string }> {
  try {
    const { orderUuid, eventUuid, buyerUserId, amount, currency } = input;

    // 1. Fetch Event details
    const [event] = await db
      .select({
        eventUuid: events.event_uuid,
        title: events.title,
        owner: events.owner,
        capacity: events.capacity,
      })
      .from(events)
      .where(eq(events.event_uuid, eventUuid))
      .execute();

    if (!event) {
      logger.warn(`[OrderNotification] Event ${eventUuid} not found for order ${orderUuid}`);
      return { success: false, organizerNotified: false, error: "event_not_found" };
    }

    // 2. Compute updated approved attendee count
    const [approvedCountRes] = await db
      .select({ count: count() })
      .from(eventRegistrants)
      .where(
        and(
          eq(eventRegistrants.event_uuid, eventUuid),
          or(eq(eventRegistrants.status, "approved"), eq(eventRegistrants.status, "checkedin"))
        )
      )
      .execute();

    const registeredCount = approvedCountRes?.count ?? 1;

    // 3. Resolve ticket tier name if not provided
    let tierName = input.ticketTierName || null;
    if (!tierName && input.tierId) {
      const [tier] = await db
        .select({ name: eventTicketTiers.tier_name })
        .from(eventTicketTiers)
        .where(eq(eventTicketTiers.id, input.tierId))
        .execute();
      tierName = tier?.name || null;
    }

    // 4. Resolve buyer name (strictly from registration or first name, never email/phone)
    let buyerDisplayName: string | undefined = input.buyerName?.trim();
    if (!buyerDisplayName) {
      const [reg] = await db
        .select({ register_info: eventRegistrants.register_info })
        .from(eventRegistrants)
        .where(
          and(
            eq(eventRegistrants.event_uuid, eventUuid),
            eq(eventRegistrants.user_id, buyerUserId)
          )
        )
        .execute();

      const regInfo = (typeof reg?.register_info === "object" ? reg.register_info : {}) as Record<string, string | null>;
      buyerDisplayName = regInfo?.full_name || regInfo?.name || undefined;

      if (!buyerDisplayName) {
        const [buyerUser] = await db
          .select({ firstName: users.first_name, username: users.username })
          .from(users)
          .where(eq(users.user_id, buyerUserId))
          .execute();

        buyerDisplayName = buyerUser?.firstName || (buyerUser?.username ? `@${buyerUser.username}` : "An attendee");
      }
    }

    // 5. Fetch organizer details (users + user_identities)
    const [organizerUser] = await db
      .select({
        userId: users.user_id,
        email: users.email,
        telegramId: users.telegram_id,
        firstName: users.first_name,
        lastName: users.last_name,
        username: users.username,
        authProvider: users.auth_provider,
      })
      .from(users)
      .where(eq(users.user_id, event.owner))
      .execute();

    let organizerTelegramId: number | string | null = organizerUser?.telegramId || null;
    let organizerEmail: string | null = organizerUser?.email || null;

    if (organizerUser) {
      const identities = await userIdentitiesDB.getIdentitiesByUserId(organizerUser.userId);

      if (!organizerTelegramId) {
        const tgIdent = identities.find((i) => i.provider === "telegram");
        if (tgIdent?.provider_user_id) {
          organizerTelegramId = tgIdent.provider_user_id;
        } else if (organizerUser.authProvider === "telegram") {
          organizerTelegramId = organizerUser.userId;
        }
      }

      if (!organizerEmail) {
        const emailIdent = identities.find((i) => i.provider === "email" || i.provider === "google");
        const meta = emailIdent?.provider_metadata as Record<string, any> | undefined;
        if (meta?.email && typeof meta.email === "string") {
          organizerEmail = meta.email;
        } else if (emailIdent?.provider === "email" && emailIdent.provider_user_id.includes("@")) {
          organizerEmail = emailIdent.provider_user_id;
        }
      }
    }

    const organizerFullName = [organizerUser?.firstName, organizerUser?.lastName]
      .filter(Boolean)
      .join(" ") || organizerUser?.username || "Organizer";

    // 6. Dispatch organizer notification
    let organizerNotified = false;
    if (organizerTelegramId || organizerEmail) {
      const dispatchResult = await NotificationDispatcher.dispatchOrganizerTicketSaleNotification({
        eventUuid,
        eventTitle: event.title,
        buyerName: buyerDisplayName,
        amount,
        currency,
        ticketTierName: tierName,
        registeredCount,
        capacity: event.capacity,
        recipient: {
          userId: event.owner,
          telegramId: organizerTelegramId,
          email: organizerEmail,
          name: organizerFullName,
          preferredChannel: organizerTelegramId ? "telegram" : "email",
        },
      });

      organizerNotified = dispatchResult.success;
      logger.info(
        `[OrderNotification] Organizer notification for order ${orderUuid} dispatched via ${dispatchResult.channel} (success=${dispatchResult.success})`
      );
    } else {
      logger.warn(`[OrderNotification] Organizer for event ${eventUuid} (user ${event.owner}) has neither Telegram nor Email linked`);
    }

    // 7. Dispatch admin channel notification to tickets_topic
    try {
      const numAmount = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
      const feeBps = input.feeBps ?? (currency.toUpperCase() === "STARS" ? 500 : 300);
      const estFee = ((numAmount * feeBps) / 10000).toFixed(4).replace(/\.?0+$/, "");

      const capacityLabel = event.capacity && event.capacity > 0 ? `${registeredCount} / ${event.capacity}` : `${registeredCount} (Unlimited)`;

      const adminLogMessage = `
🎟️ <b>Ticket Payment Received</b>

📌 <b>Event:</b> ${event.title}
🆔 <b>Event UUID:</b> <code>${eventUuid}</code>
🧾 <b>Order:</b> <code>${orderUuid}</code>
👤 <b>Buyer:</b> <code>${buyerUserId}</code> (${buyerDisplayName})
💰 <b>Amount:</b> ${amount} ${currency}
💎 <b>Est. Platform Fee (${feeBps / 100}%):</b> ${estFee} ${currency}
📊 <b>Capacity:</b> ${capacityLabel}
`.trim();

      await sendLogNotification({
        message: adminLogMessage,
        topic: "ticket",
      });
    } catch (adminErr) {
      logger.warn(`[OrderNotification] Admin channel log notification failed for order ${orderUuid}:`, adminErr);
    }

    return {
      success: true,
      organizerNotified,
    };
  } catch (error) {
    logger.error(`[OrderNotification] Error in notifyOrganizerAndAdminOnTicketPayment for order ${input.orderUuid}:`, error);
    return {
      success: false,
      organizerNotified: false,
      error: (error as Error).message,
    };
  }
}
