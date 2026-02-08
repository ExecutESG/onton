import { publicProcedure, router } from "@/server/trpc";
import { fetchOntonSettings } from "@/db/modules/ontoSetting";

export const configRouter = router({
  getConfig: publicProcedure.query(async () => {
    try {
      const { config } = await fetchOntonSettings();
      return { config };
    } catch (error) {
      console.error("Error fetching config:", error);
      throw new Error("Failed to fetch config");
    }
  }),
});
