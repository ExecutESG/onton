import { router, initDataProtectedProcedure } from "../trpc";
import { z } from "zod";

import { makeLinkedinAuthUrl } from "@/lib/linkedin";
import { usersLinkedinDB } from "@/db/modules/usersLinkedin.db";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";

const OAUTH_TTL = 15 * 60; // 15 minutes

/* ------------------------------------------------------------------ */
/*                  1. Zod schema for saveAccount                     */
/* ------------------------------------------------------------------ */
const saveLiSchema = z.object({
  liUserId: z.string(),
  liFirstName: z.string().optional(),
  liLastName: z.string().optional(),
  liAvatarUrl: z.string().optional(),
  liEmail: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/*                       2.  TRPC router                              */
/* ------------------------------------------------------------------ */
export const usersLinkedinRouter = router({
  /* ------------------ Generate LinkedIn auth URL ------------------ */
  getAuthUrl: initDataProtectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx; // Telegram user
    const { url, state } = makeLinkedinAuthUrl(); // LinkedIn has no PKCE ⇒ no codeVerifier

    await redisTools.setCache(
      `lioauth:${state}`,
      {
        telegramUserId: user.user_id,
        returnUrl: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=tab_quest`,
      },
      OAUTH_TTL
    );

    return { authUrl: url };
  }),

  /* ---------------------- Persist the mapping --------------------- */
  saveAccount: initDataProtectedProcedure.input(saveLiSchema).mutation(async ({ ctx, input }) => {
    const { user } = ctx;
    await usersLinkedinDB.upsertLinkedinAccount({
      userId: user.user_id,
      ...input,
    });
    logger.info(`LinkedIn account ${input.liUserId} linked to TG user ${user.user_id}`);
    return { success: true };
  }),

  /* ----------------------- Read linked info ----------------------- */
  getLinkedAccount: initDataProtectedProcedure.query(async ({ ctx }) => {
    return usersLinkedinDB.getLinkedinAccountByUserId(ctx.user.user_id);
  }),

  /* ----------------------- Disconnect / unlink -------------------- */
  unlink: initDataProtectedProcedure.mutation(async ({ ctx }) => {
    await usersLinkedinDB.deleteLinkedinAccount(ctx.user.user_id);
    return { success: true };
  }),
});
