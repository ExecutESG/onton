import { router, initDataProtectedProcedure } from "../trpc";
import { z } from "zod";
import { makeGithubAuthUrl } from "@/lib/github";
import { usersGithubDB } from "@/db/modules/usersGithub.db";
import { redisTools } from "@/lib/redisTools";
import { logger } from "@/server/utils/logger";

const OAUTH_TTL = 15 * 60;

/* input for saveAccount */
const saveGhSchema = z.object({
  ghUserId: z.string(),
  ghLogin: z.string(),
  ghDisplayName: z.string().optional(),
  ghAvatarUrl: z.string().optional(),
});

export const usersGithubRouter = router({
  /* 1. auth URL */
  getAuthUrl: initDataProtectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;
    const { url, state } = makeGithubAuthUrl();

    await redisTools.setCache(
      `ghoauth:${state}`,
      {
        telegramUserId: user.user_id,
        returnUrl: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=tab_quest`,
      },
      OAUTH_TTL
    );
    return { authUrl: url };
  }),

  /* 2. save mapping */
  saveAccount: initDataProtectedProcedure.input(saveGhSchema).mutation(async ({ ctx, input }) => {
    await usersGithubDB.upsertGithubAccount({
      userId: ctx.user.user_id,
      ...input,
    });
    logger.info(`GitHub ${input.ghLogin} linked to TG user ${ctx.user.user_id}`);
    return { success: true };
  }),

  /* 3. read mapping */
  getLinkedAccount: initDataProtectedProcedure.query(({ ctx }) => usersGithubDB.getGithubAccountByUserId(ctx.user.user_id)),

  /* 4. unlink */
  unlink: initDataProtectedProcedure.mutation(async ({ ctx }) => {
    await usersGithubDB.deleteGithubAccount(ctx.user.user_id);
    return { success: true };
  }),
});
