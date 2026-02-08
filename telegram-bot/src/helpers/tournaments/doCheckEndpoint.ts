import { MyContext } from "../../types/MyContext";
import process from "node:process";
import { logger } from "../../utils/logger";
import axios from "axios";
import { resetTournamentFlow } from "../../helpers/tournaments/resetTournamentFlow";
import { InlineKeyboard } from "grammy";
import { handleCheckError } from "../../helpers/tournaments/handleCheckError";

export async function doCheckEndpoint(ctx: MyContext) {
  const userId = ctx.from?.id || 0;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const { gameId, tournamentId } = ctx.session.tournamentData ?? {};

  // Sanity check
  if (!gameId || !tournamentId) {
    await ctx.reply("Missing required IDs. Please /tournament to start over.");
    resetTournamentFlow(ctx);
    return;
  }

  const url = `${baseUrl}/tournament/check/${gameId}/${tournamentId}/${userId}`;
  logger.info("Check URL => " + url);

  try {
    const res = await axios.post(url, {}, {
      headers: {
        "x-api-key": process.env.ONTON_API_KEY || "",
      },
    });

    const details = res.data?.data;
    if (!details) {
      await ctx.reply("No details returned from check. Possibly an unknown error.");
      resetTournamentFlow(ctx);
      return;
    }

    // Show some info to the user
    await ctx.reply(
      `Tournament found in Elympics:\n` +
      `Name: ${details.Name}\n` +
      `State: ${details.State}\n` +
      `OwnerId: ${details.OwnerId ?? "(none)"}\n...`,
    );

    // Offer to insert into local DB
    const kb = new InlineKeyboard()
      .text("Insert", "tourn_insert")
      .text("Cancel", "tourn_cancel");

    await ctx.reply("Would you like to insert this tournament in the local DB?", {
      reply_markup: kb,
    });

    // IMPORTANT: now set the step to "confirmInsert" (or "confirmCreate" if that's your flow)
    ctx.session.tournamentStep = "confirmInsert";
  } catch (err) {
    handleCheckError(ctx, err);
  }
}
