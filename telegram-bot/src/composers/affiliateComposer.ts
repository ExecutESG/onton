import { Composer, InlineKeyboard, InputFile } from "grammy";
import { MyContext } from "../types/MyContext";
import {
  createAffiliateLinks, findUserById, getAffiliateLinksByItemId,
  getEvent,
  getEventById, getUpcomingPaidEvents,
  isUserAdmin,
  isUserOrganizerOrAdmin,
  pool,
} from "../db/db";
import { Readable } from "stream";
import { logger } from "../utils/logger";
import { checkRateLimit } from "../utils/checkRateLimit";
import * as process from "node:process";
import { isNewCommand } from "../helpers/isNewCommand";
import { parse } from "csv-parse/sync";
import { sendMessageWithInfinityRetry } from "../helpers/sendMessageWithInfinityRetry"; // CSV parser

const affiliateLinksLimitCount = 150;
// For Node < 18, you might need "node-fetch" to enable global fetch.
// import fetch from "node-fetch";

export const affiliateComposer = new Composer<MyContext>();

/**
 *  MIDDLEWARE: Check if user is at least organizer or admin for affiliate routes
 */
affiliateComposer.use(async (ctx, next) => {
  const isAffiliateCommand = Boolean(ctx.hasCommand?.("affiliate") || ctx.message?.text?.startsWith("/affiliate"));
  const isAffiliateCallback = Boolean(
    ctx.callbackQuery?.data?.startsWith("aff_") ||
    ctx.callbackQuery?.data?.startsWith("choose_event_")
  );
  const isAffiliateSession = Boolean(ctx.session?.affiliateStep);

  // If this update is not related to the affiliate flow, pass through immediately
  if (!isAffiliateCommand && !isAffiliateCallback && !isAffiliateSession) {
    return next();
  }

  const userIdString = ctx.from?.id?.toString();
  if (!userIdString) {
    if (isAffiliateCommand) await ctx.reply("Could not detect your user ID. Please try again.");
    return;
  }

  const { isOrganizerOrAdmin } = await isUserOrganizerOrAdmin(userIdString);
  if (!isOrganizerOrAdmin) {
    if (isAffiliateCommand) {
      await ctx.reply("You are not authorized to access affiliate management features.");
    } else if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Unauthorized: Organizer or Admin role required." });
    }
    return;
  }

  // Otherwise, proceed
  await next();
});

/**
 * STEP 0: /affiliate command
 */
affiliateComposer.command("affiliate", async (ctx) => {
  // Reset session
  ctx.session.affiliateStep = undefined;
  ctx.session.affiliateLinkType = undefined;
  ctx.session.affiliateEventUUID = undefined;
  ctx.session.affiliateEventId = undefined;
  ctx.session.affiliateEventTitle = undefined;
  ctx.session.affiliateLinkCount = undefined;
  ctx.session.affiliateLinkTitle = undefined;
  ctx.session.existingLinksCount = undefined;
  ctx.session.csvRows = undefined;          // For CSV-based creation
  ctx.session.csvCreatedLinks = undefined;  // Store newly created links
  ctx.session.broadcastStep = undefined;

  logger.log(`User ${ctx.from?.id} ran /affiliate`);

  // Inline keyboard: "Event", "Play-to-Earn (disabled)"
  const inlineKb = new InlineKeyboard()
    .text("Event", "aff_event")
    .row()
    .text("Play-to-Earn (disabled)", "aff_p2e");

  await ctx.reply(
    "Which type of affiliation do you want to create?\n" +
    "Or Type /cancel to cancel the operation.\n",
    {
      reply_markup: inlineKb,
    },
  );
});

/**
 * STEP 1: "Event" or "Play-to-Earn" button
 */
affiliateComposer.callbackQuery("aff_event", async (ctx) => {
  await ctx.answerCallbackQuery();

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not detect your user ID. Please try again.");
    return;
  }

  const { isAdmin } = await isUserAdmin(String(userId));

  // Fetch events from the DB using the helper
  const events = await getUpcomingPaidEvents(isAdmin, String(userId));

  if (events.length === 0) {
    if (isAdmin) {
      await ctx.reply("No upcoming paid events found at all.");
    } else {
      await ctx.reply("No upcoming paid events found for you (owner).");
    }
    return;
  }

  // Build inline keyboard
  const kb = new InlineKeyboard();
  for (const row of events) {
    const uuid = row.event_uuid;
    const title = row.title || "Untitled";
    kb.text(title, `choose_event_${uuid}`).row();
  }
  ctx.session.affiliateLinkType = "EVENT";
  ctx.session.affiliateStep = "pickingEvent";

  await ctx.reply("Please select an event from the list:", {
    reply_markup: kb,
  });
});


affiliateComposer.callbackQuery("aff_p2e", async (ctx) => {
  await ctx.answerCallbackQuery({
    text: "Play-to-Earn affiliation is not implemented yet. Choose Event.",
    show_alert: true,
  });
});

/**
 * STEP 2: user taps "choose_event_<uuid>"
 */
affiliateComposer.callbackQuery(/^choose_event_(.*)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  const uuid = ctx.match[1];
  if (!uuid) {
    await ctx.reply("No event UUID found. /cancel or try again.");
    return;
  }

  // Fetch event data using our helper function
  const eventRow = await getEvent(uuid);
  if (!eventRow) {
    await ctx.reply("Event not found. /cancel or try again.");
    return;
  }

  const { event_id, owner, title } = eventRow;
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not read your user ID. Please try again.");
    return;
  }

  // Check permission
  const { isAdmin } = await isUserAdmin(String(userId));
  const isOwner = Number(owner) === userId;
  if (!isAdmin && !isOwner) {
    await ctx.reply("You lack permission to create affiliate links for this event!");
    return;
  }

  // Save relevant data to session
  ctx.session.affiliateEventUUID = uuid;
  ctx.session.affiliateEventId = event_id;
  ctx.session.affiliateEventTitle = title;
  ctx.session.affiliateStep = "confirmEvent";

  // Ask user to confirm
  const inlineKb = new InlineKeyboard()
    .text("Yes", "aff_ev_yes")
    .text("No", "aff_ev_no");

  await ctx.reply(
    `You selected the event: "${title}".\nDo you want to continue?`,
    { reply_markup: inlineKb },
  );
});
/**
 * STEP 2.5: "Yes" or "No"
 */
affiliateComposer.callbackQuery("aff_ev_yes", async (ctx) => {
  await ctx.answerCallbackQuery();

  const eventId = ctx.session.affiliateEventId;
  if (!eventId) {
    await ctx.reply("No event in session. /cancel or start over.");
    ctx.session.affiliateStep = undefined;
    return;
  }

  // check existing links
  const client = await pool.connect();
  try {
    console.log("Checking existing links for event:", eventId);
    const res = await client.query(
      `SELECT COUNT(*) AS total
       FROM affiliate_links
       WHERE "Item_id" = $1`,
      [eventId],
    );
    const existing = parseInt(res.rows[0]?.total ?? "0", 10);
    console.log("Existing links:", existing);
    ctx.session.existingLinksCount = existing;
  } finally {
    client.release();
  }

  // Next step: "Add new links" or "Get report"
  ctx.session.affiliateStep = "chooseAction";
  const inlineKb = new InlineKeyboard()
    .text("Add new links", "aff_act_addLinks")
    .row()
    .text("Get report", "aff_act_report");

  await ctx.reply("What do you want to do?", {
    reply_markup: inlineKb,
  });
});

affiliateComposer.callbackQuery("aff_ev_no", async (ctx) => {
  await ctx.answerCallbackQuery();
  // Cancel
  ctx.session.affiliateStep = undefined;
  ctx.session.affiliateEventUUID = undefined;
  ctx.session.affiliateEventId = undefined;
  ctx.session.affiliateEventTitle = undefined;
  ctx.session.existingLinksCount = undefined;
  await ctx.reply("Cancelled. Type /affiliate to start over.");
});

/**
 * STEP 3: "Add new links" or "Get report"
 */
affiliateComposer.callbackQuery("aff_act_addLinks", async (ctx) => {
  await ctx.answerCallbackQuery();

  // Instead of going directly to "askCountOfLinks",
  // we ask the user if they want "Batch" or "Specific CSV"
  ctx.session.affiliateStep = "chooseLinkCreationMode";

  const kb = new InlineKeyboard()
    .text("Batch", "aff_mode_batch")
    .row()
    .text("Specific CSV", "aff_mode_csv");

  await ctx.reply("Which method do you want to use to create new links?", {
    reply_markup: kb,
  });
});

affiliateComposer.callbackQuery("aff_act_report", async (ctx) => {
  await ctx.answerCallbackQuery();

  // 1) Rate Limit Check (3 per 15 minutes)
  const userId = ctx.from?.id?.toString() || "";
  const routeName = "get_report";
  const { allowed } = await checkRateLimit(userId, routeName, 3, 900);
  if (!allowed) {
    await ctx.reply(
      "You have reached the maximum of 3 reports per 15 minutes. Please try again later.",
    );
    return;
  }

  ctx.session.affiliateStep = "reporting";
  const eventId = ctx.session.affiliateEventId;
  const eventTitle = ctx.session.affiliateEventTitle || "Unnamed Event";
  if (!eventId) {
    await ctx.reply("No event in session. /cancel or try again.");
    ctx.session.affiliateStep = undefined;
    return;
  }

  // 2) Generate and send the report
  try {
    // Fetch rows using our separate helper
    const rows = await getAffiliateLinksByItemId(eventId);
    if (!rows.length) {
      await ctx.reply(`No affiliate links found for event "${eventTitle}".`);
      ctx.session.affiliateStep = undefined;
      return;
    }

    // Build CSV
    const header = "link_id,link_hash,title,group_title,clicks,purchases";
    const csvRows = await Promise.all(
      rows.map(async (r) => {
        // If it's an EVENT type, get additional event data
        if (r.itemtype === "EVENT" && r.itemid) {
          const eventData = await getEventById(r.itemid);
          return `${r.id},https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventData.event_uuid}-affiliate-${r.link_hash},${r.title || ""},${r.group_title || ""},${r.clicks},${r.purchases}`;
        } else {
          // Otherwise, just build a generic link
          return `${r.id},https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=affiliate-${r.link_hash},${r.title || ""},${r.group_title || ""},${r.clicks},${r.purchases}`;
        }
      }),
    );
    const finalCsv = [header, ...csvRows].join("\n");
    const csvStream = Readable.from(finalCsv);

    const datePart = new Date().toISOString().split("T")[0];
    const filename = `aff-report-${eventId}-${datePart}.csv`;
    const inputFile = new InputFile(csvStream, filename);

    await ctx.replyWithDocument(inputFile, {
      caption: `Affiliate Report for Event "${eventTitle}"`,
    });
  } catch (error) {
    console.error("Error generating affiliate report:", error);
    await ctx.reply(`Error generating report: ${error}`);
  }

  // Reset step at the end
  ctx.session.affiliateStep = undefined;
});
/**
 * STEP 3.1: Choose Link Creation Mode => "Batch" or "CSV"
 */
affiliateComposer.callbackQuery("aff_mode_batch", async (ctx) => {
  await ctx.answerCallbackQuery();
  // The old flow: ask "How many links?"
  ctx.session.affiliateStep = "askCountOfLinks";
  await ctx.reply("How many links do you want to create (Batch)?");
});

affiliateComposer.callbackQuery("aff_mode_csv", async (ctx) => {
  await ctx.answerCallbackQuery();
  // Next step: user must upload a CSV with two columns: user_id, username
  ctx.session.affiliateStep = "waitingForCsvUpload";

  await ctx.reply(
    "Please upload a CSV file with **two columns**: user_id, username.\n" +
    "Example:\n\n" +
    "```\n12345678,JohnDoe\n22334455,AliceTest\n```\n\n" +
    "If a user is not in our database, the link won’t be created for that user.\n" +
    "Or type /cancel to abort.",
  );
});

/**
 * Interface for CSV Rows
 */
interface AffiliatorCsvRow {
  rawUserId: string;
  csvUserName: string;
  isValid: boolean;
  reason?: string;      // e.g. "Not onton user", "Invalid user_id", etc.
  dbUserId?: number;    // If found in DB
  dbUsername?: string;  // If found in DB
  firstName?: string;   // If found in DB
}

/**
 * Handle the CSV file (Specific Affiliator list)
 */
affiliateComposer.on("message:document", async (ctx, next) => {
  if (ctx.session.affiliateStep !== "waitingForCsvUpload") {
    return next();
  }

  try {
    // Check file extension
    const fileName = ctx.message.document.file_name?.toLowerCase() || "";
    if (!fileName.endsWith(".csv")) {
      await ctx.reply("Please upload a .csv file (two columns).");
      return;
    }

    // 1) Retrieve the file link
    const file = await ctx.api.getFile(ctx.message.document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // 2) Download the CSV content
    const response = await fetch(fileUrl);
    const fileBuffer = await response.arrayBuffer();
    const fileString = Buffer.from(fileBuffer).toString("utf-8");

    // 3) Parse CSV
    // Expect each line: user_id,username
    const records = parse(fileString, { skipEmptyLines: true });

    // Build list of user checks
    const csvRows: AffiliatorCsvRow[] = [];
    for (const row of records) {
      if (!Array.isArray(row) || row.length < 2) {
        csvRows.push({
          rawUserId: "",
          csvUserName: "",
          isValid: false,
          reason: "Invalid row format (needs 2 columns)",
        });
        continue;
      }

      const [rawUserId, csvUserName] = row.map((x) => String(x).trim());
      const userIdInt = parseInt(rawUserId, 10);

      if (isNaN(userIdInt)) {
        csvRows.push({
          rawUserId,
          csvUserName,
          isValid: false,
          reason: `Invalid user_id: ${rawUserId}`,
        });
        continue;
      }

      // Use our helper function to check user in DB
      const dbRow = await findUserById(userIdInt);
      if (!dbRow) {
        csvRows.push({
          rawUserId,
          csvUserName,
          isValid: false,
          reason: "Not onton user",
        });
      } else {
        csvRows.push({
          rawUserId,
          csvUserName,
          isValid: true,
          dbUserId: dbRow.user_id,
          dbUsername: dbRow.username,
          firstName: dbRow.first_name || "",
        });
      }
    }

    // 4) Store rows in session
    ctx.session.csvRows = csvRows;
    ctx.session.affiliateStep = "reviewCsvRows";

    // Summarize
    let msg = "CSV Rows Summary:\n\n";
    csvRows.forEach((r, idx) => {
      if (!r.isValid) {
        msg += `${idx + 1}) user_id=${r.rawUserId} => ${r.reason}\n`;
      } else {
        const namePart = r.firstName ? `(${r.firstName})` : "";
        msg += `${idx + 1}) user_id=${r.dbUserId} => ${r.dbUsername} ${namePart}\n`;
      }
    });
    console.log(msg);
    await ctx.reply(msg, { parse_mode: "HTML" });

    // Ask for confirmation
    const kb = new InlineKeyboard()
      .text("Confirm", "aff_csv_confirm")
      .row()
      .text("Cancel", "aff_cancel_csv");

    await ctx.reply("Do you want to proceed creating links for these users?", {
      reply_markup: kb,
    });
  } catch (err) {
    console.error("Error handling CSV upload:", err);
    await ctx.reply(`Error reading CSV: ${err}`);
  }
});
/**
 * Cancel CSV creation
 */
affiliateComposer.callbackQuery("aff_cancel_csv", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.csvRows = undefined;
  ctx.session.affiliateStep = undefined;
  await ctx.reply(
    "Cancelled CSV affiliate creation. Type /affiliate to start over.",
  );
});

/**
 * Confirm CSV creation => ask for base title
 */
affiliateComposer.callbackQuery("aff_csv_confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.affiliateStep = "askTitleOfLinksCsv";
  await ctx.reply("Please enter a base title for these links (CSV mode).");
});

/**
 * STEP 4A (CSV MODE): askTitleOfLinksCsv => create a link per valid CSV row
 * Then ask user for a broadcast message => send DM to each affiliator
 */
affiliateComposer.on("message:text", async (ctx, next) => {
  if (isNewCommand(ctx)) return next();

  // A) Creating CSV-based affiliate links
  if (ctx.session.affiliateStep === "askTitleOfLinksCsv") {
    const baseTitle = ctx.message.text.trim().replace(/,/g, " ");
    if (!baseTitle) {
      await ctx.reply("Please enter a non-empty title.");
      return;
    }

    // Validate event in session
    const eventId = ctx.session.affiliateEventId;
    const eventUUID = ctx.session.affiliateEventUUID;
    const eventTitle = ctx.session.affiliateEventTitle || "Untitled";
    if (!eventId || !eventUUID) {
      await ctx.reply("Missing event data in session. /cancel and try again.");
      ctx.session.affiliateStep = undefined;
      return;
    }

    // Validate CSV rows
    const csvRows = ctx.session.csvRows || [];
    const validRows = csvRows.filter((r: AffiliatorCsvRow) => r.isValid);
    const invalidCount = csvRows.length - validRows.length;

    if (!validRows.length) {
      await ctx.reply("No valid rows to create links for. Cancelling.");
      ctx.session.csvRows = undefined;
      ctx.session.affiliateStep = undefined;
      return;
    }

    // Check total limit affiliateLinksLimitCount
    const existing = ctx.session.existingLinksCount ?? 0;
    const newTotal = existing + validRows.length;
    if (newTotal > affiliateLinksLimitCount) {
      const remaining = affiliateLinksLimitCount - existing;
      if (remaining <= 0) {
        await ctx.reply(
          `This event already has ${existing} affiliate links. Limit is ${affiliateLinksLimitCount} total. Cannot create more.`,
        );
      } else {
        await ctx.reply(
          `You can only create a maximum of ${remaining} more links. You tried to create ${validRows.length}. Cancelling.`,
        );
      }
      ctx.session.affiliateStep = undefined;
      return;
    }

    // Everything looks good => create links
    const groupTitle = baseTitle;
    const links = [];
    const client = await pool.connect();

    try {
      let firstLinkId: number | null = null;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const singleLinkTitle = `${baseTitle}-${i + 1}`;
        const linkHash = Math.random().toString(36).substring(2, 10);

        const insertSql = `
            INSERT INTO affiliate_links
            ("Item_id", "item_type", "creator_user_id", "link_hash",
             "total_clicks", "total_purchase", "active", "affiliator_user_id",
             "created_at", "updated_at", "title", "group_title")
            VALUES ($1, 'EVENT', $2, $3,
                    0, 0, true, $4,
                    CURRENT_DATE, NULL, $5, $6)
            RETURNING id, link_hash, title, group_title, affiliator_user_id
        `;
        // For the first row, we insert with an empty group_title, then update
        const groupToUse = i === 0 ? "" : groupTitle;

        const creatorId = ctx.from?.id;
        const res = await client.query(insertSql, [
          eventId,
          creatorId,
          linkHash,
          row.dbUserId, // affiliate_user_id (the actual row user)
          singleLinkTitle,
          groupToUse,
        ]);

        const newLink = res.rows[0];
        // If first row, update group_title
        if (i === 0) {
          firstLinkId = newLink.id;
          await client.query(
            `UPDATE affiliate_links
             SET group_title = $1
             WHERE id = $2`,
            [groupTitle, firstLinkId],
          );
          newLink.group_title = groupTitle;
        }

        // Build a final object we can store in session
        links.push({
          id: newLink.id,
          link_hash: newLink.link_hash,
          title: newLink.title,
          group_title: newLink.group_title,
          item_type: "EVENT",
          item_id: eventId,
          affiliator_user_id: newLink.affiliator_user_id, // store for DM
        });
      }
    } catch (err) {
      console.error("Error creating CSV-based affiliate links:", err);
      await ctx.reply("Error creating CSV-based affiliate links. See logs.");
      ctx.session.affiliateStep = undefined;
      return;
    } finally {
      client.release();
    }

    // Build CSV to send back
    const header = "link_id,link_hash,title,group_title";
    const csvRowsOut = [];
    for (const r of links) {
      const linkUrl = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUUID}-affiliate-${r.link_hash}`;
      csvRowsOut.push(`${r.id},${linkUrl},${r.title},${r.group_title}`);
    }
    const finalCsv = [header, ...csvRowsOut].join("\n");
    const csvStream = Readable.from(finalCsv);
    const datePart = new Date().toISOString().split("T")[0];
    const filename = `affiliate-links-${eventUUID}-csv-${datePart}.csv`;
    const inputFile = new InputFile(csvStream, filename);

    await ctx.replyWithDocument(inputFile, {
      caption:
        `Created ${links.length} affiliate links for Event: "${eventTitle}" (CSV Mode)\n` +
        `Base Title: ${baseTitle}\n` +
        `Group Title: ${groupTitle}\n` +
        `Invalid rows skipped: ${invalidCount}`,
    });

    // 5) Instead of resetting the session, we proceed to ask for broadcast message
    ctx.session.csvCreatedLinks = links; // store newly created links
    ctx.session.affiliateStep = "askMessageToAffiliatorsCsv";

    await ctx.reply(
      "Now, please type the message you'd like to send to each affiliator.\n" +
      "We'll append their personal link at the end. Or type /cancel to skip.",
    );

    return;
  }

  // B) If we just created CSV-based links and are asking for the broadcast message
  if (ctx.session.affiliateStep === "askMessageToAffiliatorsCsv") {
    const userMessage = ctx.message.text.trim();
    if (!userMessage) {
      await ctx.reply("Please enter a non-empty message or type /cancel.");
      return;
    }

    const links = ctx.session.csvCreatedLinks || [];
    if (!Array.isArray(links) || !links.length) {
      await ctx.reply("No links found in session. Please /cancel and start over.");
      ctx.session.affiliateStep = undefined;
      return;
    }

    // Send the message to each affiliator
    let successCount = 0;
    let failCount = 0;

    for (const linkObj of links) {
      const affiliateUserId = linkObj.affiliator_user_id;
      if (!affiliateUserId) {
        failCount++;
        continue;
      }
      // Build link URL
      const linkUrl = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${ctx.session.affiliateEventUUID}-affiliate-${linkObj.link_hash}`;
      const finalText = userMessage + "\n" + linkUrl;

      try {
        await sendMessageWithInfinityRetry(affiliateUserId, finalText, ctx);
        successCount++;
      } catch (error) {
        logger.warn(
          `Failed to send DM to user ${affiliateUserId}. Possibly blocked or restricted.`,
        );
        failCount++;
      }
    }

    await ctx.reply(
      `Done sending messages.\nSuccess: ${successCount}\nFailed: ${failCount}`,
    );

    // Cleanup
    ctx.session.affiliateStep = undefined;
    ctx.session.csvCreatedLinks = undefined;
    ctx.session.csvRows = undefined;

    return;
  }

  return next();
});

/**
 * STEP 4B (BATCH MODE): askCountOfLinks => user types a number
 */
affiliateComposer.on("message:text", async (ctx, next) => {
  if (isNewCommand(ctx)) {
    ctx.session = {};
    return next();
  }

  if (ctx.session.affiliateStep === "askCountOfLinks") {
    const countInput = ctx.message.text.trim();
    const countNum = parseInt(countInput, 10);

    if (isNaN(countNum) || countNum <= 0) {
      await ctx.reply("Invalid number. Please enter a positive integer.");
      return;
    }

    // Check limit affiliateLinksLimitCount
    const existing = ctx.session.existingLinksCount ?? 0;
    const newTotal = existing + countNum;
    if (newTotal > affiliateLinksLimitCount) {
      const remaining = affiliateLinksLimitCount - existing;
      if (remaining <= 0) {
        await ctx.reply(
          `This event already has ${existing} affiliate links. Limit is ${affiliateLinksLimitCount} total.`,
        );
        ctx.session.affiliateStep = undefined;
        return;
      } else {
        await ctx.reply(
          `You can only create a maximum of ${remaining} more links. Enter a smaller number or /cancel.`,
        );
        return;
      }
    }

    ctx.session.affiliateLinkCount = countNum;
    ctx.session.affiliateStep = "askTitleOfLinks";
    await ctx.reply("Please enter a base title for these links (Batch mode):");
    return;
  }

  return next();
});

/**
 * STEP 5 (BATCH MODE): askTitleOfLinks => user enters baseTitle => create links
 */
affiliateComposer.on("message:text", async (ctx, next) => {
  if (isNewCommand(ctx)) return next();

  if (ctx.session.affiliateStep === "askTitleOfLinks") {
    const baseTitle = ctx.message.text.trim().replace(/,/g, " ");
    if (!baseTitle) {
      await ctx.reply("Please enter a non-empty title.");
      return;
    }

    ctx.session.affiliateLinkTitle = baseTitle;
    ctx.session.affiliateStep = "generatingLinks";

    // Insert links
    const count = ctx.session.affiliateLinkCount || 0;
    const eventId = ctx.session.affiliateEventId;
    const eventUUID = ctx.session.affiliateEventUUID;
    const userId = ctx.from?.id;
    const itemType = ctx.session.affiliateLinkType;
    const eventTitle = ctx.session.affiliateEventTitle || "untitled";

    if (!eventId || !eventUUID || !userId || !itemType) {
      await ctx.reply("Missing data in session. /cancel and try again.");
      ctx.session.affiliateStep = undefined;
      return;
    }

    try {
      // Re-use your existing helper
      const { links, groupTitle } = await createAffiliateLinks({
        eventId,
        userId,
        itemType,
        baseTitle,
        count,
      });

      // Build CSV
      const header = "link_id,link_hash,title,group_title";
      const csvRows = await Promise.all(
        links.map(async (r: any) => {
          if (r.item_type === "EVENT" && r.item_id) {
            const eventData = await getEventById(r.item_id);
            return `${r.id},https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventData.event_uuid}-affiliate-${r.link_hash},${r.title || ""},${r.group_title || ""}`;
          } else {
            return `${r.id},https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=affiliate-${r.link_hash},${r.title || ""},${r.group_title || ""}`;
          }
        }),
      );
      const finalCsv = [header, ...csvRows].join("\n");
      const csvStream = Readable.from(finalCsv);

      const datePart = new Date().toISOString().split("T")[0];
      const filename = `affiliate-links-${eventUUID}-${datePart}.csv`;
      const inputFile = new InputFile(csvStream, filename);

      await ctx.replyWithDocument(inputFile, {
        caption:
          `Created ${links.length} affiliate links for Event: "${eventTitle}"\n` +
          `Event UUID: ${eventUUID}\n` +
          `Base Title: ${baseTitle}\n` +
          `Group Title: ${groupTitle || "N/A"}`,
      });
    } catch (error) {
      logger.error("Error creating affiliate links:", error);
      await ctx.reply(`Error creating affiliate links: ${error}`);
    }

    // Reset
    ctx.session.affiliateStep = undefined;
    return;
  }

  return next();
});
