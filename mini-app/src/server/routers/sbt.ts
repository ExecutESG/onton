import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { sbtService } from "@/services/sbtService";
import { sbtDB } from "@/db/modules/sbt.db";
import { TRPCError } from "@trpc/server";

export const sbtRouter = router({
  getEventCollection: publicProcedure
    .input(z.object({ eventUuid: z.string() }))
    .query(async ({ input }) => {
      const collection = await sbtDB.findCollectionByEventUuid(input.eventUuid);
      return {
        collection,
      };
    }),

  getUserBadges: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const badges = await sbtDB.findUserSbtItems(input.userId);
      return {
        badges,
      };
    }),

  getWalletBadges: publicProcedure
    .input(z.object({ walletAddress: z.string() }))
    .query(async ({ input }) => {
      const badges = await sbtDB.findWalletSbtItems(input.walletAddress);
      return {
        badges,
      };
    }),

  verifyOwnership: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        eventUuid: z.string(),
      })
    )
    .query(async ({ input }) => {
      const result = await sbtService.verifySbtOwnership(input.walletAddress, input.eventUuid);
      return result;
    }),

  mintBadge: publicProcedure
    .input(
      z.object({
        eventUuid: z.string(),
        userId: z.number().optional(),
        walletAddress: z.string(),
        badgeTitle: z.string().optional(),
        badgeDescription: z.string().optional(),
        badgeImage: z.string().optional(),
        attributes: z
          .array(
            z.object({
              trait_type: z.string(),
              value: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const item = await sbtService.mintSbtBadge(input);
        return {
          success: true,
          item,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to mint SBT badge";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
