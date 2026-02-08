import { sendHttpRequest } from "@/lib/httpHelpers";
import { configProtected } from "@/server/config";
import { logger } from "@/server/utils/logger";

/*
to insert configs into the database, run the following SQL commands:
INSERT INTO "public"."onton_setting" ("env", "var", "value", "protected") VALUES ('development', 'TONFEST_API', '["https://api-public-test.ton-fest.com/"," api key "]', 't');
INSERT INTO "public"."onton_setting" ("env", "var", "value", "protected") VALUES ('staging', 'TONFEST_API', '["https://api-public-test.ton-fest.com/"," api key "]', 't');
INSERT INTO "public"."onton_setting" ("env", "var", "value", "protected") VALUES ('local', 'TONFEST_API', '["https://api-public-test.ton-fest.com/"," api key ]', 't');
INSERT INTO "public"."onton_setting" ("env", "var", "value", "protected") VALUES ('production', 'TONFEST_API', '["https://api.ton-fest.com/"," api key ]', 't');
 */

export const addUserTicketFromOnton = async (payload: any): Promise<{ success: boolean; data: any }> => {
  const BaseUrl = configProtected?.TONFEST_API?.[0] || "";
  const Authorization = configProtected?.TONFEST_API?.[1] || "";
  const endpoint = BaseUrl + "external-partners/onton/addUserTicketFromOnton";
  logger.log(`Calling TonFest endpoint: ${endpoint}`);
  // Construct headers, method, etc. right here
  const headers = {
    "Content-Type": "application/json",
  };

  try {
    const finalPayload = {
      ...payload,
      authorization: Authorization,
    };
    logger.log(`Calling TonFest endpoint: ${endpoint}` + ` with payload: ${JSON.stringify(finalPayload)}`);
    const { success, data } = await sendHttpRequest("POST", endpoint, headers, finalPayload);
    if (!data.success) {
      logger.error("Failed to add user ticket from Onton:", data);
      return { success: false, data: { error: data.error } };
    }
    return { success, data };
  } catch (err: any) {
    return { success: false, data: { error: err.message } };
  }
};

/**
 * function for adding SBT from Onton.
 * Usage: calls the endpoint /external-partners/onton/addSbtFromOnton
 * with { authorization: "...", userTelegramId: "..." }
 */
export const addSbtFromOnton = async (payload: any): Promise<{ success: boolean; data: any }> => {
  const BaseUrl = configProtected?.TONFEST_API?.[0] || "";
  const Authorization = configProtected?.TONFEST_API?.[1] || "";
  const endpoint = BaseUrl + "external-partners/onton/addSbtFromOnton";
  logger.log(`Calling TonFest endpoint: ${endpoint}`);

  const headers = { "Content-Type": "application/json" };

  try {
    // Similar to above, merge the auth token into payload
    const finalPayload = {
      ...payload,
      authorization: Authorization,
    };
    logger.log(`Calling TonFest endpoint: ${endpoint}` + ` with payload: ${JSON.stringify(finalPayload)}`);
    const { success, data } = await sendHttpRequest("POST", endpoint, headers, finalPayload);

    // If the TonFest API returns { success: false }, treat it as a failure
    if (!data.success) {
      console.error("Failed to add SBT from Onton:", data);
      return { success: false, data: { error: data.error } };
    }
    return { success, data };
  } catch (err: any) {
    return { success: false, data: { error: err.message } };
  }
};

/**
 * Function for setting SBT to a "pending" status from Onton.
 * Usage: calls the endpoint /setSbtPending with { authorization: "...", userTelegramId: "..." }.
 */
export const setSbtPending = async (payload: any): Promise<{ success: boolean; data: any }> => {
  const BaseUrl = configProtected?.TONFEST_API?.[0] || "";
  const Authorization = configProtected?.TONFEST_API?.[1] || "";
  const endpoint = BaseUrl + "external-partners/onton/setSbtPending";
  logger.log(`Calling TonFest endpoint: ${endpoint}`);

  const headers = { "Content-Type": "application/json" };

  try {
    // Merge the auth token into the payload
    const finalPayload = {
      ...payload,
      authorization: Authorization,
    };
    logger.log(`Calling TonFest endpoint: ${endpoint}` + ` with payload: ${JSON.stringify(finalPayload)}`);
    const { success, data } = await sendHttpRequest("POST", endpoint, headers, finalPayload);

    // If the TonFest API returns { success: false }, treat it as a failure
    if (!data.success) {
      logger.error("Failed to set SBT pending in Onton:", data);
      return { success: false, data: { error: data.error } };
    }

    return { success, data };
  } catch (err: any) {
    logger.error("Error setting SBT pending in Onton:", err);
    return { success: false, data: { error: err.message } };
  }
};
