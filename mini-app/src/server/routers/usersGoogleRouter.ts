import { router, initDataProtectedProcedure } from "../trpc";
import { z } from "zod";

import { makeGoogleAuthUrl } from "@/lib/google";
import { usersGoogleDB } from "@/db/modules/usersGoogle.db";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";

/* ------------------------------------------------------------------ */
/*                           CONSTANTS                                */
/* ------------------------------------------------------------------ */
const OAUTH_TTL = 15 * 60; // 15‑minute Redis lifetime
const REDIS_KEY = (state: string) => `goauth:${state}`;

/* ------------------------------------------------------------------ */
/*                       Zod input schemas                            */
/* ------------------------------------------------------------------ */
const saveAccountSchema = z.object({
  gUserId: z.string(), // Google “sub”
  gEmail: z.string().email(),
  gDisplayName: z.string().optional(),
  gAvatarUrl: z.string().url().optional(),
});

/* ------------------------------------------------------------------ */
/*                            ROUTER                                  */
/* ------------------------------------------------------------------ */
export const usersGoogleRouter = router({
  /* -------------------------------------------------------------- */
  /* 1)  /usersGoogle.getAuthUrl ‑ generate Google sign‑in link     */
  /* -------------------------------------------------------------- */
  getAuthUrl: initDataProtectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx; // Telegram user
    const { url, codeVerifier, state } = makeGoogleAuthUrl();

    /* 🔸 save PKCE verifier + TG‑user id in Redis for 15 min */
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

  /* -------------------------------------------------------------- */
  /* 2)  /usersGoogle.saveAccount ‑ persist mapping (fallback use)  */
  /* -------------------------------------------------------------- */
  saveAccount: initDataProtectedProcedure.input(saveAccountSchema).mutation(async ({ ctx, input }) => {
    const { gUserId, gEmail, gDisplayName, gAvatarUrl } = input;
    const userId = ctx.user.user_id;

    await usersGoogleDB.upsertGoogleAccount({
      userId,
      gUserId,
      gEmail,
      gDisplayName,
      gAvatarUrl,
    });

    logger.info(`Linked Google acct ${gEmail} (${gUserId}) → TG user #${userId}`);
    return { success: true };
  }),

  /* -------------------------------------------------------------- */
  /* 3)  /usersGoogle.getLinkedAccount                              */
  /* -------------------------------------------------------------- */
  getLinkedAccount: initDataProtectedProcedure.query(async ({ ctx }) => {
    return usersGoogleDB.getGoogleAccountByUserId(ctx.user.user_id); // null if none
  }),

  /* -------------------------------------------------------------- */
  /* 4)  /usersGoogle.unlink                                        */
  /* -------------------------------------------------------------- */
  unlink: initDataProtectedProcedure.mutation(async ({ ctx }) => {
    await usersGoogleDB.deleteGoogleAccount(ctx.user.user_id);
    return { success: true };
  }),
});
