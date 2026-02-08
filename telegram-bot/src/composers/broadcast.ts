// broadcastComposer.ts — rewritten end‑to‑end

import { Composer, InlineKeyboard } from "grammy";
import { MessageEntity } from "grammy/types";
import { MyContext } from "../types/MyContext";
import {
  isUserAdmin,
  getEvent,
  getEventTickets,
  getOrCreateSingleInviteLinkForUserAndChat,
} from "../db/db";
import {
  createBroadcastMessage,
  bulkInsertBroadcastUsers,
} from "../db/broadcast";
import { parse } from "csv-parse/sync";
import axios from "axios";
import { isNewCommand } from "../helpers/isNewCommand";
import { logger } from "../utils/logger";
import { checkBotIsAdmin, extractInviteChatIds } from "../utils/utils";
import { AFFILIATE_PLACEHOLDERS } from "../constants";
import { getOrCreateSingleAffiliateLink } from "../db/affiliateLinks";

// ─────────────────────────────────────────────────────────────────────────────
// Utils — entity → HTML conversion (for rich links, bold, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const htmlEscape = (s: string) =>
    s.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

function entityOpen(e: MessageEntity, raw: string): string {
  switch (e.type) {
    case "bold": return "<b>";
    case "italic": return "<i>";
    case "underline": return "<u>";
    case "strikethrough": return "<s>";
    case "code": return "<code>";
    case "pre": return "<pre>";
    case "text_link": return `<a href=\"${htmlEscape(e.url!)}\">`;
    case "url": {
      const urlText = raw.substr(e.offset, e.length);
      return `<a href=\"${htmlEscape(urlText)}\">`;
    }
    default: return "";
  }
}
function entityClose(e: MessageEntity): string {
  switch (e.type) {
    case "bold": return "</b>";
    case "italic": return "</i>";
    case "underline": return "</u>";
    case "strikethrough": return "</s>";
    case "code": return "</code>";
    case "pre": return "</pre>";
    case "text_link":
    case "url": return "</a>";
    default: return "";
  }
}

function toHtml(text: string, entities?: readonly MessageEntity[]): string {
  if (!entities?.length) return htmlEscape(text);
  const segs: string[] = [];
  let cursor = 0;

  // Telegram ensures entities are non‑overlapping but not strictly ordered
  for (const e of [...entities].sort((a, b) => a.offset - b.offset)) {
    if (e.offset > cursor) segs.push(htmlEscape(text.slice(cursor, e.offset)));
    segs.push(entityOpen(e, text));
    segs.push(htmlEscape(text.slice(e.offset, e.offset + e.length)));
    segs.push(entityClose(e));
    cursor = e.offset + e.length;
  }
  segs.push(htmlEscape(text.slice(cursor)));
  return segs.join("");
}

function extractHtml(msg: MyContext["message"]): string | null {
  if (!msg) return null;
  if ("text" in msg && msg.text !== undefined) return toHtml(msg.text, msg.entities);
  if ("caption" in msg && msg.caption !== undefined) return toHtml(msg.caption, msg.caption_entities);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────────────────────

export const broadcastComposer = new Composer<MyContext>();

// Entry — /broadcast
broadcastComposer.command("broadcast", async (ctx) => {
  const { isAdmin } = await isUserAdmin(String(ctx.from?.id ?? ""));
  if (!isAdmin) return;

  ctx.session = {
    broadcastStep: "chooseTarget",
    broadcastType: undefined,
    broadcastEventUuid: undefined,
    broadcastEventTitle: undefined,
    broadcastUserIds: [],
  } as any;

  const kb = new InlineKeyboard()
      .text("Event Participants", "bc_event")
      .text("Custom CSV", "bc_csv");

  await ctx.reply("Who do you want to broadcast to?", { reply_markup: kb });
});

// Callback router
broadcastComposer.on("callback_query:data", async (ctx, next) => {
  if (ctx.session.broadcastStep !== "chooseTarget") return next();
  await ctx.answerCallbackQuery();

  switch (ctx.callbackQuery.data) {
    case "bc_event":
      ctx.session.broadcastType = "event";
      ctx.session.broadcastStep = "askEventUuid";
      return ctx.reply("Please send the Event UUID (36 characters).");
    case "bc_csv":
      ctx.session.broadcastType = "csv";
      ctx.session.broadcastStep = "askCsv";
      return ctx.reply("Please upload your CSV file now (one user_id per line).");
  }
});

// Message router
broadcastComposer.on("message", async (ctx, next) => {
  if (isNewCommand(ctx)) {
    ctx.session = {} as any;
    return next();
  }
  switch (ctx.session.broadcastStep) {
    case "askEventUuid":
      if (ctx.message?.text) return handleEventUuid(ctx);
      break;
    case "askCsv":
      if (ctx.message?.document) return handleCsvUpload(ctx);
      break;
    case "askBroadcast":
      return handleBroadcastMessage(ctx);
  }
  return next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Step handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleEventUuid(ctx: MyContext) {
  const uuid = ctx.message?.text?.trim();
  if (!uuid) return;
  if (uuid.length !== 36) return ctx.reply("Event UUID must be 36 characters. Try again or /cancel.");

  const eventRow = await getEvent(uuid);
  if (!eventRow) return ctx.reply("Event not found. Check the UUID and try again.");

  const tickets = await getEventTickets(uuid);
  if (!tickets?.length) {
    ctx.session.broadcastStep = "done";
    return ctx.reply(`No participants found for \"${eventRow.title}\".`);
  }

  Object.assign(ctx.session, {
    broadcastEventUuid: uuid,
    broadcastEventTitle: eventRow.title,
    broadcastUserIds: tickets.map((t) => String(t.user_id)),
    broadcastStep: "askBroadcast",
  });

  await ctx.reply(`✅ Event \"${eventRow.title}\" found with ${tickets.length} participant(s).\nNow send any message (text, photo, video, etc.) you want to broadcast.`);
}

async function handleCsvUpload(ctx: MyContext) {
  const doc = ctx.message?.document;
  if (!doc) return ctx.reply("No file found. Please upload a CSV.");
  if (!doc.file_name?.endsWith(".csv")) return ctx.reply("File must end with .csv.");

  const { file_path } = await ctx.api.getFile(doc.file_id);
  if (!file_path) return ctx.reply("Unable to retrieve file path from Telegram.");

  try {
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file_path}`;
    const res = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
    const rows = parse(Buffer.from(res.data).toString("utf-8"), { skip_empty_lines: true });
    const userIds = rows.map((r: string[]) => r[0]?.trim()).filter(Boolean);
    if (!userIds.length) {
      ctx.session.broadcastStep = "done";
      return ctx.reply("No user IDs found in the CSV. Flow canceled.");
    }
    Object.assign(ctx.session, {
      broadcastUserIds: userIds,
      broadcastStep: "askBroadcast",
    });
    await ctx.reply(`✅ CSV parsed. Found ${userIds.length} user(s).\nNow send any message (text, photo, video, etc.) you want to broadcast.`);
  } catch (e) {
    ctx.session.broadcastStep = "done";
    await ctx.reply(`Error parsing CSV: ${String(e)}`);
  }
}

async function handleBroadcastMessage(ctx: MyContext) {
  const { broadcastUserIds: userIds, broadcastType } = ctx.session;
  if (!userIds?.length) {
    ctx.session.broadcastStep = "done";
    return ctx.reply("No valid user IDs to broadcast.");
  }

  // CSV admin‑rights check for every {invite:<chatId>} placeholder
  if (broadcastType === "csv") {
    const html = extractHtml(ctx.message!);
    const placeholderChatIds = extractInviteChatIds(html ?? "");
    for (const chatId of placeholderChatIds) {
      if (!(await checkBotIsAdmin(ctx.api, chatId))) {
        ctx.session.broadcastStep = "done";
        return ctx.reply(`❌ Bot is NOT admin in chat ${chatId}.`);
      }
    }
  }

  /* persist broadcast */
  try {
    const messageHtml = extractHtml(ctx.message!);
    const broadcastId = await createBroadcastMessage({
      broadcaster_id: ctx.from!.id,
      source_chat_id: ctx.chat!.id,
      source_message_id: ctx.message!.message_id,
      broadcast_type: broadcastType as "event" | "csv",
      event_uuid: ctx.session.broadcastEventUuid ?? null,
      title: ctx.session.broadcastEventTitle ?? "(custom list)",
      message_text: messageHtml,
    });
    await bulkInsertBroadcastUsers(broadcastId, userIds);
    ctx.session.broadcastStep = "done";
    await ctx.reply(`✅ Broadcast queued! ${userIds.length} user(s) will receive the message shortly.`);
  } catch (e) {
    ctx.session.broadcastStep = "done";
    logger.error(`broadcastComposer: DB error: ${e}`);
    await ctx.reply(`❌ Failed to queue the broadcast. ${String(e)}`);
  }
}
