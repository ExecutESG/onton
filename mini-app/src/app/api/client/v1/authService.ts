import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { redisTools } from "@/lib/redisTools";
import { selectUserById, selectUserByUsername } from "@/db/modules/users.db"; // Assuming redisTools is available for Redis operations

const JWT_SECRET = process.env.CLIENT_API_JWT_SECRET!;

// Define error codes for JWT validation
const ERROR_CODES = {
  JWT_MISSING: { code: "JWT_MISSING", message: "Authorization token missing." },
  JWT_INVALID: { code: "JWT_INVALID", message: "Invalid or expired token." },
  JWT_VERIFICATION_FAILED: {
    code: "JWT_VERIFICATION_FAILED",
    message: "Token verification failed.",
  },
  JWT_BLACKLISTED: {
    code: "JWT_BLACKLISTED",
    message: "The token has been blacklisted and is no longer valid.",
  },
};

export async function validateJwtFromRequest(req: Request) {
  /* ----------------------------- OUT OF SERVICE ----------------------------- */
  return NextResponse.json({
    success: false,
    error: "out_of_service",
  });

  // const authorization = req.headers.get("Authorization");

  // if (!authorization) {
  //   return {
  //     success: false,
  //     error: {
  //       code: ERROR_CODES.JWT_MISSING.code,
  //       message: ERROR_CODES.JWT_MISSING.message,
  //     },
  //     response: NextResponse.json(
  //       {
  //         success: false,
  //         error: ERROR_CODES.JWT_MISSING,
  //       },
  //       { status: 401 }
  //     ),
  //   };
  // }

  // try {
  //   const token = authorization.split(" ")[1];

  //   // Check if the token is blacklisted
  //   const isBlacklisted = await redisTools.getCache(
  //     `${redisTools.cacheKeys.jwtBlacklist}${token}`
  //   );

  //   if (isBlacklisted) {
  //     return {
  //       success: false,
  //       error: {
  //         code: ERROR_CODES.JWT_BLACKLISTED.code,
  //         message: ERROR_CODES.JWT_BLACKLISTED.message,
  //       },
  //       response: NextResponse.json(
  //         {
  //           success: false,
  //           error: ERROR_CODES.JWT_BLACKLISTED,
  //         },
  //         { status: 401 }
  //       ),
  //     };
  //   }

  //   // Verify the JWT token and extract payload
  //   const payload = jwt.verify(token, JWT_SECRET);

  //   // Extract organizerId and userId from the payload

  //   const { organizerId, userId } = payload as {
  //     userId: number;
  //     organizerId: string;
  //   };

  //   const organizer = await selectUserByUsername( organizerId);

  //   const user = await selectUserById(userId);

  //   if (!organizer?.user_id || !user?.user_id) {
  //     return {
  //       success: false,
  //       error: {
  //         code: ERROR_CODES.JWT_INVALID.code,
  //         message: ERROR_CODES.JWT_INVALID.message,
  //       },
  //       response: NextResponse.json(
  //         {
  //           success: false,
  //           error: ERROR_CODES.JWT_INVALID,
  //         },
  //         { status: 401 }
  //       ),
  //     };
  //   }
  //   return {
  //     success: true,
  //     payload: {
  //       organizerTelegramId: organizer.username,
  //       organizerId: organizer.user_id,
  //       organizer,
  //       userTelegramId: user.username,
  //       userId: user.user_id,
  //       user,
  //     }, // Return organizerId and userId if token is valid
  //   };
  // } catch (err) {
  //   console.error("JWT validation error: ", err);
  //   return {
  //     success: false,
  //     error: {
  //       code: ERROR_CODES.JWT_INVALID.code,
  //       message: ERROR_CODES.JWT_INVALID.message,
  //     },
  //     response: NextResponse.json(
  //       {
  //         success: false,
  //         error: ERROR_CODES.JWT_INVALID,
  //       },
  //       { status: 401 }
  //     ),
  //   };
  // }
}
