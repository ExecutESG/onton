import { router, initDataProtectedProcedure } from "../trpc";
import { z } from "zod";
import { makeAuthUrl } from "@/lib/twitter";
import { usersXDB } from "@/db/modules/usersX.db";
import { logger } from "@/server/utils/logger";
import { redisTools } from "@/lib/redisTools";
const OAUTH_TTL = 15 * 60;
/* --------------------------------------------- */
/*                 Zod Schemas                   */
/* --------------------------------------------- */
const saveAccountSchema = z.object({
  xUserId: z.string(),
  xUsername: z.string(),
  xDisplayName: z.string().optional(),
  xProfileImageUrl: z.string().optional(),
});

export const usersXRouter = router({
  /* ---------------------------------------------------- */
  /* 1) Generate “Sign‑in with X” URL (starts the login)   */
  /* ---------------------------------------------------- */
  getAuthUrl: initDataProtectedProcedure.query(async (opts) => {
    const { user } = opts.ctx; // Telegram user
    const { url, codeVerifier, state } = makeAuthUrl();

    /* -- ❶ Store verifier & TG user in Redis keyed by state -- */
    await redisTools.setCache(
      `xoauth:${state}`, // key
      {
        codeVerifier,
        telegramUserId: user.user_id,
        returnUrl: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=tab_quest`,
      },
      OAUTH_TTL // expire after 15 min
    );

    return { authUrl: url };
  }),

  /* ---------------------------------------------------- */
  /* 2) Save / update the mapping once OAuth is done      */
  /*    (front‑end calls this with data from callback)    */
  /* ---------------------------------------------------- */
  saveAccount: initDataProtectedProcedure.input(saveAccountSchema).mutation(async (opts) => {
    const { xUserId, xUsername, xDisplayName, xProfileImageUrl } = opts.input;
    const userId = opts.ctx.user.user_id;

    await usersXDB.upsertXAccount({
      userId,
      xUserId,
      xUsername,
      xDisplayName,
      xProfileImageUrl,
    });

    logger.info(`Linked X account ${xUsername} (${xUserId}) to TG user ${userId}`);
    return { success: true };
  }),

  /* ---------------------------------------------------- */
  /* 3) Fetch linked X account info                       */
  /* ---------------------------------------------------- */
  getLinkedAccount: initDataProtectedProcedure.query(async (opts) => {
    const xAccount = await usersXDB.getXAccountByUserId(opts.ctx.user.user_id);
    return xAccount; // null if not linked
  }),

  /* ---------------------------------------------------- */
  /* 4) Disconnect / unlink                               */
  /* ---------------------------------------------------- */
  unlink: initDataProtectedProcedure.mutation(async (opts) => {
    await usersXDB.deleteXAccount(opts.ctx.user.user_id);
    return { success: true };
  }),
});
