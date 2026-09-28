import { initDataProtectedProcedure, publicProcedure, router } from "@/server/trpc";
import { hardCodedHubs, nonVerifiedHubs } from "@/constants";
import { getHubs as getHubsApi } from "@/lib/ton-society-api";

const getHubs = publicProcedure.query(async () => {
  if (process.env?.ENV === "local") {
    return {
      status: true,
      hubs: hardCodedHubs,
    };
  }
  const result = await getHubsApi();
  return {
    success: true,
    hubs: result,
  };
});

const getOrgHubs = initDataProtectedProcedure.query(async () => {
  // return hard coded hubs for local env
  if (process.env?.ENV === "local") {
    return {
      status: true,
      hubs: hardCodedHubs,
    };
  }

  try {
    const result = await getHubsApi();
    return {
      status: true,
      hubs: result && result.length > 0 ? result : nonVerifiedHubs,
    };
  } catch {
    return {
      status: true,
      hubs: nonVerifiedHubs,
    };
  }
});

export const hubsRouter = router({
  getHubs,
  getOrgHubs,
});
