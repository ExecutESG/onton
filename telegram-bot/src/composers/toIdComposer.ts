import { Composer, InlineKeyboard, InputFile } from "grammy";
import { MyContext } from "../types/MyContext";
import { Readable } from "stream";
import axios from "axios";
import { getUser, isUserAdmin } from "../db/users"; // or wherever `getUser` is exported
import { logger } from "../utils/logger";

const usernameLimit = 3000;
const minimumLimitToPrintInCaption = 30;

export const toIdComposer = new Composer<MyContext>();

/*
  Possible session states:
  - "askMethod" -> show inline keyboard (upload file or enter text)
  - "askFile"   -> expecting a CSV document
  - "askText"   -> expecting multiline text
  - "done"      -> reset or finish
*/
// 1) Admin Check Middleware for /2id tool
toIdComposer.use(async (ctx, next) => {
  const is2IdCommand = Boolean(ctx.hasCommand?.("2id") || ctx.message?.text?.startsWith("/2id"));
  const is2IdCallback = Boolean(ctx.callbackQuery?.data?.startsWith("toid_"));
  const is2IdSession = Boolean(ctx.session?.toIdStep);

  // If this update is not related to the 2id tool, pass through immediately
  if (!is2IdCommand && !is2IdCallback && !is2IdSession) {
    return next();
  }

  if (!ctx.from) {
    return next();
  }

  const userIdString = ctx.from.id.toString();
  const { isAdmin } = await isUserAdmin(userIdString);

  if (!isAdmin) {
    if (is2IdCommand) {
      await ctx.reply("You are not authorized to use the 2id admin tool.");
    } else if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Unauthorized: Admin role required." });
    }
    return;
  }

  return next();
});
/**
 *  /2id command entry point
 */
toIdComposer.command("2id", async (ctx) => {
  // Reset any previous flow data
  ctx.session.toIdStep = "askMethod";

  const keyboard = new InlineKeyboard()
    .text("Upload CSV File", "toId_file")
    .text("Enter by Message", "toId_text");

  await ctx.reply(
    "How do you want to provide the usernames?\n" +
    "- **Upload CSV File**: A single-column CSV.\n" +
    "- **Enter by Message**: Each username on its own line.\n\n" +
    "⚠️ Please consider that the telegram usernames are case-sensitive.\n\n" +
    `⚠️ Also, Consider Data privacy and GDPR compliance.\n\n` +
    `you can get only ${usernameLimit} usernames per request.\n` +
    "Type /cancel to abort.",
    { reply_markup: keyboard, parse_mode: "Markdown" },
  );
});

/**
 * Handle inline buttons for "askMethod" step
 */
toIdComposer.on("callback_query:data", async (ctx, next) => {
  const step = ctx.session.toIdStep;
  if (step !== "askMethod") return next();

  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery(); // close loading icon

  if (data === "toId_file") {
    ctx.session.toIdStep = "askFile";
    await ctx.reply(
      "Okay, please upload a CSV file with **one column** of usernames.\n" +
      "Type /cancel to abort.",
      { parse_mode: "Markdown" },
    );
  } else if (data === "toId_text") {
    ctx.session.toIdStep = "askText";
    await ctx.reply(
      "Okay, please send me a text message. **Each line** must have one username.\n" +
      "Type /cancel to abort.",
      { parse_mode: "Markdown" },
    );
  } else {
    await ctx.reply("Unknown choice. Please try again or /cancel.");
  }
});

/**
 * Handle the CSV file if step=askFile
 */
toIdComposer.on("message:document", async (ctx, next) => {
  if (ctx.session.toIdStep !== "askFile") return next();

  // Attempt to process the file
  const document = ctx.message.document;
  if (!document) {
    await ctx.reply("No file detected. Please upload a CSV or /cancel.");
    return;
  }

  // Simple check for .csv extension
  if (!document.file_name?.endsWith(".csv")) {
    await ctx.reply("Please upload a file with `.csv` extension.");
    return;
  }

  try {
    await processUsernamesCsv(ctx, document.file_id);
  } catch (err) {
    logger.error("Error processing 2id CSV:", err);
    await ctx.reply("Error processing your CSV. Try again or /cancel.");
    return;
  }

  // Done
  ctx.session.toIdStep = "done";
});

/**
 * Handle text input if step=askText
 */
toIdComposer.on("message:text", async (ctx, next) => {
  if (ctx.session.toIdStep !== "askText") return next();

  const inputText = ctx.message.text;
  if (!inputText.trim()) {
    await ctx.reply("No usernames found. Please try again or /cancel.");
    return;
  }

  // Each line = one username
  const lines = inputText.split("\n").map((line) => line.trim());
  await processUsernamesArray(ctx, lines);

  // Done
  ctx.session.toIdStep = "done";
});

// -- Utility functions --

/**
 * 1) Download CSV from Telegram
 * 2) Parse lines
 * 3) Pass to processUsernamesArray
 */
async function processUsernamesCsv(ctx: MyContext, fileId: string) {
  // 1) Retrieve file URL
  const fileInfo = await ctx.api.getFile(fileId);
  if (!fileInfo.file_path) {
    throw new Error("Unable to retrieve file path from Telegram");
  }

  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

  // 2) Download
  const axiosRes = await axios.get<ArrayBuffer>(fileUrl, {
    responseType: "arraybuffer",
  });
  const fileBuffer = Buffer.from(axiosRes.data);

  // 3) Convert to lines
  const fileContent = fileBuffer.toString("utf-8").trim();
  const lines = fileContent.split("\n").map((l) => l.trim());
  if (lines.length > usernameLimit) {
    await ctx.reply(`You can get only ${usernameLimit} usernames per request.`);
    return;
  }
  // 4) Process as array
  await processUsernamesArray(ctx, lines);
}

/**
 * For each username in `lines`:
 *  - Strip @ or https://t.me/
 *  - Check DB => build CSV of (username, user_id|not_exist)
 *
 * NOT FOUND rows go first, then FOUND rows.
 * Finally, send the CSV back to user with a summary caption.
 *
 * If fewer than minimumLimitToPrintInCaption usernames, also list each username in the final message
 * with the format "@username, user_id" (or "@username, not_exist").
 */
async function processUsernamesArray(ctx: MyContext, lines: string[]) {
  if (!lines.length) {
    await ctx.reply("No usernames found. Flow canceled.");
    return;
  }

  const foundRows: Array<{ username: string; userId: number }> = [];
  const notFoundRows: string[] = [];

  // 1) Clean and categorize
  for (const rawLine of lines) {
    const cleanUsername = cleanTelegramUsername(rawLine);
    if (!cleanUsername) {
      // If line was empty after cleaning, skip
      continue;
    }

    // 2) DB lookup
    const user = await getUser(cleanUsername);
    if (!user) {
      notFoundRows.push(cleanUsername);
    } else {
      foundRows.push({ username: cleanUsername, userId: user.user_id });
    }
  }

  // 3) Build final CSV
  // Header: "username,user_id"
  const csvRows: string[] = [];
  // Not found first
  for (const username of notFoundRows) {
    csvRows.push(`${username},not_exist`);
  }
  // Then found
  for (const { username, userId } of foundRows) {
    csvRows.push(`${username},${userId}`);
  }

  const finalCsv = ["username,user_id", ...csvRows].join("\n");

  // 4) Summary
  const totalNotFound = notFoundRows.length;
  const totalFound = foundRows.length;
  const summaryLine = `Total Found: ${totalFound}, Not Found: ${totalNotFound}`;

  // 5) If fewer than minimumLimitToPrintInCaption lines, build an extra detail list for the caption
  let detailList = "";
  if (lines.length < minimumLimitToPrintInCaption) {
    // not found first
    for (const username of notFoundRows) {
      detailList += `@${username}, not_exist\n`;
    }
    // found
    for (const { username, userId } of foundRows) {
      detailList += `@${username}, ${userId}\n`;
    }
  }

  const finalCaption = detailList
    ? `${detailList}\n${summaryLine}`
    : summaryLine;

  // 6) Send the CSV
  const fileStream = Readable.from(finalCsv);
  const timeStamp = Date.now();
  const inputFile = new InputFile(fileStream, `2id-results-${timeStamp}.csv`);

  await ctx.replyWithDocument(inputFile, {
    caption: finalCaption,
  });
}

/**
 * Removes leading '@' and "https://t.me/" from a string
 */
function cleanTelegramUsername(input: string): string {
  let output = input.trim();

  // remove any leading @
  if (output.startsWith("@")) {
    output = output.slice(1);
  }

  // remove "https://t.me/"
  output = output.replace(/^https?:\/\/t\.me\//i, "");

  return output.trim();
}
