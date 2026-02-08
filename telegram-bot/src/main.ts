import bodyParser from "body-parser";
import "dotenv/config";
import express from "express";
import fileUpload from "express-fileupload";
import { Bot, session } from "grammy";
import { mainComposer } from "./composers";
import { RATE_LIMIT_OPTIONS } from "./constants";
import { checkBotAdminHandler } from "./controllers/checkBotAdminHandler";
import { createInviteLinkHandler } from "./controllers/createInviteLinkHandler";
import { deleteInviteLinkHandler } from "./controllers/deleteInviteLinkHandler";
import { handleCheckBlockStatus } from "./controllers/handleCheckBlockStatus";
import { handleFileSend } from "./controllers/handleFileSend";
import { handlePhotoMessage } from "./controllers/handlePhotoMessage";
import { handleSendQRCode } from "./controllers/handleSendQRCode";
import { handleShareEvent } from "./controllers/handleShareEvent";
import { handleShareOrganizer } from "./controllers/handleShareOrganizer";
import { sendMessage } from "./controllers/sendMessage";
import { announceBotAdded } from "./handlers/announceBotAdded";
import { bannerHandler } from "./handlers/bannerHandler";
import { cmdHandler } from "./handlers/cmdHandler";
import { orgHandler } from "./handlers/orgHandler";
import { startHandler } from "./handlers/startHandler";
import { updateAdminOrganizerProfilesHandler } from "./handlers/updateAdminOrganizerProfilesHandler";
import { isBotNewlyAddedOrPromoted } from "./helpers/isBotNewlyAddedOrPromoted";
import { connectRedis } from "./lib/redisTools";
import { MyContext } from "./types/MyContext";
import { checkRateLimit } from "./utils/checkRateLimit";
import { logger } from "./utils/logger";
import { handleShareTournament } from "./handlers/handleShareTournament";
import { handleShareAffiliateLink } from "./handlers/handleShareAffiliateLink";

import {handleShareJoinOntonLink} from "./controllers/handleShareJoinOntonLink";

import {startPollSenderCron} from "./cronJobs/initializer";
export const bot = new Bot<MyContext>(process.env.BOT_TOKEN || "");

(async function bootstrap() {
  try {
    // 1) Connect to Redis
    await connectRedis();
    logger.log("Redis connected successfully.");

    // 2) Initialize your bot

    bot.use(session({ initial: () => ({}) }));
    logger.log("Starting bot... v2");
    // --- RATE LIMIT MIDDLEWARE ---
    bot.use(async (ctx, next) => {
      const user = ctx.from;
      if (!user) return next();

      // Check if the incoming message has a 'bot_command' type
      const hasCommandEntity =
        ctx.message?.entities?.some(
          (entity) => entity.type === "bot_command",
        ) || false;

      if (hasCommandEntity) {
        const userId = String(user.id);
        // Check rate limit => 10 commands per minute
        const { allowed } = await checkRateLimit(
          userId,
          "command",
          RATE_LIMIT_OPTIONS.max,
          RATE_LIMIT_OPTIONS.windowSec,
        );
        if (!allowed) {
          await ctx.reply(RATE_LIMIT_OPTIONS.message);
          logger.warn(`Rate limit exceeded for user ${userId}`);
          return;
        }
      }
      await next();
    });


    // 3) Register commands, handlers, etc.
    bot.command("update_profiles", updateAdminOrganizerProfilesHandler);
    bot.command("org", orgHandler);
    bot.command("cmd", cmdHandler);
    bot.command("banner", bannerHandler);
    bot.command("start", startHandler);
    //bot.command("sbtdist", sbtdistHandler);
    bot.command("id", async (ctx) => {
      await announceBotAdded(ctx);

    });
    bot.on("my_chat_member", async (ctx) => {
      // Check if the bot is newly added or promoted
      if (isBotNewlyAddedOrPromoted(ctx)) {
        await announceBotAdded(ctx);
      }
    });

    bot.use(mainComposer);


    bot.catch(e => console.log(e));

    // 4) Start the bot (non-blocking)
    bot
      .start({
        drop_pending_updates: true,
      })
      .then(() => logger.log("Bot started"))
      .catch((err) => logger.error("Bot start error:", err));

    // 5) Create and configure Express
    const port = process.env.TELEGRAM_BOT_PORT || 3333;
    const app = express();

    app.use(bodyParser.json());
    app.use(fileUpload() as unknown as express.RequestHandler);
    app.use((req, _, next) => {
      // @ts-expect-error fix express.d.ts
      req.bot = bot;
      next();
    });

    // 6) Register routes
    app.post("/send-file", handleFileSend);
    app.get("/generate-qr", handleSendQRCode);
    app.post("/share-event", handleShareEvent);
    // @ts-expect-error
    app.post("/send-message", sendMessage);
    app.post("/send-photo", handlePhotoMessage);
    app.post("/share-organizer", handleShareOrganizer);
    app.post("/share-tournament", handleShareTournament);
    app.post("/check-block-status", handleCheckBlockStatus);
    app.post("/check-bot-admin", checkBotAdminHandler);
    app.post("/create-invite", createInviteLinkHandler);
    app.post("/delete-invite", deleteInviteLinkHandler);
    app.post("/share-affiliate-link", handleShareAffiliateLink);
    app.post("/share-join-onton-link-affiliate", handleShareJoinOntonLink);
    // 7) Start listening, store the server instance
    const server = app.listen(port, () =>
      logger.log(`Telegram Bot API service on port ${port}`),
    );
    // 3) **Call the cron job** after the bot is available
    startPollSenderCron(); // The function that schedules the cron
    logger.log("PollSenderCron job scheduled to run every 2 minutes.");
    // CLEAN SHUTDOWN HANDLERS
    process.once("SIGINT", async () => {
      logger.log("Received SIGINT. Stopping bot and server...");
      await bot.stop(); // gracefully stop the bot
      server.close(() => {
        logger.log("HTTP server closed. Exiting process.");
        process.exit(0);
      });
    });

    process.once("SIGTERM", async () => {
      logger.log("Received SIGTERM. Stopping bot and server...");
      await bot.stop();
      server.close(() => {
        logger.log("HTTP server closed. Exiting process.");
        process.exit(0);
      });
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    });
  } catch (err) {
    logger.error("Failed to bootstrap application:", err);
    process.exit(1);
  }
})();
