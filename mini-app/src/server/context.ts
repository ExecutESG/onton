import { validateMiniAppData } from "@/utils";
import { usersDB } from "@/db/modules/users.db";
import { logger } from "@/server/utils/logger";
import { TRPCError } from "@trpc/server";
import { cookies } from "next/headers";

export async function createContext({ req }: { req: Request }) {
  // get user from init data passed as authorization header
  async function getUserFromHeader() {
    const authHeader = req.headers.get("Authorization");

    if (authHeader) {
      const initData = authHeader;

      if (!initData) {
        return null;
      }

      const { valid, initDataJson } = validateMiniAppData(initData);
      if (!valid) {
        logger.info("Invalid init data", { initData });
        return null;
      }

      let joinAffiliateHash = undefined;
      if (typeof initDataJson?.start_param === "string" && initDataJson?.start_param.startsWith("join-")) {
        const startParam = initDataJson.start_param.split("-");
        joinAffiliateHash = startParam[1];
      }

      const user = await usersDB.insertUser(initDataJson, joinAffiliateHash);
      if (!user) {
        logger.info("User not found", { initDataJson });
        return null;
      }

      if (user.role === "ban") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "user is banned",
        });
      }

      return user;
    }
    return null;
  }

  const user = await getUserFromHeader();

  return {
    req, // ← important!  (Fastify/Next Request – whatever you pass in)
    user,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createContext>>;
