// The integration with ton society apis will be here
import { TonSocietyActivityFullResponse, TonSocietyRegisterActivityResponse } from "@/types/event.types";
import { findActivityResponseType, TSAPIoperations } from "@/types/ton-society-api-types";
import { CreateUserRewardLinkReturnType, type CreateUserRewardLinkInputType } from "@/types/user.types";
import { TRPCError } from "@trpc/server";
import axios, { AxiosError } from "axios";
import { HubsResponse, SocietyHub } from "@/types";
import { redisTools } from "@/lib/redisTools";
import { configDotenv } from "dotenv";
import { logger } from "@/server/utils/logger";

configDotenv();
// ton society client to send http requests to https://ton-society.github.io/sbt-platform
export const tonSocietyClient = axios.create({
  baseURL: process.env.TON_SOCIETY_BASE_URL,
  headers: {
    "x-api-key": process.env.TON_SOCIETY_API_KEY,
    "x-partner-id": "onton",
  },
});

/**
 * Returns a unique reward link for users to receive rewards through participation in activities
 * more: https://ton-society.github.io/sbt-platform/#/Activities/createRewardLink
 */
export async function createUserRewardLink(
  activityId: number,
  data: CreateUserRewardLinkInputType
): Promise<{ data: CreateUserRewardLinkReturnType }> {
  // 1) Check if the reward link already exists
  try {
    const getResponse = await tonSocietyClient.get<CreateUserRewardLinkReturnType>(
      `/activities/${activityId}/rewards/${data.telegram_user_id}`
    );

    // If reward_link is present, return it and skip creation
    if (getResponse?.data?.data?.reward_link) {
      return { data: getResponse.data };
    }
    // If we got a 2xx response but no reward_link, we'll create a new one below
  } catch (error) {
    // if GET fails, check if it's a 404 -> meaning "reward link not found" is expected
    // if (error instanceof AxiosError && error.response?.status !== 404) {
    //   // any non-404 error is unexpected; rethrow it
    //   throw error;
    // }
    logger.error(
      `Error getting reward link (will try to create) for activityId=${activityId}, data=${JSON.stringify(data)}`,
      error
    );
    // if it was 404, we do nothing and proceed to POST below
  }

  try {
    // 2) If the GET succeeded but `reward_link` is missing, create a new link
    const postResponse = await tonSocietyClient.post<CreateUserRewardLinkReturnType>(
      `/activities/${activityId}/rewards`,
      data
    );

    // Validate that we got a reward_link
    if (!postResponse?.data?.data?.reward_link) {
      throw new Error(`Failed to create reward link for activityId=${activityId}, data=${JSON.stringify(data)}`);
    }

    return { data: postResponse.data };
  } catch (error) {
    // log and rethrow the error
    if ((error as AxiosError).response?.data) {
      if ((error as AxiosError).response?.status === 429) {
        logger.error(
          `REWARD_LINK_RATE_LIMIT Error creating reward link for activityId=${activityId}, data=${JSON.stringify(data)}`,
          (error as AxiosError).response?.status
        );
      }
      logger.error(
        `Error creating reward link for activityId=${activityId}, data=${JSON.stringify(data)}`,
        (error as AxiosError).response?.status
      );
    } else {
      // console.error(`Error creating reward link for activityId=${activityId}, data=${JSON.stringify(data)}`, error);
    }
    throw error;
  }
}

/**
 * An endpoint that allows to create a new activity of the "Events" activity group.
 * more: https://ton-society.github.io/sbt-platform/#/Activities/createEvent
 */
export async function registerActivity(
  activityDetails: TSAPIoperations["createEvent"]["requestBody"]["content"]["application/json"]
) {
  const response = await tonSocietyClient.post("/activities", activityDetails);
  // log error if response status is not 200
  if (response.status !== 200) {
    logger.error(`Error registering activity: ${response}`);
  }
  return response.data as TonSocietyRegisterActivityResponse;
}

export type CreateActivityRequestBody = TSAPIoperations["createEvent"]["requestBody"]["content"]["application/json"];

/**
 * An endpoint that allows to create a new activity of the "Events" activity group.
 * more: https://ton-society.github.io/sbt-platform/#/Activities/updateEvent
 */
export async function updateActivity(
  activityDetails: TSAPIoperations["updateEvent"]["requestBody"]["content"]["application/json"],
  activity_id: string | number
) {
  if (!activity_id)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "event does not have a valid activity id",
    });
  logger.info(`Updating activity ${activity_id} with details`, activityDetails);
  const response = await tonSocietyClient.patch(`/activities/${activity_id}`, activityDetails);
  return response.data as { status: "success"; data: {} };
}

export async function getSBTClaimedStatus(activity_id: number, user_id: number | string) {
  if (!user_id || !activity_id) {
    return { status: `Wrong_avtivity_${activity_id}` };
  }

  user_id = String(user_id);
  try {
    const result = await tonSocietyClient.get(`/activities/${activity_id}/rewards/${user_id}/status`);
    return result.data.data as {
      status: "NOT_CLAIMED" | "CLAIMED" | "RECEIVED";
    };
  } catch (error) {
    logger.error(`Error getting SBT claimed status for activity ${activity_id} and user ${user_id}`);
    return {
      status: "NOT_ELIGIBLE",
    };
  }
}

export async function findActivity(activity_id: number): Promise<findActivityResponseType> {
  if (!activity_id) {
    throw new Error("wrong activity id");
  }

  const result = await tonSocietyClient.get(`/activities/${activity_id}`);
  return result.data;
}

export async function getHubs(): Promise<SocietyHub[]> {
  // Define a cache key – you can parameterize if needed.
  const cacheKey = redisTools.cacheKeys.hubs;

  // 1. Try to read from the cache
  const cachedResult: SocietyHub[] = await redisTools.getCache(cacheKey);
  if (cachedResult) {
    // If we have a cached copy, return it
    return cachedResult;
  }

  try {
    // 2. Otherwise, fetch fresh data
    const response = await tonSocietyClient.get<HubsResponse>("/hubs", {
      params: {
        _start: 0,
        _end: 100,
      },
    });

    if (response.status === 200 && response.data) {
      // sort hubs by attributes.title
      const sortedHubs = response.data.data.sort((a, b) => a.attributes.title.localeCompare(b.attributes.title));
      const transformedHubs = sortedHubs.map((hub) => ({
        id: hub.id.toString(),
        name: hub.attributes.title,
      }));

      // 3. Cache the transformed result
      await redisTools.setCache(cacheKey, transformedHubs, redisTools.cacheLvl.medium);

      // 4. Return the data
      return transformedHubs;
    }

    // If response is invalid:
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch hubs data",
    });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch hubs data",
    });
  }
}

/**
 * Fetch status of a unique reward link
 *
 * Endpoint:
 * GET /activities/{path}/rewards/{participant_id}/status
 *
 * @param activity_id - Activity's internal ID or friendly collection address
 * @param user_id - Unique identifier of the activity participant,
 *   either wallet address (friendly format) or Telegram user ID
 * @returns The full response from the Ton Society API, which includes the status
 */
export async function getRewardStatus(
  activity_id: number,
  user_id: number
): Promise<{
  status: string;
  data?: {
    status: "NOT_CLAIMED" | "CLAIMED" | "RECEIVED" | string;
  };
}> {
  if (!activity_id || !user_id) {
    // Return or throw—depending on your desired error handling
    return { status: `Invalid parameters: activity_id=${activity_id}, user_id=${user_id}` };
  }

  try {
    const response = await tonSocietyClient.get(`/activities/${activity_id}/rewards/${user_id}/status`);
    return response.data;
  } catch (error) {
    // You can refine error handling as needed
    return {
      status: "error",
    };
  }
}

export async function getFullActivityDetails(activityId: number): Promise<TonSocietyActivityFullResponse> {
  if (!activityId) {
    throw new Error("Activity ID must be provided");
  }

  try {
    const response = await tonSocietyClient.get<TonSocietyActivityFullResponse>(`/activities/${activityId}`);

    // verify response.data.status === "success"
    if (response.data.status !== "success") {
      throw new Error(`Unexpected status: ${response.data.status}`);
    }

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      // Handle HTTP errors
      const status = error.response?.status;
      if (status === 404) {
        logger.warn(`Activity ${activityId} not found on Ton Society (404).`);
        throw new Error(`Activity ${activityId} not found (404).`);
      }
      if (status === 500) {
        logger.error(`Server error (500) when fetching activity ${activityId}.`);
        throw new Error(`Internal server error (500) fetching activity ${activityId}.`);
      }
      if (status === 403) {
        logger.error(`Forbidden error (403) when fetching activity ${activityId}.`);
        throw new Error(`Forbidden error (403) fetching activity ${activityId}.`);
      }
      if (status === 429) {
        logger.error(`Rate limit error (429) when fetching activity ${activityId}.`);
        throw new Error(`Rate limit error (429) fetching activity ${activityId}.`);
      }

      // You can handle other status codes if desired
      logger.error(`Error fetching activity ${activityId} from Ton Society:`, status);
      throw error; // rethrow or throw a custom error
    } else {
      // Non-Axios error (network or other issue)
      logger.error(`Unexpected error fetching activity ${activityId}:`, error);
      throw error; // or wrap it in a new error
    }
  }
}
