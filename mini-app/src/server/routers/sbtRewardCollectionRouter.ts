// sbtRewardCollectionRouter.ts
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import {
  fetchAllSBTRewardCollections,
  fetchSBTRewardCollectionsByHubID,
  fetchSBTRewardCollectionById,
} from "@/db/modules/SBTRewardCollection.db";

export const sbtRewardCollectionRouter = router({
  getAllRewardCollections: publicProcedure.query(async () => {
    return await fetchAllSBTRewardCollections();
  }),

  getRewardCollectionsByHubID: publicProcedure.input(z.object({ hubID: z.number() })).query(async (opts) => {
    return await fetchSBTRewardCollectionsByHubID(opts.input.hubID);
  }),

  getRewardCollectionById: publicProcedure.input(z.object({ id: z.number() })).query(async (opts) => {
    return await fetchSBTRewardCollectionById(opts.input.id);
  }),
});
