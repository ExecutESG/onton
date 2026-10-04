import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types/MyContext";
import { pool } from "../db/pool";
import { redisTools } from "../lib/redisTools";
import { logger } from "../utils/logger";
import axios from "axios";
import { getMiniAppBaseUrl, getMiniAppHmacHeaders } from "../utils/miniAppClient";

export const moderationComposer = new Composer<MyContext>();

/**
 * Check if the user has moderator privileges.
 * Allows superadmins (@ontonadmin: 7013087032, Mahdi: 23932283, or ADMIN_TELEGRAM_ID),
 * users with role 'admin', or users with user_custom_flags 'moderator'.
 */
export async function isModerator(userId: number): Promise<boolean> {
  if (
    userId === 7013087032 ||
    userId === 23932283 ||
    (process.env.ADMIN_TELEGRAM_ID && userId === Number(process.env.ADMIN_TELEGRAM_ID))
  ) {
    return true;
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT u.role, f.enabled 
       FROM users u 
       LEFT JOIN user_custom_flags f ON u.user_id = f.user_id AND f.user_flag = 'moderator' AND f.enabled = true
       WHERE u.user_id = $1`,
      [userId]
    );
    if (!res.rows.length) return false;
    return res.rows[0].role === "admin" || Boolean(res.rows[0].enabled);
  } catch (err) {
    logger.error("isModerator check error:", err);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Menu displayed after an event has been delisted.
 */
export function tgBotDelistedMenu(eventUuid: string) {
  return new InlineKeyboard()
    .text("♻️ Re-list Event", `relist_${eventUuid}`)
    .row()
    .text("🔃 Update Data", `updateEventData_${eventUuid}`);
}

/**
 * Reactive post-publish moderation menu (Lu.ma-style Trust & Safety).
 */
export function tgBotPostPublishModerationMenu(eventUuid: string, organizerUserId: number | string) {
  return new InlineKeyboard()
    .text("🚫 Delist Event", `delist_${eventUuid}`)
    .text("⚠️ Warn Organizer", `warn_${organizerUserId}_${eventUuid}`)
    .row()
    .text("🔨 Ban Organizer", `ban_${organizerUserId}_${eventUuid}`)
    .text("🔃 Update Data", `updateEventData_${eventUuid}`);
}

// ==========================================
// 1) Delist / Confirm Delist Event
// ==========================================
moderationComposer.callbackQuery(/^(delist|confirmDelist)_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const eventUuid = ctx.match[2];

  if (!(await isModerator(userId))) {
    await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
    return;
  }

  const client = await pool.connect();
  try {
    const evRes = await client.query("SELECT * FROM events WHERE event_uuid = $1", [eventUuid]);
    if (!evRes.rows.length) {
      await ctx.answerCallbackQuery({ text: "Event not found" });
      return;
    }
    const eventData = evRes.rows[0];

    // Mark hidden & disabled
    await client.query(
      `UPDATE events
       SET hidden = true, enabled = false, updated_by = $1, updated_at = NOW()
       WHERE event_uuid = $2`,
      [`moderator_${userId}`, eventUuid]
    );

    // Invalidate Redis caches
    await redisTools.deleteCache(`${redisTools.cacheKeys.event_uuid}${eventUuid}`);
    if (eventData.event_id) {
      await redisTools.deleteCache(`${redisTools.cacheKeys.event_id}${eventData.event_id}`);
    }

    // Update event_reports if table exists
    await client
      .query(`UPDATE event_reports SET status = 'delisted', updated_at = NOW() WHERE event_uuid = $1`, [eventUuid])
      .catch(() => {});

    // Audit log if table exists
    await client
      .query(
        `INSERT INTO moderation_log (moderator_user_id, event_uuid, event_owner_id, action, custom_text)
         VALUES ($1, $2, $3, 'REJECT', 'Delisted by platform moderator via reactive Trust & Safety action')`,
        [userId, eventUuid, eventData.owner || 0]
      )
      .catch(() => {});

    // Notify organizer
    if (eventData.owner) {
      try {
        await ctx.api.sendMessage(
          Number(eventData.owner),
          `🚫 Your Event <b>(${eventData.title})</b> has been delisted by platform moderation.\n\nIf you believe this action was taken in error, please contact platform support.`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        logger.warn(`Failed to notify organizer ${eventData.owner} of delist:`, err);
      }
    }

    // Update message caption in moderation channel
    const fromUser = ctx.from;
    const modUsername = fromUser.username ? `@${fromUser.username}` : `${fromUser.first_name || ""} ${fromUser.last_name || ""}`.trim();
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const originalCaption = ctx.callbackQuery.message?.caption || ctx.callbackQuery.message?.text || "";
    const newCaption = `${originalCaption}\n\nStatus: 🚫 <b>Delisted By</b> ${modUsername} (<code>${userId}</code>)\n🕒 <i>${timestampStr}</i>`;

    if (ctx.callbackQuery.message?.caption !== undefined) {
      await ctx.editMessageCaption({
        caption: newCaption,
        parse_mode: "HTML",
        reply_markup: tgBotDelistedMenu(eventUuid),
      });
    } else {
      await ctx.editMessageText(newCaption, {
        parse_mode: "HTML",
        reply_markup: tgBotDelistedMenu(eventUuid),
      });
    }

    await ctx.answerCallbackQuery({ text: "Event successfully delisted!" });
  } catch (error) {
    logger.error(`Error in delist handler for ${eventUuid}:`, error);
    await ctx.answerCallbackQuery({ text: "Error delisting event" });
  } finally {
    client.release();
  }
});

// ==========================================
// 2) Re-list Event
// ==========================================
moderationComposer.callbackQuery(/^relist_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const eventUuid = ctx.match[1];

  if (!(await isModerator(userId))) {
    await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
    return;
  }

  const client = await pool.connect();
  try {
    const evRes = await client.query("SELECT * FROM events WHERE event_uuid = $1", [eventUuid]);
    if (!evRes.rows.length) {
      await ctx.answerCallbackQuery({ text: "Event not found" });
      return;
    }
    const eventData = evRes.rows[0];

    // Mark unhidden & enabled
    await client.query(
      `UPDATE events
       SET hidden = false, enabled = true, updated_by = $1, updated_at = NOW()
       WHERE event_uuid = $2`,
      [`moderator_${userId}`, eventUuid]
    );

    // Invalidate caches
    await redisTools.deleteCache(`${redisTools.cacheKeys.event_uuid}${eventUuid}`);
    if (eventData.event_id) {
      await redisTools.deleteCache(`${redisTools.cacheKeys.event_id}${eventData.event_id}`);
    }

    // Audit log
    await client
      .query(
        `INSERT INTO moderation_log (moderator_user_id, event_uuid, event_owner_id, action, custom_text)
         VALUES ($1, $2, $3, 'APPROVE', 'Re-listed by platform moderator')`,
        [userId, eventUuid, eventData.owner || 0]
      )
      .catch(() => {});

    // Notify organizer
    if (eventData.owner) {
      try {
        await ctx.api.sendMessage(
          Number(eventData.owner),
          `✅ Your Event <b>(${eventData.title})</b> has been restored and re-listed by platform moderation.`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        logger.warn(`Failed to notify organizer ${eventData.owner} of relist:`, err);
      }
    }

    const fromUser = ctx.from;
    const modUsername = fromUser.username ? `@${fromUser.username}` : `${fromUser.first_name || ""} ${fromUser.last_name || ""}`.trim();
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const originalCaption = ctx.callbackQuery.message?.caption || ctx.callbackQuery.message?.text || "";
    const newCaption = `${originalCaption}\n\nStatus: ♻️ <b>Re-listed By</b> ${modUsername} (<code>${userId}</code>)\n🕒 <i>${timestampStr}</i>`;

    if (ctx.callbackQuery.message?.caption !== undefined) {
      await ctx.editMessageCaption({
        caption: newCaption,
        parse_mode: "HTML",
        reply_markup: tgBotPostPublishModerationMenu(eventUuid, eventData.owner || 0),
      });
    } else {
      await ctx.editMessageText(newCaption, {
        parse_mode: "HTML",
        reply_markup: tgBotPostPublishModerationMenu(eventUuid, eventData.owner || 0),
      });
    }

    await ctx.answerCallbackQuery({ text: "Event re-listed!" });
  } catch (error) {
    logger.error(`Error in relist handler for ${eventUuid}:`, error);
    await ctx.answerCallbackQuery({ text: "Error re-listing event" });
  } finally {
    client.release();
  }
});

// ==========================================
// 3) Warn Organizer
// ==========================================
moderationComposer.callbackQuery(/^warn_([^_]+)_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const organizerUserId = ctx.match[1];
  const eventUuid = ctx.match[2];

  if (!(await isModerator(userId))) {
    await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
    return;
  }

  const client = await pool.connect();
  try {
    const evRes = await client.query("SELECT * FROM events WHERE event_uuid = $1", [eventUuid]);
    const eventTitle = evRes.rows[0]?.title || "your event";

    await client
      .query(
        `INSERT INTO moderation_log (moderator_user_id, event_uuid, event_owner_id, action, custom_text)
         VALUES ($1, $2, $3, 'NOTICE', 'Official warning issued to organizer')`,
        [userId, eventUuid, Number(organizerUserId) || 0]
      )
      .catch(() => {});

    try {
      await ctx.api.sendMessage(
        Number(organizerUserId),
        `⚠️ <b>Moderator Notice:</b> Your event <b>(${eventTitle})</b> was flagged for community review. Please ensure your event adheres to ONTON guidelines to maintain good standing on the platform.`,
        { parse_mode: "HTML" }
      );
      await ctx.answerCallbackQuery({
        text: `⚠️ Warning delivered to organizer (${organizerUserId})`,
        show_alert: true,
      });
    } catch (err) {
      logger.warn(`Failed to deliver warning to organizer ${organizerUserId}:`, err);
      await ctx.answerCallbackQuery({
        text: "Could not deliver DM to organizer (bot might be blocked)",
        show_alert: true,
      });
    }
  } finally {
    client.release();
  }
});

// ==========================================
// 4) Ban Organizer & Takedown All Events
// ==========================================
moderationComposer.callbackQuery(/^ban_([^_]+)_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const organizerUserId = Number(ctx.match[1]);
  const eventUuid = ctx.match[2];

  if (!(await isModerator(userId))) {
    await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
    return;
  }

  const client = await pool.connect();
  try {
    // 1) Mark user as banned
    await client.query(`UPDATE users SET role = 'ban', updated_at = NOW() WHERE user_id = $1`, [organizerUserId]);
    await redisTools.deleteCache(`${redisTools.cacheKeys.user}${organizerUserId}`);

    // 2) Cascading takedown of all owned events
    const evsRes = await client.query(
      `UPDATE events
       SET hidden = true, enabled = false, updated_by = $1, updated_at = NOW()
       WHERE owner = $2
       RETURNING event_uuid, event_id`,
      [`moderator_ban_${userId}`, organizerUserId]
    );

    for (const row of evsRes.rows) {
      if (row.event_uuid) {
        await redisTools.deleteCache(`${redisTools.cacheKeys.event_uuid}${row.event_uuid}`);
      }
      if (row.event_id) {
        await redisTools.deleteCache(`${redisTools.cacheKeys.event_id}${row.event_id}`);
      }
    }

    // 3) Audit log
    await client
      .query(
        `INSERT INTO moderation_log (moderator_user_id, event_uuid, event_owner_id, action, custom_text)
         VALUES ($1, $2, $3, 'REJECT', $4)`,
        [userId, eventUuid, organizerUserId, `BAN: Organizer banned and ${evsRes.rowCount} owned events delisted`]
      )
      .catch(() => {});

    // 4) Notify organizer
    try {
      await ctx.api.sendMessage(
        organizerUserId,
        `⛔ <b>Account Suspended:</b> Your ONTON organizer privileges have been permanently revoked due to community trust & safety violations.\n\nAll your events have been delisted.`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.warn(`Failed to notify banned organizer ${organizerUserId}:`, err);
    }

    // 5) Update Telegram message
    const fromUser = ctx.from;
    const modUsername = fromUser.username ? `@${fromUser.username}` : `${fromUser.first_name || ""} ${fromUser.last_name || ""}`.trim();
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const originalCaption = ctx.callbackQuery.message?.caption || ctx.callbackQuery.message?.text || "";
    const newCaption = `${originalCaption}\n\nStatus: 🔨 <b>Organizer Banned & ${evsRes.rowCount} Events Delisted By</b> ${modUsername} (<code>${userId}</code>)\n🕒 <i>${timestampStr}</i>`;

    if (ctx.callbackQuery.message?.caption !== undefined) {
      await ctx.editMessageCaption({
        caption: newCaption,
        parse_mode: "HTML",
      });
    } else {
      await ctx.editMessageText(newCaption, {
        parse_mode: "HTML",
      });
    }

    await ctx.answerCallbackQuery({
      text: `🔨 Organizer banned. ${evsRes.rowCount} events taken down.`,
      show_alert: true,
    });
  } catch (error) {
    logger.error(`Error in ban handler for ${organizerUserId}:`, error);
    await ctx.answerCallbackQuery({ text: "Error banning organizer" });
  } finally {
    client.release();
  }
});

// ==========================================
// 5) Dismiss Abuse Report
// ==========================================
moderationComposer.callbackQuery(/^dismissReport_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const eventUuid = ctx.match[1];

  if (!(await isModerator(userId))) {
    await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
    return;
  }

  const client = await pool.connect();
  try {
    await client
      .query(`UPDATE event_reports SET status = 'dismissed', updated_at = NOW() WHERE event_uuid = $1`, [eventUuid])
      .catch(() => {});

    const evRes = await client.query("SELECT owner FROM events WHERE event_uuid = $1", [eventUuid]);
    const ownerId = evRes.rows[0]?.owner || 0;

    await client
      .query(
        `INSERT INTO moderation_log (moderator_user_id, event_uuid, event_owner_id, action, custom_text)
         VALUES ($1, $2, $3, 'APPROVE', 'Community abuse report reviewed and dismissed by moderator')`,
        [userId, eventUuid, ownerId]
      )
      .catch(() => {});

    const fromUser = ctx.from;
    const modUsername = fromUser.username ? `@${fromUser.username}` : `${fromUser.first_name || ""} ${fromUser.last_name || ""}`.trim();
    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const originalCaption = ctx.callbackQuery.message?.caption || ctx.callbackQuery.message?.text || "";
    const newCaption = `${originalCaption}\n\nStatus: ✅ <b>Report Dismissed By</b> ${modUsername} (<code>${userId}</code>)\n🕒 <i>${timestampStr}</i>`;

    if (ctx.callbackQuery.message?.caption !== undefined) {
      await ctx.editMessageCaption({
        caption: newCaption,
        parse_mode: "HTML",
      });
    } else {
      await ctx.editMessageText(newCaption, {
        parse_mode: "HTML",
      });
    }

    await ctx.answerCallbackQuery({ text: "Report dismissed!" });
  } catch (error) {
    logger.error(`Error in dismissReport handler for ${eventUuid}:`, error);
    await ctx.answerCallbackQuery({ text: "Error dismissing report" });
  } finally {
    client.release();
  }
});

// ==========================================
// 6) Update Event Data
// ==========================================
moderationComposer.callbackQuery(/^updateEventData_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const eventUuid = ctx.match[1];

  if (!(await isModerator(userId))) {
    await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
    return;
  }

  const client = await pool.connect();
  try {
    const evRes = await client.query("SELECT * FROM events WHERE event_uuid = $1", [eventUuid]);
    if (!evRes.rows.length) {
      await ctx.answerCallbackQuery({ text: "Event not found" });
      return;
    }
    const event = evRes.rows[0];
    const statusText = event.hidden ? "🚫 Delisted" : event.enabled ? "✅ Published / Active" : "⏸️ Inactive";
    await ctx.answerCallbackQuery({
      text: `Status: ${statusText}\nTitle: ${event.title}\nOwner: ${event.owner}`,
      show_alert: true,
    });
  } catch (error) {
    logger.error(`Error in updateEventData handler:`, error);
    await ctx.answerCallbackQuery({ text: "Error fetching event data" });
  } finally {
    client.release();
  }
});

// ==========================================
// 7) Legacy / Pre-moderation Callbacks
// ==========================================
moderationComposer.callbackQuery(/^(approve|yesApprove|noApprove|rejectCustom|reject\w+)_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  if (!(await isModerator(userId))) {
    await ctx.answerCallbackQuery({ text: "Unauthorized Moderator" });
    return;
  }
  await ctx.answerCallbackQuery({
    text: "Notice: ONTON events are auto-published. Use Delist or Ban for moderation.",
    show_alert: true,
  });
});

// ==========================================
// 8) /payout Command (Admin/Moderator Only)
// ==========================================
moderationComposer.command("payout", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !(await isModerator(userId))) {
    await ctx.reply("⛔ Unauthorized: Moderator or Admin access required.");
    return;
  }

  // Format: /payout <event_uuid> <amount> <tx_hash>
  const text = ctx.message?.text?.trim() || "";
  const parts = text.split(/\s+/);
  if (parts.length < 4) {
    await ctx.reply(
      "❌ Invalid format.\n\nUsage: <code>/payout &lt;event_uuid&gt; &lt;amount&gt; &lt;tx_hash&gt;</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const eventUuid = parts[1];
  const amount = parts[2];
  const txHash = parts[3];

  if (isNaN(Number(amount)) || Number(amount) <= 0) {
    await ctx.reply("❌ Invalid amount. Must be a positive number.");
    return;
  }

  const miniAppBaseUrl = getMiniAppBaseUrl();
  const endpoint = `${miniAppBaseUrl}/api/v1/payout`;

  const body = {
    event_uuid: eventUuid,
    amount: amount,
    tx_hash: txHash,
    paid_by: userId,
  };

  const headers = getMiniAppHmacHeaders(body);

  try {
    const res = await axios.post(endpoint, body, {
      headers,
      timeout: 10000,
    });

    if (res.status === 200 && res.data?.success) {
      await ctx.reply(
        `✅ <b>Payout Recorded Successfully!</b>\n\n` +
          `• <b>Event UUID:</b> <code>${eventUuid}</code>\n` +
          `• <b>Amount:</b> <code>${amount}</code>\n` +
          `• <b>Tx Hash:</b> <code>${txHash}</code>\n` +
          `• <b>Status:</b> <code>payed_to_organizer</code>\n` +
          `• <b>Recorded By:</b> <code>${userId}</code>`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(`❌ Failed to record payout: ${res.data?.message || "Unknown error"}`);
    }
  } catch (error: any) {
    const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    logger.error("Payout command error:", error.response?.data || error);
    await ctx.reply(`❌ Payout error: ${errMsg}`);
  }
});

