import { MAIN_TG_CHANNEL_ID, MAIN_TG_CHAT_ID } from "@/constants";
import { cacheKeys, cacheLvl, redisTools } from "@/lib/redisTools";
import { usersDB } from "@/db/modules/users.db";
import rewardService, { createUserRewardSBT } from "@/services/rewardsService";
import { validateMiniAppData } from "@/utils";
import { tgSafeCall } from "@/utils/tgSafeCall";
import { TRPCError } from "@trpc/server";
import { Bot } from "grammy";
import { z } from "zod";
import { fetchOntonSettings } from "@/db/modules/ontoSetting";
import { adminOrganizerProtectedProcedure, initDataProtectedProcedure, publicProcedure, router } from "../trpc";

export const usersRouter = router({
  validateUserInitData: publicProcedure.input(z.string()).query(async (opts) => {
    return validateMiniAppData(opts.input);
  }),

  haveAccessToEventAdministration: adminOrganizerProtectedProcedure.query(async (opts) => {
    return {
      valid: true,
      role: opts.ctx.userRole,
      user: opts.ctx.user,
    } as const;
  }),

  // private
  syncUser: initDataProtectedProcedure.query(async (opts) => {
    return opts.ctx.user;
  }),

  // private
  getWallet: initDataProtectedProcedure.input(z.object({ wallet_address: z.string().optional() })).query(async (opts) => {
    const res = await usersDB.selectWalletById(opts.ctx.user.user_id);
    // logger.log(res);

    return res?.wallet;
  }),

  // private
  addWallet: initDataProtectedProcedure
    .input(
      z.object({
        wallet: z.string(),
      })
    )
    .mutation(async (opts) => {
      await usersDB.updateWallet(opts.ctx.user.user_id, opts.input.wallet, opts.ctx.user.user_id.toString());
    }),
  createUserReward: initDataProtectedProcedure
    .input(
      z.object({
        event_uuid: z.string().uuid(),
      })
    )
    .mutation(async (opts) => {
      return await rewardService.createTonSocietySBTReward(opts.input.event_uuid, opts.ctx.user.user_id);
    }),

  joinOntonTasks: initDataProtectedProcedure.query(async (c) => {
    const { configProtected } = await fetchOntonSettings();
    const checkJoinBotToken = configProtected["check_join_bot_token"] as string;
    const userId = c.ctx.user.user_id;
    const memberStatuses = ["member", "creator", "administrator", "restricted"];

    const tgBot = new Bot(checkJoinBotToken);
    await tgBot.stop();

    // main tg channel
    let isJoinedCh = await redisTools.getCache(cacheKeys.join_task_tg_ch + userId);
    if (!isJoinedCh) {
      const { data: chatMember, error: chatError } = await tgSafeCall(() =>
        tgBot.api.getChatMember(MAIN_TG_CHANNEL_ID, userId)
      );

      if (chatError) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: chatError.message,
        });
      }

      const userStatus = chatMember.status;
      isJoinedCh = memberStatuses.includes(userStatus) && (userStatus === "restricted" ? chatMember.is_member : true);
      await redisTools.setCache(cacheKeys.join_task_tg_ch + userId, isJoinedCh, cacheLvl.long);
    }

    // main tg group
    let isJoinedGp = await redisTools.getCache(cacheKeys.join_task_tg_gp + userId);
    if (!isJoinedGp) {
      const { data: chatMemberGp, error: chatErrorGp } = await tgSafeCall(() =>
        tgBot.api.getChatMember(MAIN_TG_CHAT_ID, userId)
      );

      if (chatErrorGp) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: chatErrorGp.message,
        });
      }

      const userStatusGp = chatMemberGp.status;
      isJoinedGp = memberStatuses.includes(userStatusGp) && (userStatusGp === "restricted" ? chatMemberGp.is_member : true);
      await redisTools.setCache(cacheKeys.join_task_tg_gp + userId, isJoinedGp, cacheLvl.long);
    }

    return { ch: isJoinedCh, gp: isJoinedGp, all_done: isJoinedCh && isJoinedGp };
  }),
  getVisitorReward: initDataProtectedProcedure
    .input(
      z.object({
        event_uuid: z.string().uuid(),
      })
    )
    .query(async (opts) => {
      const { event_uuid } = opts.input;
      const { user_id } = opts.ctx.user;
      return await rewardService.createTonSocietySBTReward(event_uuid, user_id);
    }),
});
