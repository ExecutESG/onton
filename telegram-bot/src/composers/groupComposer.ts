import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types/MyContext";
import { isUserAdmin, isUserOrganizerOrAdmin } from "../db/db"; // Your existing methods for role checks
import { logger } from "../utils/logger";
import { checkIfBotIsAdminLocal } from "../helpers/checkIfBotIsAdminLocal";

// Import your new DB methods
import {
  getUpcomingOnlineRegEventsForAdmin,
  getUpcomingOnlineRegEventsForOrganizer,
  getEventById,
  updateEventTelegramGroup,
} from "../db/db";
import { isNewCommand } from "../helpers/isNewCommand"; // or wherever you put them

export const groupComposer = new Composer<MyContext>();

/**
 * 1) Middleware: Ensure user is organizer or admin for group management routes
 */
groupComposer.use(async (ctx, next) => {
  const isGroupCommand = Boolean(ctx.hasCommand?.("invitor") || ctx.message?.text?.startsWith("/invitor"));
  const isGroupCallback = Boolean(ctx.callbackQuery?.data?.startsWith("grpev_"));
  const isGroupSession = Boolean(ctx.session?.groupStep);

  // If this update is not related to group management, pass through immediately
  if (!isGroupCommand && !isGroupCallback && !isGroupSession) {
    return next();
  }

  const userIdString = ctx.from?.id?.toString();
  if (!userIdString) {
    if (isGroupCommand) await ctx.reply("Could not detect your user ID. Please try again.");
    return;
  }

  const { isOrganizerOrAdmin } = await isUserOrganizerOrAdmin(userIdString);
  if (!isOrganizerOrAdmin) {
    if (isGroupCommand) {
      await ctx.reply("You are not authorized to manage event groups.");
    } else if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Unauthorized: Organizer or Admin role required." });
    }
    return;
  }

  await next();
});

/**
 * 2) Command: /invitor
 *    - Lists upcoming “online” events that have registration, not ended yet
 *    - If admin => all matching, if organizer => only user’s events
 */
groupComposer.command("invitor", async (ctx) => {
  ctx.session.groupStep = undefined;
  ctx.session.groupEventId = undefined;
  ctx.session.groupEventUUID = undefined;
  ctx.session.groupEventTitle = undefined;
  ctx.session.pendingGroupId = undefined;

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not detect your user ID. Please try again.");
    return;
  }

  // Check admin or organizer
  const { isAdmin } = await isUserAdmin(String(userId));

  let eventsList;
  try {
    if (isAdmin) {
      eventsList = await getUpcomingOnlineRegEventsForAdmin();
    } else {
      eventsList = await getUpcomingOnlineRegEventsForOrganizer(userId);
    }
  } catch (err) {
    logger.error("Error fetching events in /invitor command:", err);
    await ctx.reply("Failed to fetch your events. Please try again later.");
    return;
  }

  if (!eventsList || !eventsList.length) {
    await ctx.reply("No upcoming events with registration found for you.");
    return;
  }

  // Build inline keyboard to list events
  const kb = new InlineKeyboard();
  for (const row of eventsList) {
    const label = row.title || `Event #${row.event_id}`;
    kb.text(label, `grpev_select_${row.event_id}`).row();
  }

  ctx.session.groupStep = "selectEvent";
  await ctx.reply(
    "Please select the event you want to link with a Telegram group:",
    { reply_markup: kb },
  );
});

/**
 * 3) Callback: user picks an event => store event_id in session, but first check if group ID is already set
 */
groupComposer.callbackQuery(/^grpev_select_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const eventId = Number(ctx.match[1]);
  if (!eventId) {
    await ctx.reply("Could not read the event ID. Please try again.");
    return;
  }

  // 3a) Lookup event in DB
  let eventRow;
  try {
    eventRow = await getEventById(eventId);
  } catch (err) {
    logger.error("Error reading event from DB:", err);
    await ctx.reply("Error reading event from DB. Please try again.");
    return;
  }
  if (!eventRow) {
    await ctx.reply("Event not found in DB.");
    return;
  }

  // 3b) If event_telegram_group is already set => show error & stop
  if (eventRow.event_telegram_group) {
    // Optionally: fetch group info from Telegram to show name
    try {
      // We'll use ctx.api + checkIfBotIsAdminLocal
      // but we only need getChat(...) if we want the group name
      const me = await ctx.api.getMe();
      const chatMember = await ctx.api.getChatMember(
        eventRow.event_telegram_group,
        me.id,
      );

      // Attempt to get the chat's details:
      const chatInfo = await ctx.api.getChat(eventRow.event_telegram_group);

      // Show user the existing group info
      await ctx.reply(
        `This event already has a Telegram group set!\n\n` +
        `Group ID: <code>${eventRow.event_telegram_group}</code>\n` +
        `Group Name: <b>${chatInfo.title}</b>\n\n` +
        `You cannot change it again.`,
        { parse_mode: "HTML" },
      );
    } catch (error) {
      // If we fail to get chat info, still show the ID
      await ctx.reply(
        `This event already has a Telegram group set: <code>${eventRow.event_telegram_group}</code>\n` +
        `You cannot change it again.`,
        { parse_mode: "HTML" },
      );
    }
    return; // Stop flow
  }

  // 3c) If group not set, continue
  ctx.session.groupEventId = eventRow.event_id;
  ctx.session.groupEventUUID = eventRow.event_uuid;
  ctx.session.groupEventTitle = eventRow.title || "Unnamed Event";

  // Double-check user ownership or admin
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not detect your user ID. Please try again.");
    return;
  }

  const { isAdmin } = await isUserAdmin(String(userId));
  if (!isAdmin && eventRow.owner !== userId) {
    await ctx.reply("You do not own this event and are not an admin. Access denied.");
    return;
  }

  // Confirm selection
  ctx.session.groupStep = "confirmEvent";
  const kb = new InlineKeyboard()
    .text("Yes", "grpev_yes")
    .text("No", "grpev_no");

  await ctx.reply(
    `You selected: <b>${ctx.session.groupEventTitle}</b>\n\nProceed?`,
    { parse_mode: "HTML", reply_markup: kb },
  );
});

/**
 * 4) If user taps "Yes" => ask for group ID
 */
groupComposer.callbackQuery("grpev_yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!ctx.session.groupEventId) {
    await ctx.reply("No event in session. /cancel or start over.");
    return;
  }

  ctx.session.groupStep = "askGroupId";
  await ctx.reply(
    `Please add <b>Onton Bot</b> as an admin in your event’s Telegram group.\n` +
    `Then, in that group, use a command like <code>/id</code> to find the numeric ID.\n\n` +
    `Paste the group ID here (e.g. <code>-1001234567890</code>):`,
    { parse_mode: "HTML" },
  );
});

/**
 * 4b) If user taps "No" => cancel
 */
groupComposer.callbackQuery("grpev_no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.groupStep = undefined;
  ctx.session.groupEventId = undefined;
  ctx.session.groupEventUUID = undefined;
  ctx.session.groupEventTitle = undefined;
  await ctx.reply("Operation canceled. Type /invitor to start over.");
});

/**
 * 5) Wait for the group ID from user text
 */
groupComposer.on("message:text", async (ctx, next) => {
  if (isNewCommand(ctx)) {
    ctx.session = {};
    return next();
  }
  if (ctx.session.groupStep !== "askGroupId") {
    return next(); // not in group ID input step
  }

  const text = ctx.message.text.trim();
  const parsedId = parseInt(text, 10);

  if (isNaN(parsedId) || (!text.startsWith("-100") && !text.startsWith("-"))) {
    await ctx.reply(
      "Invalid group ID. It usually starts with <code>-100</code> or <code>-</code>. Please try again.",
      { parse_mode: "HTML" },
    );
    return;
  }

  // 5a) Check if bot is admin
  try {
    const checkRes = await checkIfBotIsAdminLocal(parsedId, ctx.api);
    if (!checkRes.success) {
      await ctx.reply("Bot is not an admin in that group. Please add bot as admin first.");
      return;
    }

    // 5b) Show group details => confirm final
    ctx.session.pendingGroupId = parsedId;
    ctx.session.groupStep = "confirmGroup";

    const { title, type } = checkRes.chatInfo || {};
    const kb = new InlineKeyboard()
      .text("Yes", "grpev_confirm_yes")
      .text("No", "grpev_confirm_no");

    await ctx.reply(
      `Group Check Success!\n\n` +
      `Group Title: <b>${title || "Unknown"}</b>\n` +
      `Group Type: <b>${type || "?"}</b>\n\n` +
      `Do you want to set this group for <b>${ctx.session.groupEventTitle}</b>?`,
      { parse_mode: "HTML", reply_markup: kb },
    );
  } catch (err) {
    logger.error("Error calling checkIfBotIsAdminLocal:", err);
    await ctx.reply("Error verifying bot admin status. Please try again or contact support.");
  }
});

/**
 * 6) Final confirmation => update DB or cancel
 */
groupComposer.callbackQuery("grpev_confirm_yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.groupStep !== "confirmGroup") {
    await ctx.reply("Not in the correct step. /cancel or start again.");
    return;
  }

  const eventId = ctx.session.groupEventId;
  const groupId = ctx.session.pendingGroupId;
  if (!eventId || !groupId) {
    await ctx.reply("Missing event or group ID in session. /cancel or try again.");
    return;
  }

  // Update DB
  try {
    await updateEventTelegramGroup(eventId, groupId);
  } catch (err) {
    logger.error("Failed to update event_telegram_group:", err);
    await ctx.reply("Failed to update the database. Please try again later.");
    return;
  }

  // Reset session
  ctx.session.groupStep = undefined;
  ctx.session.groupEventId = undefined;
  ctx.session.groupEventUUID = undefined;
  ctx.session.groupEventTitle = undefined;
  ctx.session.pendingGroupId = undefined;

  await ctx.reply("Success! The event now has a Telegram group ID set.");
});

groupComposer.callbackQuery("grpev_confirm_no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.groupStep = undefined;
  ctx.session.groupEventId = undefined;
  ctx.session.groupEventUUID = undefined;
  ctx.session.groupEventTitle = undefined;
  ctx.session.pendingGroupId = undefined;
  await ctx.reply("Canceled. The group was not set for any event.");
});
