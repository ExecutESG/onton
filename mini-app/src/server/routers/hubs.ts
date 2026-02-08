import { initDataProtectedProcedure, router } from "@/server/trpc";
import { hardCodedHubs, nonVerifiedHubs } from "@/constants";
import { getHubs as getHubsApi } from "@/lib/ton-society-api";
import { organizerTsVerified } from "@/db/modules/userFlags.db";

const getHubs = initDataProtectedProcedure.query(async () => {
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

const getOrgHubs = initDataProtectedProcedure.query(async (opts) => {
  // return hard coded hubs for local env
  if (process.env?.ENV === "local") {
    return {
      status: true,
      hubs: hardCodedHubs,
    };
  }

  const isUserTsVerified = await organizerTsVerified(opts.ctx.user.user_id);
  // return non verified hubs
  if (!isUserTsVerified) {
    return {
      status: true,
      hubs: nonVerifiedHubs,
    };
  }
  // return all hubs
  const result = await getHubsApi();
  return {
    status: true,
    hubs: result,
  };
});

export const hubsRouter = router({
  getHubs,
  getOrgHubs,
});
