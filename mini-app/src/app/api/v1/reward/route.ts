import eventDB from "@/db/modules/events.db";
import { z } from "zod";
import { logger } from "@/server/utils/logger";
import { getAuthenticatedUserApi } from "@/server/auth";
import { createUserRewardLink } from "@/lib/ton-society-api";
import "@/lib/gracefullyShutdown";
import rewardDB from "@/db/modules/rewards.db";
import rewardService from "@/services/rewardsService";
import externalSellerApi from "@/lib/externalSeller.api";
/* -------------------------------------------------------------------------- */
/*                              Reward Api Schema                             */
/* -------------------------------------------------------------------------- */
const rewardCreateSchema = z.object({
  reward_user_id: z.number(),
  event_uuid: z.string().uuid(),
});

/* -------------------------------------------------------------------------- */
/*                                 Main Route                                 */

/* -------------------------------------------------------------------------- */
export async function POST(request: Request) {
  let sbtClaimLink;
  let tryCount = 0;
  const tryInterval = 1000;
  const maxTries = 10;
  try {
    const [userId, error] = await getAuthenticatedUserApi(request);
    if (error) {
      return error;
    }

    const rawBody = await request.json();

    const body = rewardCreateSchema.safeParse(rawBody);

    if (!body.success) {
      return Response.json(body.error.flatten(), {
        status: 400,
      });
    }
    logger.log("reward_api_call", body);
    const eventData = await eventDB.selectEventByUuid(body.data.event_uuid);
    if (!eventData) {
      return Response.json({ message: "event not found" }, { status: 400 });
    }

    if (eventData.owner !== userId) return Response.json({ message: "Unauthorized Access to event" }, { status: 401 });

    if (!eventData.activity_id) return Response.json({ message: "Event not published yet" }, { status: 400 });

    const now = Date.now();

    if (eventData.start_date > now || now < eventData.end_date)
      return Response.json({ message: "Event is not ongoing" }, { status: 400 });
    // Check to create user if not exists
    await externalSellerApi.ensureUserExists(body.data.reward_user_id, "GameReward", `Game_${userId}`);
    const eventRewardLink = await rewardDB.fetchRewardLinkForEvent(eventData.event_uuid, "ton_society_sbt");
    if (
      eventRewardLink &&
      typeof eventRewardLink.data === "object" &&
      "reward_link" in (eventRewardLink.data as Record<string, unknown>) &&
      typeof (eventRewardLink.data as { reward_link?: unknown }).reward_link === "string"
    ) {
      sbtClaimLink = (eventRewardLink.data as { reward_link: string }).reward_link;
    }
    if (!sbtClaimLink) {
      const society_hub_value =
        typeof eventData.society_hub === "string"
          ? eventData.society_hub
          : eventData.society_hub?.name || ("Onton" as const);
      while (tryCount <= maxTries) {
        try {
          const res = await createUserRewardLink(eventData.activity_id, {
            telegram_user_id: body.data.reward_user_id,
            attributes: eventData?.society_hub
              ? [
                  {
                    trait_type: "Organizer",
                    value: society_hub_value,
                  },
                ]
              : undefined,
          });
          if (res.data && res.data.data && res.data.data.reward_link) {
            sbtClaimLink = res.data.data.reward_link;
            return Response.json(res.data, { status: 200 });
          } else if (tryCount === maxTries) {
            if (!res || !res.data || !res.data.data) {
              logger.error(`reward_api_creation_error for last time ${tryCount} event_uuid: ${eventData.event_uuid}`, res);
              return Response.json({ message: "Someting is Wrong with Creating reward" }, { status: 500 });
            }
          }
        } catch (error) {
          logger.error(`reward_api_creation_error for first time ${tryCount} event_uuid: ${eventData.event_uuid}`, error);
        }
        tryCount++;
        await new Promise((resolve) => setTimeout(resolve, tryInterval));
      }
    } else {
      await rewardService.createTonSocietySBTReward(eventData.event_uuid, body.data.reward_user_id);
      return Response.json(
        {
          message: "Reward Created",
          status: "status",
          data: { reward_link: sbtClaimLink },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    logger.error("reward_api_general_error", error);

    return Response.json({ message: "Something Went Wrong" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
