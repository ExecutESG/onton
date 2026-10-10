import axios from "axios";
import FormData from "form-data";
import { Composer, InlineKeyboard } from "grammy";
import * as process from "node:process";
import { MyContext } from "../types/MyContext";
import { logger } from "../utils/logger";
import { isNewCommand } from "../helpers/isNewCommand";
import { GameRowType, getGames, getCollectionsByHubId, getLocalTournamentById } from "../db/db";
import { SbtRewardCollection } from "../types/SbtRewardCollection";
import { handleCreateResponse } from "../helpers/tournaments/handleCreateResponse";
import { resetTournamentFlow } from "../helpers/tournaments/resetTournamentFlow";
import { handleCreateError } from "../helpers/tournaments/handleCreateError";
import { handleCheckError } from "../helpers/tournaments/handleCheckError";
import { transformInviteLink } from "../helpers/tournaments/transformInviteLink";

export const tournamentComposer = new Composer<MyContext>();

/**
 * parseInviteMessage:
 *  - extracts "t.me/..." link from a user message
 *  - returns { link, tournamentId } or null if not found
 */
function parseInviteMessage(text: string) {
  // 1) Find "t.me/..." in the text
  const linkRegex = /(t\.me\/[^\s]+)/i;
  const match = text.match(linkRegex);

  if (!match) {
    return { link: null, tournamentId: null };
  }

  let link = match[1];
  // ensure we have http or https
  if (!/^https?:\/\//i.test(link)) {
    link = "https://" + link;
  }

  // last dash => tournament ID
  const dashIndex = link.lastIndexOf("-");
  if (dashIndex === -1) {
    return { link, tournamentId: null };
  }

  const tournamentId = link.slice(dashIndex + 1);
  return { link, tournamentId };
}

/**
 * showCollectionNavigation:
 *  - displays a single SBT collection with Prev/Next/Select
 *  - if isFirstTime => sends a new message
 *  - otherwise => edits existing
 */
async function showCollectionNavigation(
  ctx: MyContext,
  coll: SbtRewardCollection,
  isFirstTime: boolean,
) {
  const kb = new InlineKeyboard()
    .text("<< Prev", "collection_prev")
    .text(`ID ${coll.id}`, "collection_noop")
    .text("Next >>", "collection_next")
    .row()
    .text("Select This", `collection_select_${coll.id}`);

  const imageUrl = coll.imageLink || "";
  const caption = `Viewing collection ID: ${coll.id}`;

  if (isFirstTime) {
    // send new message
    if (imageUrl) {
      const msg = await ctx.replyWithPhoto(imageUrl, { caption, reply_markup: kb });
      ctx.session.tournamentData.navigationMessageId = msg.message_id;
    } else {
      const msg = await ctx.reply(`${caption}\n(No image)`, { reply_markup: kb });
      ctx.session.tournamentData.navigationMessageId = msg.message_id;
    }
  } else {
    // edit existing
    const messageId = ctx.session.tournamentData.navigationMessageId;
    if (!messageId) {
      return showCollectionNavigation(ctx, coll, true);
    }
    try {
      if (imageUrl) {
        await ctx.api.editMessageMedia(
          ctx.chat!.id,
          messageId,
          { type: "photo", media: imageUrl, caption },
          { reply_markup: kb },
        );
      } else {
        await ctx.api.editMessageText(ctx.chat!.id, messageId, caption + "\n(No image)", {
          reply_markup: kb,
        });
      }
    } catch (err) {
      logger.error("Error editing collection nav =>", err);
      await ctx.reply("Failed to edit the message. Sending a new one instead...");
      await showCollectionNavigation(ctx, coll, true);
    }
  }
}

// 1) /tournament => begin flow
tournamentComposer.command("tournament", async (ctx) => {
  ctx.session.tournamentStep = "pickGame";
  ctx.session.tournamentData = {
    gameId: "",
    tournamentId: "",
    tournamentLink: "",
    photoFileId: "",
  };

  // load games
  let games: GameRowType[];
  try {
    games = await getGames();
  } catch (err) {
    logger.error("Failed to fetch games =>", err);
    await ctx.reply("Failed to fetch games. Please try again later.");
    return;
  }

  if (!games.length) {
    await ctx.reply("No games found in DB.");
    return;
  }

  const kb = new InlineKeyboard();
  for (const g of games) {
    kb.text(g.name, `pick_game_${g.host_game_id}`).row();
  }

  await ctx.reply("Please pick a game from the list below:", { reply_markup: kb });
});

// 2) callback => pickGame
tournamentComposer.callbackQuery(/^pick_game_(.+)$/, async (ctx) => {
  const gameId = ctx.match[1];
  await ctx.answerCallbackQuery();

  ctx.session.tournamentData.gameId = gameId;
  ctx.session.tournamentStep = "askInviteMessage";

  await ctx.reply(
    `Game selected: ${gameId}\n` +
    "Now please **forward** or **paste** the full invite message.",
  );
});

// 3) on text => parse the invite => do "check"
tournamentComposer.on("message:text", async (ctx, next) => {
  if (!ctx.session.tournamentStep) return next();
  if (isNewCommand(ctx)) {
    // user typed a new command => reset
    ctx.session = {};
    return next();
  }

  if (ctx.session.tournamentStep === "askInviteMessage") {
    const text = ctx.message.text;
    const { link, tournamentId } = parseInviteMessage(text);

    if (!link || !tournamentId) {
      await ctx.reply(
        "Could not extract a valid link or tournament ID.\n" +
        "Please forward/paste the invite with a dash ('-') in it.",
      );
      return;
    }

    // -- NEW: Check if this tournament ID already exists in local DB
    try {
      const existing = await getLocalTournamentById(tournamentId);
      if (existing) {
        await ctx.reply(
          `A local record for Tournament ID ${tournamentId} already exists!\n` +
          "We cannot insert it again. Please /tournament to start over.",
        );
        resetTournamentFlow(ctx);
        return;
      }
    } catch (dbErr) {
      logger.error("Failed checking existing tournament =>", dbErr);
      await ctx.reply(
        "There was a DB error checking existing tournaments. Please try again later or /tournament to restart.",
      );
      resetTournamentFlow(ctx);
      return;
    }

    // store
    ctx.session.tournamentData.tournamentLink = link;
    ctx.session.tournamentData.tournamentId = tournamentId;

    ctx.session.tournamentStep = "check";
    await ctx.reply(`Invite link: ${link}\nID: ${tournamentId}\nChecking...`);

    // inline check logic
    const userId = ctx.from?.id || 0;
    const { gameId } = ctx.session.tournamentData;
    if (!gameId) {
      await ctx.reply("Missing game ID in session. /tournament to restart.");
      resetTournamentFlow(ctx);
      return;
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const checkUrl = `${baseUrl}/tournament/check/${gameId}/${tournamentId}/${userId}`;
    logger.info("Check URL => " + checkUrl);

    try {
      const resp = await axios.post(checkUrl, {}, {
        headers: { "x-api-key": process.env.ONTON_API_KEY || "" },
      });
      const details = resp.data?.data;
      if (!details) {
        await ctx.reply("No details returned from check. Unknown error.");
        resetTournamentFlow(ctx);
        return;
      }

      await ctx.reply(
        `Tournament found:\nName: ${details.Name}\nState: ${details.State}\nOwnerId: ${details.OwnerId ?? "(none)"}\n...`,
      );

      // show Insert/Cancel
      const kb = new InlineKeyboard()
        .text("Insert", "tourn_insert")
        .text("Cancel", "tourn_cancel");

      await ctx.reply("Would you like to insert this tournament in local DB?", {
        reply_markup: kb,
      });

      // step => confirmInsert
      ctx.session.tournamentStep = "confirmInsert";
    } catch (err) {
      handleCheckError(ctx, err);
    }

    return;
  }

  return next();
});

// 4) callback => Insert / Cancel
tournamentComposer.callbackQuery(["tourn_insert", "tourn_create", "tourn_cancel"], async (ctx) => {
  await ctx.answerCallbackQuery();

  if (ctx.callbackQuery.data === "tourn_cancel") {
    resetTournamentFlow(ctx);
    await ctx.reply("Operation canceled. /tournament to start over.");
    return;
  }

  // If user tapped "Insert"
  if (ctx.session.tournamentStep === "confirmInsert" && ctx.callbackQuery.data === "tourn_insert") {
    // We want to pick a collection BEFORE asking for a photo
    ctx.session.tournamentData._postCollectionStep = "askTournamentPhoto";

    // Attempt to fetch from DB immediately
    try {
      // for example hub=33
      const allColls = await getCollectionsByHubId(33);
      if (!allColls.length) {
        await ctx.reply("No collections found for hub=33. We'll skip collection linking.");
        // jump to askPhoto
        ctx.session.tournamentStep = "askTournamentPhoto";
        await ctx.reply("Please send me a **photo** for the tournament now.");
        return;
      }

      // store them
      ctx.session.tournamentData.collections = allColls;
      ctx.session.tournamentData.currentIndex = 0;
      ctx.session.tournamentStep = "NAVIGATE_COLLECTIONS";

      await ctx.reply("Please select an SBT Collection from hub=33 now.");
      // show the first
      await showCollectionNavigation(ctx, allColls[0], true);
    } catch (err) {
      logger.error("Failed to fetch SBT coll =>", err);
      await ctx.reply("Failed to fetch collections. We'll skip linking.");
      // fallback => askPhoto
      ctx.session.tournamentStep = "askTournamentPhoto";
      await ctx.reply("Please send me a **photo** for the tournament now.");
    }
    return;
  }

  // If user tapped "Create" => from confirmCreate step (if you also use confirmCreate)
  if (ctx.session.tournamentStep === "confirmCreate" && ctx.callbackQuery.data === "tourn_create") {
    // do a similar approach
    ctx.session.tournamentData._postCollectionStep = "askTournamentPhoto";
    // fetch coll from DB, set step => "NAVIGATE_COLLECTIONS" ...
    // or skip if none found
  }
});

// 5) The "NAVIGATE_COLLECTIONS" sub-flow
tournamentComposer.callbackQuery(
  ["collection_noop", "collection_prev", "collection_next", /^collection_select_(\d+)$/],
  async (ctx) => {
    if (ctx.session.tournamentStep !== "NAVIGATE_COLLECTIONS") {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery.data;
    const flow = ctx.session.tournamentData;
    const colls = flow.collections ?? [];
    let idx = flow.currentIndex ?? 0;

    if (!colls.length) return;

    if (data === "collection_noop") return;
    if (data === "collection_prev") {
      idx = idx - 1 < 0 ? colls.length - 1 : idx - 1;
      flow.currentIndex = idx;
      return showCollectionNavigation(ctx, colls[idx], false);
    }
    if (data === "collection_next") {
      idx = idx + 1 >= colls.length ? 0 : idx + 1;
      flow.currentIndex = idx;
      return showCollectionNavigation(ctx, colls[idx], false);
    }

    // "collection_select_X"
    const m = data.match(/^collection_select_(\d+)$/);
    if (!m) return;
    const selectedId = Number(m[1]);
    flow.selectedCollectionId = selectedId;

    await ctx.reply(`Collection #${selectedId} selected!`);

    // next step => askTournamentPhoto
    const nextStep = flow._postCollectionStep;
    ctx.session.tournamentStep = nextStep;

    // clean up nav
    delete flow.collections;
    delete flow.currentIndex;
    delete flow.navigationMessageId;
    delete flow._postCollectionStep;

    if (nextStep === "askTournamentPhoto") {
      await ctx.reply("Please send me a **photo** for the tournament now.");
    }
  },
);

// 6) on photo => finalize creation
tournamentComposer.on("message:photo", async (ctx, next) => {
  if (ctx.session.tournamentStep !== "askTournamentPhoto") return next();
  if (isNewCommand(ctx)) {
    ctx.session = {};
    return next();
  }

  const { gameId, tournamentId, tournamentLink, selectedCollectionId } =
  ctx.session.tournamentData ?? {};

  if (!gameId || !tournamentId) {
    await ctx.reply("Missing game/tournament ID in session. Please /tournament to start again.");
    resetTournamentFlow(ctx);
    return;
  }

  await ctx.reply("Uploading photo, please wait...");

  // Download from Telegram
  let fileBuffer: Buffer;
  try {
    const photoArr = ctx.message.photo;
    const fileId = photoArr[photoArr.length - 1].file_id;
    const fileInfo = await ctx.api.getFile(fileId);
    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;
    const resp = await axios.get(downloadUrl, { responseType: "arraybuffer" });
    fileBuffer = Buffer.from(resp.data);
  } catch (err) {
    logger.error("Error downloading photo =>", err);
    await ctx.reply("Failed to download the photo. Try again later or /tournament to restart.");
    return;
  }

  // Now call your create endpoint
  try {
    const userId = ctx.from?.id || 0;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const createUrl = `${baseUrl}/tournament/create/${gameId}/${tournamentId}/${userId}`;
    logger.info("Create URL => " + createUrl);

    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: "my_tournament_photo.png",
      contentType: "image/png",
    });

    const newLink = transformInviteLink(tournamentLink);
    // Now pass newLink to the formData
    formData.append("tournament_link", newLink);

    if (selectedCollectionId) {
      formData.append("sbt_collection_id", selectedCollectionId.toString());
    }

    logger.info("Form data =>", formData);
    const res = await axios.post(createUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        "x-api-key": process.env.ONTON_API_KEY || "",
      },
    });

    handleCreateResponse(ctx, res.data);
  } catch (err) {
    handleCreateError(ctx, err);
  } finally {
    resetTournamentFlow(ctx);
  }
});
