import { z } from "zod";
import { NextResponse } from "next/server";
import { redisTools } from "@/lib/redisTools";
import { usersDB } from "@/db/modules/users.db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.CLIENT_API_JWT_SECRET!;
const FIXED_API_KEY = process.env.CLIENT_API_FIXED_KEY!;
const FIXED_USER = process.env.CLIENT_API_FIXED_USER!;
const FIXED_ORGANIZER = process.env.CLIENT_API_FIXED_ORGANIZER!;

// Define error codes for consistent error responses
const ERROR_CODES = {
  METHOD_NOT_ALLOWED: {
    code: "METHOD_NOT_ALLOWED",
    message: "Method not allowed.",
  },
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    message: "Invalid input parameters.",
  },
  OTP_INVALID: { code: "OTP_INVALID", message: "Invalid OTP." },
  USER_NOT_FOUND: { code: "USER_NOT_FOUND", message: "User not found." },
  OTP_DELETION_FAILED: {
    code: "OTP_DELETION_FAILED",
    message: "Error deleting OTP from cache.",
  },
  UNKNOWN_ERROR: {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred.",
  },
};

// Define success codes
const SUCCESS_CODES = {
  LOGIN_SUCCESS: {
    code: "LOGIN_SUCCESS",
    message: "Login successful. JWT generated.",
  },
};

// Zod schema for validating the request body (now using organizerId and userId)
const loginSchema = z.object({
  organizerId: z
    .string()
    .min(2)
    .regex(/^@[a-zA-Z0-9_]{5,}$/, "Invalid organizer Telegram username format"),
  userId: z
    .string()
    .min(2)
    .regex(/^@[a-zA-Z0-9_]{5,}$/, "Invalid user Telegram username format"),
  loginCode: z.string(),
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login using OTP and get JWT
 *     description: Authenticates the user using OTP and provides a JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizerId:
 *                 type: string
 *                 description: Organizer's Telegram username (with @).
 *                 example: "@OrganizerUsername"
 *               userId:
 *                 type: string
 *                 description: User's Telegram username (with @).
 *                 example: "@UserUsername"
 *               loginCode:
 *                 type: string
 *                 description: OTP code sent to Telegram.
 *     responses:
 *       200:
 *         description: JWT Token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Whether the login was successful.
 *                 token:
 *                   type: string
 *                   description: The generated JWT token.
 *                 code:
 *                   type: string
 *                   description: Success code.
 *                 message:
 *                   type: string
 *                   description: Success message.
 *       400:
 *         description: Validation error or user not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       description: Error code.
 *                     message:
 *                       type: string
 *                       description: Error message.
 *       500:
 *         description: Server error or OTP deletion failure.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       description: Error code.
 *                     message:
 *                       type: string
 *                       description: Error message.
 */
export async function POST(req: Request) {
  /* ----------------------------- OUT OF SERVICE ----------------------------- */
  return NextResponse.json({
    success: false,
    error: "out_of_service",
  });
  // if (req.method === "OPTIONS") {
  //     return NextResponse.json(null, { status: 204 }); // Handle preflight requests
  // }

  // if (req.method !== "POST") {
  //     return NextResponse.json(
  //         { success: false, error: ERROR_CODES.METHOD_NOT_ALLOWED },
  //         { status: 405 }
  //     );
  // }

  // try {
  //     const body = await req.json(); // Parse the request body
  //     const { organizerId, userId, loginCode, apiKey } = body;

  //     // Check if the fixed API key is provided
  //     if (apiKey === FIXED_API_KEY) {
  //         // Override organizerId and userId to "FIXED_USER" and "FIXED_ORGANIZER"
  //         const fixedOrganizerId = FIXED_USER;
  //         const fixedUserId = FIXED_ORGANIZER;

  //         // Fetch the user from the database using the fixed userId
  //         const user = await usersDB.selectUserByUsername(fixedUserId.replace("@", ""));
  //         if (!user) {
  //             return NextResponse.json(
  //                 { success: false, error: ERROR_CODES.USER_NOT_FOUND },
  //                 { status: 404 }
  //             );
  //         }

  //         // Generate JWT token for both fixed organizerId and userId
  //         const token = jwt.sign(
  //             { userId: user.user_id, organizerId: fixedOrganizerId },
  //             JWT_SECRET,
  //             { expiresIn: "3h" }
  //         );

  //         // Return the generated JWT token
  //         return NextResponse.json(
  //             {
  //                 success: true,
  //                 code: SUCCESS_CODES.LOGIN_SUCCESS.code,
  //                 message: SUCCESS_CODES.LOGIN_SUCCESS.message,
  //                 token,
  //             },
  //             { status: 200 }
  //         );
  //     }

  //     // If API key is not set, continue with normal validation
  //     const parsedBody = loginSchema.safeParse({ organizerId, userId, loginCode });
  //     if (!parsedBody.success) {
  //         return NextResponse.json(
  //             {
  //                 success: false,
  //                 error: ERROR_CODES.VALIDATION_FAILED,
  //                 details: parsedBody.error.errors.map((err) => ({
  //                     path: err.path,
  //                     message: err.message,
  //                 })),
  //             },
  //             { status: 400 }
  //         );
  //     }

  //     // Normal login process with OTP verification
  //     const cachedCode = await redisTools.getCache(
  //         `${redisTools.cacheKeys.authApiOtp}${organizerId}:${userId}`
  //     );

  //     if (!cachedCode || cachedCode !== loginCode) {
  //         return NextResponse.json(
  //             { success: false, error: ERROR_CODES.OTP_INVALID },
  //             { status: 401 }
  //         );
  //     }

  //     const user = await usersDB.selectUserByUsername(userId.replace("@", ""));
  //     if (!user) {
  //         return NextResponse.json(
  //             { success: false, error: ERROR_CODES.USER_NOT_FOUND },
  //             { status: 404 }
  //         );
  //     }

  //     // Generate JWT token
  //     const token = jwt.sign(
  //         { userId: user.user_id, organizerId },
  //         JWT_SECRET,
  //         { expiresIn: "3h" }
  //     );

  //     try {
  //         // Delete OTP from Redis
  //         await redisTools.deleteCache(
  //             `${redisTools.cacheKeys.authApiOtp}${organizerId}:${userId}`
  //         );
  //     } catch (err) {
  //         return NextResponse.json(
  //             {
  //                 success: false,
  //                 error: ERROR_CODES.OTP_DELETION_FAILED,
  //                 details: err instanceof Error ? err.message : "An unknown error occurred",
  //             },
  //             { status: 500 }
  //         );
  //     }

  //     return NextResponse.json(
  //         {
  //             success: true,
  //             code: SUCCESS_CODES.LOGIN_SUCCESS.code,
  //             message: SUCCESS_CODES.LOGIN_SUCCESS.message,
  //             token,
  //         },
  //         { status: 200 }
  //     );
  // } catch (error) {
  //     return NextResponse.json(
  //         {
  //             success: false,
  //             error: ERROR_CODES.UNKNOWN_ERROR,
  //             details: error instanceof Error ? error.message : "An unknown error occurred",
  //         },
  //         { status: 500 }
  //     );
  // }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
