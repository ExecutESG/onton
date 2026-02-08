import { validateWebAppData } from "@grammyjs/validator"
import * as fs from "fs"
import { Context, InputFile } from "grammy"
import { InlineKeyboardMarkup } from "grammy/types"
import sharp from "sharp"
import {MyContext} from "../types/MyContext";
import {ChatMember} from "@grammyjs/types";
import {logger} from "./logger";
import {INVITE_PLACEHOLDER_REGEX} from "../constants";

export const validateMiniAppData = (rawInitData: any): boolean => {
  const initData = new URLSearchParams(rawInitData as string);
  return validateWebAppData(process.env.BOT_TOKEN, initData);
};

export const escapeHtml = (unsafe: string) => unsafe
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");


const editOrSend = async (
  ctx: Context,
  text: string,
  markup?: InlineKeyboardMarkup,
  imagePath: string = __dirname + "/img/Onton-HQ.jpg",
  edit: boolean = true,
) => {
  // @ts-ignore
  let messageId = ctx.update.callback_query?.message?.message_id;

  if (edit) {
    try {
      const photoStream = fs.readFileSync(imagePath);
      const ontonImage = await sharp(photoStream)
        .resize(800, 800)
        .extend(
          {
            top: 15, bottom: 15, left: 15, right: 15, background: {
              r: 255,
              g: 255,
              b: 255,
            },
          }).toBuffer();

      const imageFile = new InputFile(ontonImage);
      await ctx.api.editMessageMedia(
        ctx.chat!.id,
        messageId,
        {

          type: "photo",
          media: imageFile,
          caption: text,
        },
        {
          reply_markup: markup,
        },
      );
    } catch (error) {
      const photoStream = fs.readFileSync(imagePath);
      const ontonImage = await sharp(photoStream)
        .resize(800, 800)
        .extend(
          {
            top: 15, bottom: 15, left: 15, right: 15, background: {
              r: 255,
              g: 255,
              b: 255,
            },
          }).toBuffer();

      const ontonImageFile = new InputFile(ontonImage);
      const sentMessage = await ctx.api.sendPhoto(
        ctx.chat!.id,
        ontonImageFile,
        {
          caption: text,
          reply_markup: markup,
          parse_mode: "HTML",
        },
      );

      messageId = sentMessage.message_id;
    }
  } else {
    const photoStream = fs.readFileSync(imagePath);
    const ontonImage = await sharp(photoStream)
      .resize(800, 800)
      .extend(
        {
          top: 15, bottom: 15, left: 15, right: 15, background: {
            r: 255,
            g: 255,
            b: 255,
          },
        }).toBuffer();


    const ontonImageFile = new InputFile(ontonImage);
    const sentMessage = await ctx.api.sendPhoto(
      ctx.chat!.id,
      ontonImageFile,
      {
        caption: text,
        reply_markup: markup,
        parse_mode: "HTML",
      },
    );

    messageId = sentMessage.message_id;
  }

  return messageId;
};

export { editOrSend }

export function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function isUrlValid(url: string) {
  var pattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
      "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
      "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
      "(\\#[-a-z\\d_]*)?$",
    "i"
  ); 
  return !!pattern.test(url);
}

/* -------------------------------------------------------------------------- */
/* Utility => convert em-dash/en-dash to ASCII minus                         */
/* -------------------------------------------------------------------------- */
export function normalizeDashes(text: string): string {
    return text.replace(/[\u2013\u2014]/g, "-");
}

/* -------------------------------------------------------------------------- */
/* Utility => escape CSV fields                                              */
/* -------------------------------------------------------------------------- */
export function escapeCsv(str: string): string {
    if (!str) return "";
    let s = str.replace(/"/g, "\"\"");
    if (/[,"]/.test(s)) {
        s = `"${s}"`;
    }
    return s;
}

/* -------------------------------------------------------------------------- */
/* generateBroadcastGroupTitle => produce a unique group title (timestamp)   */
/* -------------------------------------------------------------------------- */
export function generateBroadcastGroupTitle(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `broad-cast-${y}${m}${d}${hh}${mm}${ss}`;
}

/* -------------------------------------------------------------------------- */
/* checkBotIsAdmin => returns true if bot is admin in chatId                 */
/* createOneTimeInviteLink => single-use link for that chatId                */
/* -------------------------------------------------------------------------- */
export async function checkBotIsAdmin(api: MyContext["api"], chatId: number): Promise<boolean> {
    try {
        const me = await api.getMe();
        const member: ChatMember = await api.getChatMember(chatId, me.id);
        return member.status === "administrator" || member.status === "creator";
    } catch (err) {
        logger.warn(`checkBotIsAdmin failed chatId=${chatId}: ${err}`);
        return false;
    }
}


/* -------------------------------------------------------------------------- */
/* Utility => parse all invite placeholders to gather chat IDs (if needed)   */
/* -------------------------------------------------------------------------- */
export function extractInviteChatIds(text: string): number[] {
    const normalized = normalizeDashes(text);
    const found: number[] = [];
    const matches =  Array.from(normalized.matchAll(INVITE_PLACEHOLDER_REGEX));
    for (const m of matches) {
        const chatId = parseInt(m[1], 10);
        if (!isNaN(chatId)) found.push(chatId);
    }
    return found;
}


