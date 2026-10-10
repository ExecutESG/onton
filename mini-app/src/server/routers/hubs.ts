import { initDataProtectedProcedure, publicProcedure, router } from "@/server/trpc";
import { hardCodedHubs } from "@/constants";

const getHubs = publicProcedure.query(async () => {
  return {
    status: true,
    success: true,
    hubs: hardCodedHubs,
  };
});

const getOrgHubs = initDataProtectedProcedure.query(async () => {
  return {
    status: true,
    hubs: hardCodedHubs,
  };
});

export const hubsRouter = router({
  getHubs,
  getOrgHubs,
});
