// cron/broadcastSenderCron.ts — fully rewritten to guarantee personalised
// content for BOTH media and plain‑text broadcasts.

import { Bot, GrammyError } from "grammy";
import { logger } from "../utils/logger";
import {
    fetchPendingBroadcastSends,
    markBroadcastUserSent,
    markBroadcastUserFailed,
    broadcastHasPendingUsers,
    fetchBroadcastErrors,
    countBroadcastSuccess,
    getBroadcastMeta,
} from "../db/broadcast";
import {AFFILIATE_PLACEHOLDERS, additionalRecipients, TBOOK_FAIRLAUNCH_MINIAPP_URL} from "../constants";
import {
    generateBroadcastGroupTitle,
    normalizeDashes,
    extractInviteChatIds,
    escapeCsv,
} from "../utils/utils";
import { getOrCreateSingleInviteLinkForUserAndChat } from "../db/db";
import { getOrCreateSingleAffiliateLink } from "../db/affiliateLinks";
import { Readable } from "stream";
import { InputFile } from "grammy";

/* ------------------------------------------------------------------ */
/* helper: after copyMessage, force‑apply caption OR text              */
/* ------------------------------------------------------------------ */
async function forcePersonaliseMessage(
    bot: Bot,
    chatId: number,
    msgId: number,
    html: string,
) {
    // 1) Try caption (photo / video / doc / etc.)
    try {
        await bot.api.editMessageCaption(chatId, msgId, { caption: html, parse_mode: "HTML" });
        return;
    } catch (_) {
        /* Not media or editCaption failed → fall through */
    }
    // 2) Fallback to plain text
    try {
        await bot.api.editMessageText(chatId, msgId, html, { parse_mode: "HTML" });
    } catch (e) {
        logger.warn(`forcePersonaliseMessage: cannot edit msg ${msgId} in ${chatId}: ${e}`);
    }
}

/* ------------------------------------------------------------------ */
/* main cron                                                          */
/* ------------------------------------------------------------------ */
export async function broadcastSenderCron(bot: Bot) {
    const rows = await fetchPendingBroadcastSends(200);
    if (!rows.length) return;

    logger.info(`broadcastSenderCron: processing ${rows.length} rows`);

    for (const row of rows) {
        const {
            bu_id,
            user_id,
            retry_count,
            broadcast_id,
            broadcast_type,
            source_chat_id,
            source_message_id,
            message_text, // HTML caption/text as stored
        } = row;

        try {
            /* ---------------------------------------------------------------- */
            /* 1. Build personalised HTML + copy options (only for CSV type)     */
            /* ---------------------------------------------------------------- */
            let personalisedHtml: string | null = null;
            let copyOpts: Parameters<Bot["api"]["copyMessage"]>[3] | undefined;

            if (broadcast_type === "csv" && message_text) {
                personalisedHtml = await personalise(message_text, Number(user_id), bot);
                copyOpts = { caption: personalisedHtml, parse_mode: "HTML" }; // works for media
            }

            /* ---------------------------------------------------------------- */
            /* 2. Copy the original message                                     */
            /* ---------------------------------------------------------------- */
            const copy = await bot.api.copyMessage(user_id, source_chat_id, source_message_id, copyOpts);

            /* ---------------------------------------------------------------- */
            /* 3. If Telegram ignored our caption override (plain text), patch   */
            /* ---------------------------------------------------------------- */
            if (personalisedHtml) {
                await forcePersonaliseMessage(bot, user_id, copy.message_id, personalisedHtml);
            }

            /* ---------------------------------------------------------------- */
            /* 4. Mark success                                                  */
            /* ---------------------------------------------------------------- */
            await markBroadcastUserSent(bu_id, copy.message_id);
            logger.info(`broadcastSenderCron: sent to ${user_id} (bu_id=${bu_id}, bid=${broadcast_id})`);
        } catch (err) {
            logger.warn(`broadcastSenderCron: copy error to ${user_id}: ${err}`);
            const fatal = isForbiddenError(err) || isChatNotFoundError(err) || retry_count + 1 >= 10;
            await markBroadcastUserFailed(bu_id, retry_count + 1, String(err), fatal);
        }

        await delay(40); // throttle msg/second  =
    }

    /* -------------------------------------------------------------------- */
    /* notify admins when a broadcast ID has no pending users                */
    /* -------------------------------------------------------------------- */
    const finished = new Set<number>(rows.map((r) => r.broadcast_id));
    for (const bid of Array.from(finished)) { // Array.from fixes TS2802
        if (await broadcastHasPendingUsers(bid)) continue;
        await notifyAdminsAboutFinishedBroadcast(bot, bid);
    }
}

/* ------------------------------------------------------------------ */
/* personalise placeholders                                           */
/* ------------------------------------------------------------------ */
async function personalise(baseText: string, userId: number, bot: Bot): Promise<string> {
    let text = normalizeDashes(baseText);
    const broadcastGroupTitle = generateBroadcastGroupTitle();

    // Affiliate placeholders ({onion1-campaign}, etc.)
    for (const ph of AFFILIATE_PLACEHOLDERS) {
        if (!text.includes(ph)) continue;
        const itemType = ph.replace(/[{}]/g, "");
        const linkRow = await getOrCreateSingleAffiliateLink(userId, itemType, `broadcast-${itemType}-${userId}`, broadcastGroupTitle).catch((e) => {
            logger.error(`afflink err uid=${userId}: ${e}`);
            return null;
        });
        let link = linkRow ? `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=campaign-aff-${linkRow.link_hash}` : "[LINK_ERROR]";
        // Special case for fairlaunch-partnership because it is an external miniapp
        if(itemType === "fairlaunch-partnership") {
            link = linkRow ? TBOOK_FAIRLAUNCH_MINIAPP_URL +`?partner=${linkRow.link_hash}` : "[LINK_ERROR]";
        }


        text = text.replace(ph, link);
    }

    // Invite placeholders ({invite:<chatId>})
    for (const chatId of extractInviteChatIds(text)) {
        const placeholder = `{invite:${chatId}}`;
        const link = await getOrCreateSingleInviteLinkForUserAndChat(bot.api, userId, chatId).catch((e) => {
            logger.warn(`invite err uid=${userId} chat=${chatId}: ${e}`);
            return null;
        });
        text = text.replace(placeholder, link ?? "[LINK_ERROR]");
    }

    return text;
}

/* ------------------------------------------------------------------ */
/* finished‑broadcast report                                          */
/* ------------------------------------------------------------------ */
async function notifyAdminsAboutFinishedBroadcast(bot: Bot, bid: number) {
    const { source_chat_id, source_message_id } = await getBroadcastMeta(bid);
    const success = await countBroadcastSuccess(bid);
    const errors = await fetchBroadcastErrors(bid);
    const summary = `Broadcast #${bid} finished.\n- Success: ${success}\n- Errors: ${errors.length}`;

    for (const adminId of additionalRecipients) {
        // forward original
        await bot.api.copyMessage(adminId, source_chat_id, source_message_id, { caption: "Original broadcasted message." }).catch((e) => logger.warn(`notifyAdmins: copy fail ${e}`));
        // summary
        await bot.api.sendMessage(adminId, summary).catch((e) => logger.warn(`notifyAdmins: msg fail ${e}`));

        if (!errors.length) continue;
        const csv = ["user_id,error", ...errors.map((e) => `${e.user_id},${escapeCsv(e.last_error)}`)].join("\n");
        const file = new InputFile(Readable.from(csv), "broadcast_errors.csv");
        await bot.api.sendDocument(adminId, file, { caption: "Broadcast encountered errors. See CSV." }).catch((e) => logger.warn(`notifyAdmins: CSV fail ${e}`));
    }

    logger.info(`broadcastSenderCron: notified admins about #${bid}`);
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
function isForbiddenError(err: unknown) {
    return err instanceof GrammyError ? err.error_code === 403 : /403|forbidden/i.test(String(err));
}
function isChatNotFoundError(err: unknown) {
    return err instanceof GrammyError ? err.error_code === 400 && /chat (?:not )?found/i.test(err.description) : /chat (?:not )?found/i.test(String(err));
}
function delay(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
