import { Bot, GrammyError } from "grammy";
import { logger } from "../utils/logger";
import {
    fetchPendingPollSends,
    markPollSentSuccess,
    markPollSentFailed,
    incrementPollSentRetry,
    getPollRow,
    getPollAnswers,
} from "../db/polls";

/**
 * pollSenderCron:
 *  1) Fetches poll_sent rows with state='waiting_for_send' AND retry_count<10
 *  2) Sends each poll message at a rate of 5 msgs/sec (200ms between)
 *  3) If success => mark poll_sent.state='success'
 *  4) If failure => handle 403 specifically => user blocked => final fail (no retry)
 *                  else increment retry or final fail after 10 tries
 */
export async function pollSenderCron(bot: Bot) {


    const rows = await fetchPendingPollSends(50);
    if (!rows.length) {
        //logger.info("pollSenderCron: no rows to process. Exiting.");
        return;
    }

    logger.info(`pollSenderCron: found ${rows.length} rows to send.`);

    for (const row of rows) {
        const { poll_id, user_id, retry_count } = row;

        try {
            // 1) Send the poll message
            const sentMsgId = await actuallySendPollMessage(bot, poll_id, user_id);

            // 2) Mark as success
            await markPollSentSuccess(poll_id, user_id, sentMsgId);
            logger.info(`pollSenderCron: poll_id=${poll_id}, user_id=${user_id} => SUCCESS`);
        } catch (err) {
            logger.warn(
                `pollSenderCron: send failed poll_id=${poll_id} user_id=${user_id}: ${err}`
            );

            // Handle 429 FloodWait => respect retry_after, pause, and keep row pending without penalty
            if (err instanceof GrammyError && err.error_code === 429) {
                const retryAfter = (err.parameters as any)?.retry_after ?? 5;
                logger.warn(`pollSenderCron: 429 FloodWait detected. Pausing for ${retryAfter}s.`);
                await delay(retryAfter * 1000);
                continue;
            }

            // Check if it's a fatal error (user blocked bot, chat not found, deactivated account)
            if (isFatalError(err)) {
                await markPollSentFailed(poll_id, user_id, retry_count);
                logger.warn(`pollSenderCron: user_id=${user_id} => final fail (fatal error: ${err})`);
            } else {
                // Otherwise handle normal retry logic
                const newRetry = retry_count + 1;
                if (newRetry >= 10) {
                    await markPollSentFailed(poll_id, user_id, newRetry);
                    logger.warn(`pollSenderCron: user_id=${user_id} => final fail (retries=10)`);
                } else {
                    await incrementPollSentRetry(poll_id, user_id, newRetry);
                }
            }
        }

        // 4) Wait 200ms before sending the next poll to maintain ~5 msgs/sec
        await delay(200);
    }

    logger.info("pollSenderCron: finished");
}

/**
 * actuallySendPollMessage: fetch poll + answers from DB,
 * build inline keyboard, send via bot.api.sendMessage().
 * Returns the new message_id if successful.
 */
async function actuallySendPollMessage(
    bot: Bot,
    pollId: number,
    userId: number
): Promise<number> {
    const pollRow = await getPollRow(pollId);
    if (!pollRow) {
        throw new Error(`Poll not found id=${pollId}`);
    }
    const answers = await getPollAnswers(pollId);

    // Build inline keyboard
    const inline_keyboard = answers.map((ans) => [
        { text: ans.answer_text, callback_data: `vote_${ans.id}` },
    ]);

    // Construct message
    let text = `📊 <b>${pollRow.question}</b>`;
    if (pollRow.vote_deadline) {
        const deadlineDate = new Date(pollRow.vote_deadline);
        const utcStr = deadlineDate.toISOString().slice(0, 16).replace("T", " ") + " UTC";
        text += `\n\n<b>⏱️ Voting ends at:</b> ${utcStr}`;
    }

    // Send
    const sentMsg = await bot.api.sendMessage(userId, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard },
    });

    return sentMsg.message_id;
}

/* -------------------------------------------------------------------------- */
/* Helper: check if error is fatal (403 blocked, chat/user not found, deactivated) */
/* -------------------------------------------------------------------------- */
function isFatalError(err: unknown): boolean {
    if (err instanceof GrammyError) {
        return (
            err.error_code === 403 ||
            (err.error_code === 400 && /chat (?:not )?found|user (?:not )?found/i.test(err.description)) ||
            /forbidden|deactivated/i.test(err.description)
        );
    }
    const str = String(err).toLowerCase();
    return (
        str.includes("403") ||
        str.includes("forbidden") ||
        str.includes("chat not found") ||
        str.includes("user not found") ||
        str.includes("deactivated")
    );
}

/* -------------------------------------------------------------------------- */
/* Helper: delay X ms                                                        */
/* -------------------------------------------------------------------------- */
function delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
