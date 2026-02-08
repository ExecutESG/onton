import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../types/MyContext";
import { parse } from "csv-parse/sync";
import axios from "axios";
import { logger } from "../utils/logger";
import { isUserAdmin } from "../db/db";
import {
    createPollInDb,
    insertPollSent,
    getPollInfoByAnswerId,
    updateUserVoteSingle,
    updateUserVoteMultipleToggle,
    setPollSentAnswered,
    getAnswersByPollId,
    fetchUserSelectedAnswerIds,
} from "../db/polls";
import {checkRateLimit} from "../utils/checkRateLimit";

export const pollComposer = new Composer<MyContext>();

/* -------------------------------------------------------------------------- */
/* 1) /sendpoll => Start: ask for CSV                                         */
/* -------------------------------------------------------------------------- */
pollComposer.command("sendpoll", async (ctx) => {
    // Check if user is admin
    const { isAdmin } = await isUserAdmin(ctx.from?.id.toString() || "");
    if (!isAdmin) return;

    // Reset session
    ctx.session.pollStep = "askCsv";
    ctx.session.pollUserIds = [];
    ctx.session.pollQuestion = undefined;
    ctx.session.pollAnswers = [];
    ctx.session.pollDeadline = undefined;
    ctx.session.pollIsMultiple = false; // default

    await ctx.reply("Please upload your CSV file (one user_id per line).");
});

/* -------------------------------------------------------------------------- */
/* 2) On message => parse CSV or next steps                                   */
/* -------------------------------------------------------------------------- */
pollComposer.on("message", async (ctx, next) => {
    if (ctx.message?.text?.startsWith("/")) {
        ctx.session = {};
        return next();
    }

    const step = ctx.session.pollStep;

    if (step === "askCsv" && ctx.message?.document) {
        return handleCsvUpload(ctx);
    }
    if (step === "askPollQuestion" && ctx.message?.text) {
        return handlePollQuestion(ctx);
    }
    if (step === "askPollAnswer" && ctx.message?.text) {
        return handlePollAnswer(ctx);
    }

    // If the user typed hours or date/time:
    if (step === "askDeadlineHours" && ctx.message?.text) {
        return handleDeadlineHours(ctx);
    }
    if (step === "askDeadlineDateTime" && ctx.message?.text) {
        return handleDeadlineDateTime(ctx);
    }

    return next();
});

/* -------------------------------------------------------------------------- */
/* 3) CSV Upload => parse, ask single/multiple                                */
/* -------------------------------------------------------------------------- */
async function handleCsvUpload(ctx: MyContext) {
    const doc = ctx.message?.document;
    if (!doc) {
        await ctx.reply("No file found. Please upload a .csv file.");
        ctx.session.pollStep = "done";
        return;
    }
    if (!doc.file_name?.endsWith(".csv")) {
        await ctx.reply("Please upload a file ending with .csv.");
        return;
    }

    // Download from Telegram
    const fileInfo = await ctx.api.getFile(doc.file_id);
    if (!fileInfo.file_path) {
        await ctx.reply("Unable to retrieve file path from Telegram.");
        ctx.session.pollStep = "done";
        return;
    }

    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
    try {
        const res = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
        const buffer = Buffer.from(res.data);

        // Parse CSV
        const rows = parse(buffer.toString("utf-8"), { skip_empty_lines: true });
        const userIds: string[] = rows.map((r: string[]) => r[0]?.trim()).filter(Boolean);

        if (!userIds.length) {
            await ctx.reply("No user IDs found in CSV. Flow canceled.");
            ctx.session.pollStep = "done";
            return;
        }

        ctx.session.pollUserIds = userIds;
        ctx.session.pollStep = "askChoiceType";

        // Show inline keyboard for single vs multiple
        const kb = new InlineKeyboard()
            .text("Single Choice", "poll_type_single")
            .text("Multiple Choice", "poll_type_multiple");

        await ctx.reply(
            `✅ CSV parsed. Found ${userIds.length} user(s).\nDo you want a Single-Choice poll or a Multiple-Choice poll?`,
            { reply_markup: kb }
        );
    } catch (err) {
        await ctx.reply(`Error parsing CSV: ${String(err)}`);
        ctx.session.pollStep = "done";
    }
}

/* -------------------------------------------------------------------------- */
/* 4) Callback for single/multiple => ask poll question                       */
/* -------------------------------------------------------------------------- */
pollComposer.on("callback_query:data", async (ctx, next) => {
    const step = ctx.session.pollStep;
    const data = ctx.callbackQuery.data ?? "";

    // Step: askChoiceType
    if (step === "askChoiceType") {
        await ctx.answerCallbackQuery();
        if (data === "poll_type_single") {
            ctx.session.pollIsMultiple = false;
            ctx.session.pollStep = "askPollQuestion";
            await ctx.reply("Got it! This will be a single-choice poll.\nNow send me the poll question.");
        } else if (data === "poll_type_multiple") {
            ctx.session.pollIsMultiple = true;
            ctx.session.pollStep = "askPollQuestion";
            await ctx.reply("Got it! This will be a multiple-choice poll.\nNow send me the poll question.");
        } else {
            await ctx.reply("Please choose Single Choice or Multiple Choice.");
        }
        return;
    }

    // Step: askPollAnswer => "poll_add_more" or "poll_finish"
    if (step === "askPollAnswer") {
        await ctx.answerCallbackQuery();
        if (data === "poll_add_more") {
            await ctx.reply("Send the next answer option:");
            return;
        } else if (data === "poll_finish") {
            // Next => ask deadline method
            ctx.session.pollStep = "askDeadlineMethod";
            const kb = new InlineKeyboard()
                .text("No deadline", "deadline_none")
                .text("X Hours from now", "deadline_hours")
                .row()
                .text("Exact Date/Time", "deadline_datetime");
            await ctx.reply(
                "Do you want to set a deadline after which votes are locked?\n" +
                "Choose one:",
                { reply_markup: kb }
            );
            return;
        }
    }

    // Step: askDeadlineMethod => user picks none/hours/datetime
    if (step === "askDeadlineMethod") {
        await ctx.answerCallbackQuery();
        if (data === "deadline_none") {
            // No deadline => go to confirm
            ctx.session.pollDeadline = undefined;
            ctx.session.pollStep = "confirmPoll";
            await showPollPreview(ctx);
        } else if (data === "deadline_hours") {
            // Next => ask user to type an integer hours
            ctx.session.pollStep = "askDeadlineHours";
            await ctx.reply("How many hours from now should the poll remain open?");
        } else if (data === "deadline_datetime") {
            // Next => ask user to type the date/time
            ctx.session.pollStep = "askDeadlineDateTime";
            await ctx.reply("Please enter the exact date/time in format YYYY-MM-DD HH:mm (24h).(Helsinki time)");
        }
        return;
    }

    // Step: confirmPoll => "poll_do_confirm" or "poll_do_cancel"
    if (step === "confirmPoll") {
        await ctx.answerCallbackQuery();
        if (data === "poll_do_confirm") {
            ctx.session.pollStep = "done";

            const question = ctx.session.pollQuestion ?? "";
            const answers = ctx.session.pollAnswers ?? [];
            const userIds = ctx.session.pollUserIds ?? [];
            const deadline = ctx.session.pollDeadline; // might be undefined
            const isMultiple = ctx.session.pollIsMultiple ?? false;

            // 1) Create poll in DB
            const pollId = await createPollInDb(ctx.from?.id, question, answers, deadline, isMultiple);

            // 2) Insert poll_sent rows => waiting_for_send
            let insertedCount = 0;
            let failCount = 0;
            for (const userIdStr of userIds) {
                const uid = parseInt(userIdStr, 10);
                if (!uid) {
                    failCount++;
                    continue;
                }
                try {
                    await insertPollSent(pollId, uid);
                    insertedCount++;
                } catch (err) {
                    failCount++;
                }
            }

            await ctx.reply(
                `✅ Poll created (ID: ${pollId}).\n` +
                `Users inserted: ${insertedCount}, failed: ${failCount}\n` +
                "A cron job will deliver the poll messages with up to 10 retries."
            );
        } else if (data === "poll_do_cancel") {
            ctx.session.pollStep = "done";
            await ctx.reply("Poll creation canceled.");
        }
        return;
    }

    // If user clicked vote_ => handle voting
    if (data.startsWith("vote_")) {
        return handleVoteCallback(ctx, data);
    }

    return next();
});

/* -------------------------------------------------------------------------- */
/* 5) handlePollQuestion => gather question, go to askPollAnswer             */
/* -------------------------------------------------------------------------- */
async function handlePollQuestion(ctx: MyContext) {
    const question = ctx.message?.text?.trim();
    if (!question) {
        await ctx.reply("Invalid question. Please try again.");
        return;
    }

    ctx.session.pollQuestion = question;
    ctx.session.pollAnswers = [];
    ctx.session.pollStep = "askPollAnswer";
    await ctx.reply("Got it. Now send the 1st answer option.");
}

/* -------------------------------------------------------------------------- */
/* 6) handlePollAnswer => gather answers, show inline "Add more" or "Finish"  */
/* -------------------------------------------------------------------------- */
async function handlePollAnswer(ctx: MyContext) {
    const ansText = ctx.message?.text?.trim();
    if (!ansText) {
        await ctx.reply("Invalid answer text. Try again.");
        return;
    }

    ctx.session.pollAnswers!.push(ansText);

    if (ctx.session.pollAnswers!.length === 1) {
        // Ask for the 2nd answer
        await ctx.reply("Great! Now send the 2nd answer option.");
        return;
    }

    // If 2 or more, show inline KB
    if (ctx.session.pollAnswers!.length >= 2) {
        const kb = new InlineKeyboard()
            .text("➕ Add more answer", "poll_add_more")
            .text("✅ Finish", "poll_finish");
        await ctx.reply(
            `Answer #${ctx.session.pollAnswers!.length} saved. Add more or finish?`,
            { reply_markup: kb }
        );
    }
}

/* -------------------------------------------------------------------------- */
/* 7) handleDeadlineHours => user typed the number of hours => parse => store */
/* -------------------------------------------------------------------------- */
async function handleDeadlineHours(ctx: MyContext) {
    const txt = ctx.message?.text?.trim();
    if (!txt || isNaN(+txt)) {
        await ctx.reply("Please enter an integer number of hours (e.g. 5).");
        return;
    }
    const hours = parseInt(txt, 10);
    if (hours <= 0) {
        await ctx.reply("Hours must be a positive integer. Try again.");
        return;
    }

    // Compute deadline = now + hours
    const now = new Date();
    const msToAdd = hours * 3600_000; // hours -> ms
    const deadline = new Date(now.getTime() + msToAdd);

    ctx.session.pollDeadline = deadline;
    ctx.session.pollStep = "confirmPoll";

    await showPollPreview(ctx);
}

/* -------------------------------------------------------------------------- */
/* 8) handleDeadlineDateTime => user typed a date/time => parse => store      */
/* -------------------------------------------------------------------------- */
async function handleDeadlineDateTime(ctx: MyContext) {
    const txt = ctx.message?.text?.trim();
    if (!txt) {
        await ctx.reply("Please enter a date/time in YYYY-MM-DD HH:mm format.");
        return;
    }

    let parsed: Date;
    try {
        parsed = new Date(txt);
        if (isNaN(parsed.getTime())) {
            await ctx.reply("Could not parse date/time. Try again (YYYY-MM-DD HH:mm).");
            return;
        }
    } catch (err) {
        await ctx.reply("Could not parse date/time. Try again (YYYY-MM-DD HH:mm).");
        return;
    }

    ctx.session.pollDeadline = parsed;
    ctx.session.pollStep = "confirmPoll";

    await showPollPreview(ctx);
}

/* -------------------------------------------------------------------------- */
/* Show final poll preview => inline "Confirm"/"Cancel"                      */
/* -------------------------------------------------------------------------- */
async function showPollPreview(ctx: MyContext) {
    const question = ctx.session.pollQuestion ?? "";
    const answers = ctx.session.pollAnswers ?? [];
    const deadline = ctx.session.pollDeadline;
    const isMultiple = ctx.session.pollIsMultiple;

    const preview = formatPollPreview(question, answers, deadline, isMultiple);
    const kb = new InlineKeyboard()
        .text("Confirm", "poll_do_confirm")
        .text("Cancel", "poll_do_cancel");

    await ctx.reply(`Here is the poll preview:\n\n${preview}`, { parse_mode: "HTML",reply_markup: kb });
}

/* -------------------------------------------------------------------------- */
/* formatPollPreview => includes optional deadline + single/multiple info     */
/* -------------------------------------------------------------------------- */
function formatPollPreview(
    question: string,
    answers: string[],
    deadline?: Date,
    isMultiple?: boolean
) {
    let text = `<b>Poll question:</b> ${question}\n\n`;
    answers.forEach((ans, i) => {
        text += `${i + 1}) ${ans}\n`;
    });
    text += `\n<b>Poll type:</b> ${isMultiple ? "Multiple-choice" : "Single-choice"}`;

    if (deadline) {
        // Show UTC time
        const utcStr = deadline.toISOString().replace("T", " ").slice(0,16) + " UTC";
        text += `\n<b>Deadline:</b> ${utcStr}`;
    }
    return text;
}

/* -------------------------------------------------------------------------- */
/* handleVoteCallback => single vs multiple logic                             */
/* -------------------------------------------------------------------------- */
async function handleVoteCallback(ctx: MyContext, data: string) {
    const answerId = parseInt(data.split("_")[1], 10);
    const userId = ctx.from?.id;
    if (!userId || !answerId) {
        await ctx.answerCallbackQuery({ text: "Vote failed: missing IDs." });
        return;
    }

    // 1) Rate limit: 8 changes/minute
    const { allowed, remaining } = await checkRateLimit(
        userId.toString(),
        "poll_vote",
        8,           // limit
        60           // windowSeconds
    );
    if (!allowed) {
        await ctx.answerCallbackQuery({
            text: "You've exceeded your vote changes limit (8 per minute). Please wait and try again."
        });
        return;
    }

    // 2) Fetch poll info
    const pollRow = await getPollInfoByAnswerId(answerId);
    if (!pollRow) {
        await ctx.answerCallbackQuery({ text: "Answer not found." });
        return;
    }

    // 3) Check deadline
    if (pollRow.vote_deadline) {
        const now = new Date();
        const deadline = new Date(pollRow.vote_deadline);
        if (now > deadline) {
            await ctx.answerCallbackQuery({ text: "Voting has ended (deadline passed)." });
            return;
        }
    }

    // 4) Single or multiple?
    try {
        if (pollRow.multiple_choice) {
            await updateUserVoteMultipleToggle(pollRow.poll_id, userId, answerId);
        } else {
            await updateUserVoteSingle(pollRow.poll_id, userId, answerId);
        }
    } catch (err) {
        logger.error(`Error in updateUserVote: ${err}`);
        await ctx.answerCallbackQuery({ text: "Vote error. Please retry later." });
        return;
    }

    // 5) Mark poll_sent as 'answered'
    try {
        await setPollSentAnswered(pollRow.poll_id, userId);
    } catch (err) {
        logger.warn(`Could not update poll_sent to answered: ${err}`);
    }

    // 6) Rebuild inline keyboard with checkmarks
    const allAnswers = await getAnswersByPollId(pollRow.poll_id);
    const selectedAnswerIds = await fetchUserSelectedAnswerIds(pollRow.poll_id, userId);
    const newKb = buildKeyboardWithCheckmarks(allAnswers, selectedAnswerIds);

    // 7) Edit the message
    try {
        await ctx.editMessageReplyMarkup({
            reply_markup: { inline_keyboard: newKb.inline_keyboard },
        });
        await ctx.answerCallbackQuery({
            text: `Vote received!`,
        });
    } catch (err) {
        await ctx.answerCallbackQuery({
            text: "Your vote was recorded, but message can’t be updated.",
        });
    }
}

/* -------------------------------------------------------------------------- */
/* buildKeyboardWithCheckmarks => single or multiple checks                   */
/* -------------------------------------------------------------------------- */
function buildKeyboardWithCheckmarks(
    answers: { id: number; answer_text: string }[],
    selectedIds: number[]
) {
    const kb = new InlineKeyboard();
    for (const ans of answers) {
        const isSelected = selectedIds.includes(ans.id);
        const label = isSelected ? `✅ ${ans.answer_text}` : ans.answer_text;
        kb.text(label, `vote_${ans.id}`).row();
    }
    return kb;
}
