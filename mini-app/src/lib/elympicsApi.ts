import axios, { AxiosError, AxiosInstance } from "axios";
import { configDotenv } from "dotenv";
import { redisTools } from "@/lib/redisTools"; // Adjust path as needed
import { configProtected } from "@/server/config"; // Adjust path as needed
import { logger } from "@/server/utils/logger"; // Adjust path as needed
import {
  ClientSecretAuthRequest,
  ClientSecretAuthResponse,
  LeaderboardResponse,
  TournamentDetailsResponse,
} from "@/types/elympicsAPI.types";

configDotenv();

/**
 * 1) Create an Axios client. Adapt the base URL if needed.
 *    Typically: https://api.elympics.cc/v2
 */
export const elympicsClient: AxiosInstance = axios.create({
  baseURL: process.env.ELYMPICS_BASE_URL || "https://api.elympics.cc/v2",
});

/**
 * 2) Type definitions (using `type` rather than `interface`)
 */

/**
 * A utility to run an Elympics API request with automatic token refresh
 * if we get a 401/403 response.
 *
 * @param requestFn A function that takes a token, performs the request, and returns the data.
 * @returns The response data from the requestFn.
 */
export async function fetchWithAuth<T>(requestFn: (_token: string) => Promise<T>): Promise<T> {
  // First, get the token from cache or by calling clientSecretAuth
  let token = await getMasterApiBearerToken();

  try {
    // Attempt the request

    return await requestFn(token);
  } catch (err) {
    logger.error("=============Error fetching with auth:", err);

    // Check if it's an AxiosError with 401 or 403 => attempt a one-time re-auth
    if (err instanceof AxiosError && err.response && [401, 403].includes(err.response.status)) {
      // 1) Delete the cached token so we get a fresh one
      await redisTools.deleteCache(redisTools.cacheKeys.elympicsMasterJwt);

      // 2) Re-fetch a new token
      token = await getMasterApiBearerToken();

      // 3) Retry the request once
      return await requestFn(token);
    }
    // Otherwise, throw the original error
    throw err;
  }
}

/**
 * 3) Utility: central Axios error handler
 *    - IMPORTANT: We re-throw the original AxiosError so that `fetchWithAuth` can see the actual status code.
 */
function handleAxiosError(error: unknown, message: string): never {
  if (error instanceof AxiosError && error.response) {
    // Enhance the existing AxiosError message but re-throw the same AxiosError
    error.message = `${message}. HTTP Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    throw error; // Rethrow the *same* AxiosError
  }
  // Otherwise, throw a generic error
  throw new Error(`${message}. Unknown error: ${String(error)}`);
}

/**
 * 4) Fetch a new Master API token from Elympics (PUT /auth/user/clientSecretAuth)
 */
async function authenticateUserViaClientSecret(payload: ClientSecretAuthRequest): Promise<ClientSecretAuthResponse> {
  try {
    const response = await elympicsClient.put<ClientSecretAuthResponse>("/auth/user/clientSecretAuth", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error) {
    handleAxiosError(error, "Error authenticating user via client secret");
  }
}

/**
 * 5) Retrieve the Master API token, cached in Redis for 10 minutes
 */
const getMasterApiBearerToken = async (): Promise<string> => {
  // Attempt to retrieve the entire auth object from Redis
  let authData = await redisTools.getCache(redisTools.cacheKeys.elympicsMasterJwt);

  if (!authData) {
    // No cached token => fetch a new one
    const clientSecret = configProtected.ELYMPIC_API_KEY || "";
    const res = await authenticateUserViaClientSecret({ ClientSecret: clientSecret });

    // Store the entire response in Redis with a 10-minute TTL
    authData = { ...res };
    await redisTools.setCache(redisTools.cacheKeys.elympicsMasterJwt, authData, redisTools.cacheLvl.short);
  }

  // authData is { jwtToken, userId, nickname }
  return authData.jwtToken;
};

/**
 * 6) Get Tournament Details, automatically uses the cached Master Bearer token
 *    GET /tournament/tournament?tournamentId=xxx
 */
export const getTournamentDetails = async (tournamentId: string): Promise<TournamentDetailsResponse> => {
  return fetchWithAuth<TournamentDetailsResponse>(async (token) => {
    try {
      const url = `/tournament/tournament?tournamentId=${encodeURIComponent(tournamentId)}`;
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const response = await elympicsClient.get<TournamentDetailsResponse>(url, {
        headers: headers,
      });
      return response.data;
    } catch (error) {
      handleAxiosError(error, "Error fetching tournament details");
    }
  });
};

/**
 * 7) Fetch the Elympics leaderboard for a given (gameId, tournamentId)
 *    using Elympics' native pagination (pageSize & pageNumber).
 *    Caches the result for 1 minute in Redis.
 */
export async function getTournamentLeaderboard(
  gameId: string | null,
  tournamentId: string,
  pageSize: number,
  pageNumber: number
): Promise<LeaderboardResponse> {
  // 1) Construct a unique cache key
  const cacheKey = `${redisTools.cacheKeys.leaderboard}${gameId}:${tournamentId}:pageSize=${pageSize}:pageNumber=${pageNumber}`;

  // 2) Check if we have a cached response
  const cached = await redisTools.getCache(cacheKey);
  if (cached) {
    return cached as LeaderboardResponse;
  }

  // 3) Use fetchWithAuth to handle token (and potential refresh)
  const data = await fetchWithAuth<LeaderboardResponse>(async (token) => {
    try {
      // Build URL
      const gameIdParam = gameId ? `&GameId=${encodeURIComponent(gameId)}` : "";
      const url =
        `/leaderboardservice/leaderboard?TournamentId=${encodeURIComponent(tournamentId)}` +
        `${gameIdParam}&pageSize=${pageSize}&pageNumber=${pageNumber}`;

      // Make the request
      const response = await elympicsClient.get<LeaderboardResponse>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log(
        "Elympics leaderboard response for url",
        url,
        " with auth token:",
        token,
        " => ",
        response.data.data.length,
        " entries"
      );
      return response.data;
    } catch (error) {
      handleAxiosError(error, "Error fetching leaderboard");
    }
  });

  // 4) Cache the result for 1 minute
  await redisTools.setCache(cacheKey, data, 60);

  // 5) Return the data
  return data;
}
