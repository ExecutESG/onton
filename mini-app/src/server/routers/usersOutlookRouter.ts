import { router, initDataProtectedProcedure } from "../trpc";
import { z } from "zod";

import { makeOutlookAuthUrl } from "@/lib/outlook"; // ← PKCE helper you created earlier
import { usersOutlookDB } from "@/db/modules/usersOutlook.db";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";

/* ════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════ */
const OAUTH_TTL = 15 * 60; // 15 minutes
const REDIS_KEY = (state: string) => `msoauth:${state}`;

/* ════════════════════════════════════════
   Zod input‑schema
   ════════════════════════════════════════ */
const saveAccountSchema = z.object({
  msUserId: z.string(), // Graph “id”
  msDisplayName: z.string().optional(),
  msGivenName: z.string().optional(),
  msSurname: z.string().optional(),
  msUserPrincipalName: z.string().email().optional(),
  msAvatarUrl: z.string().url().optional(),
});

/* ════════════════════════════════════════
   ROUTER
   ════════════════════════════════════════ */
export const usersOutlookRouter = router({
  /* ------------------------------------------------------------ *
   * 1)  GET auth‑URL (starts Microsoft OAuth flow)               *
   * ------------------------------------------------------------ */
  getAuthUrl: initDataProtectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx; // Telegram user
    const { url, codeVerifier, state } = makeOutlookAuthUrl();

    /* save verifier + TG‑user in Redis (15 min) */
    await redisTools.setCache(
      REDIS_KEY(state),
      {
        codeVerifier,
        telegramUserId: user.user_id,
        returnUrl: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=tab_quest`,
      },
      OAUTH_TTL
    );

    return { authUrl: url };
  }),

  /* ------------------------------------------------------------ *
   * 2)  SAVE / UPSERT mapping (fallback, if you post from UI)    *
   * ------------------------------------------------------------ */
  saveAccount: initDataProtectedProcedure.input(saveAccountSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.user.user_id;

    await usersOutlookDB.upsertOutlookAccount({
      userId,
      msUserId: input.msUserId,
      msDisplayName: input.msDisplayName,
      msGivenName: input.msGivenName,
      msSurname: input.msSurname,
      msUserPrincipalName: input.msUserPrincipalName,
      msAvatarUrl: input.msAvatarUrl,
    });

    logger.info(`Linked Outlook acct ${input.msUserPrincipalName ?? input.msUserId} → TG user #${userId}`);
    return { success: true };
  }),

  /* ------------------------------------------------------------ *
   * 3)  GET currently‑linked Outlook account                     *
   * ------------------------------------------------------------ */
  getLinkedAccount: initDataProtectedProcedure.query(async ({ ctx }) => {
    return usersOutlookDB.getOutlookAccountByUserId(ctx.user.user_id);
  }),

  /* ------------------------------------------------------------ *
   * 4)  UNLINK                                                   *
   * ------------------------------------------------------------ */
  unlink: initDataProtectedProcedure.mutation(async ({ ctx }) => {
    await usersOutlookDB.deleteOutlookAccount(ctx.user.user_id);
    return { success: true };
  }),
});
