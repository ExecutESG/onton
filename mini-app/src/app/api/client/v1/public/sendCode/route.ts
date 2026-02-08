import { z } from "zod";
import { NextResponse } from "next/server";
import tgService from "@/services/telegramService";
import { redisTools } from "@/lib/redisTools";
import { selectUserByUsername } from "@/db/modules/users.db";

// Define error codes for consistent error responses
const ERROR_CODES = {
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    message: "Invalid input parameters.",
  },
  OTP_SEND_FAILED: {
    code: "OTP_SEND_FAILED",
    message: "Failed to send OTP via Telegram.",
  },
  OTP_CACHE_FAILED: {
    code: "OTP_CACHE_FAILED",
    message: "Error saving OTP to cache.",
  },
  UNKNOWN_ERROR: {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred.",
  },
  TELEGRAM_ID_NOT_FOUND: {
    code: "TELEGRAM_ID_NOT_FOUND",
    message: "Telegram ID not found.",
  },
};

// Define success codes
const SUCCESS_CODES = {
  OTP_SENT: {
    code: "OTP_SENT",
    message: "OTP successfully sent to the organizer.",
  },
  MESSAGE_SENT: {
    code: "MESSAGE_SENT",
    message: "Message successfully sent to the user.",
  },
};

/**
 * @swagger
 * /sendCode:
 *   post:
 *     summary: Send OTP via Telegram to organizer and inform the user
 *     description: Sends an OTP to the organizer's Telegram handle and informs the user to request the OTP from the organizer.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizerId:
 *                 type: string
 *                 description: The Telegram handle of the organizer (including the @ symbol).
 *                 example: "@OrganizerUsername"
 *               userId:
 *                 type: string
 *                 description: The Telegram handle of the user (including the @ symbol).
 *                 example: "@UserUsername"
 *     responses:
 *       200:
 *         description: OTP successfully sent to the organizer and message sent to the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Whether the OTP was successfully sent to the organizer and message sent to the user.
 *                   example: true
 *                 code:
 *                   type: string
 *                   description: Success code.
 *                   example: "OTP_SENT"
 *                 message:
 *                   type: string
 *                   description: Success message.
 *                   example: "OTP has been sent to the organizer (@OrganizerUsername)."
 *       400:
 *         description: Validation error for invalid input.
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
 *                       example: "VALIDATION_FAILED"
 *                     message:
 *                       type: string
 *                       description: Error message.
 *                       example: "Invalid input parameters."
 *       500:
 *         description: Server error while sending OTP or saving OTP to cache.
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
 *                       example: "OTP_SEND_FAILED"
 *                     message:
 *                       type: string
 *                       description: Error message.
 *                       example: "Failed to send OTP via Telegram."
 *                     details:
 *                       type: string
 *                       description: Detailed error information, if available.
 *                       example: "An unknown error occurred while sending OTP."
 */
export async function POST(req: Request) {
  /* ----------------------------- OUT OF SERVICE ----------------------------- */
  return NextResponse.json({
    success: false,
    error: "out_of_service",
  });

  // try {
  //   const body = await req.json();
  //   const schema = z.object({
  //     organizerId: z
  //       .string()
  //       .min(2)
  //       .regex(
  //         /^@[a-zA-Z0-9_]{5,}$/,
  //         "Invalid organizer Telegram username format"
  //       ),
  //     userId: z
  //       .string()
  //       .min(2)
  //       .regex(/^@[a-zA-Z0-9_]{5,}$/, "Invalid user Telegram username format"),
  //   });

  //   const parsed = schema.safeParse(body);

  //   // Return validation errors if parsing fails
  //   if (!parsed.success) {
  //     return NextResponse.json(
  //       {
  //         success: false,
  //         error: ERROR_CODES.VALIDATION_FAILED,
  //         details: parsed.error.errors.map((err) => ({
  //           path: err.path,
  //           message: err.message,
  //         })),
  //       },
  //       { status: 400 }
  //     );
  //   }

  //   const { organizerId, userId } = parsed.data;

  //   // Generate OTP code
  //   const code = Math.floor(10000 + Math.random() * 90000).toString();

  //   // Fetch organizer and user details
  //   const organizer = await selectUserByUsername(organizerId.replace("@", ""));
  //   const user = await selectUserByUsername(userId.replace("@", ""));

  //   if (!organizer || !user) {
  //     return NextResponse.json(
  //       { success: false, error: ERROR_CODES.TELEGRAM_ID_NOT_FOUND },
  //       { status: 404 }
  //     );
  //   }

  //   // Send OTP to the organizer with information about the user requesting the OTP
  //   try {
  //     const messageToOrganizer = `Your OTP code is: ${code}. User @${userId} is requesting access to the event. Please provide the OTP to the user.`;
  //     const sendCodeResponse = await tgService.sendTelegramMessageNoLink(
  //       organizer.user_id,
  //       messageToOrganizer
  //     );

  //     if (!sendCodeResponse.success) {
  //       return NextResponse.json(
  //         { success: false, error: ERROR_CODES.OTP_SEND_FAILED },
  //         { status: 500 }
  //       );
  //     }
  //   } catch (err) {
  //     return NextResponse.json(
  //       {
  //         success: false,
  //         error: ERROR_CODES.OTP_SEND_FAILED,
  //         details:
  //           err instanceof Error ? err.message : "An unknown error occurred",
  //       },
  //       { status: 500 }
  //     );
  //   }

  //   // Send message to the user about requesting OTP from the organizer
  //   try {
  //     const messageToUser = `Your login code has been sent to the organizer of the event. Please ask the organizer (@${organizerId}) for the code to log in.`;
  //     await tgService.sendTelegramMessageNoLink(user.user_id, messageToUser);
  //   } catch (err) {
  //     return NextResponse.json(
  //       {
  //         success: false,
  //         error: "USER_MESSAGE_FAILED",
  //         message: "Failed to send message to the user",
  //         details:
  //           err instanceof Error ? err.message : "An unknown error occurred",
  //       },
  //       { status: 500 }
  //     );
  //   }

  //   // Cache the OTP in Redis, associating it with the organizer and user
  //   try {
  //     await redisTools.setCache(
  //       `${redisTools.cacheKeys.authApiOtp}${organizerId}:${userId}`,
  //       code,
  //       redisTools.cacheLvl.authApiOtpTimeout // Set an expiration time for the OTP
  //     );
  //   } catch (err) {
  //     return NextResponse.json(
  //       {
  //         success: false,
  //         error: ERROR_CODES.OTP_CACHE_FAILED,
  //         details:
  //           err instanceof Error ? err.message : "An unknown error occurred",
  //       },
  //       { status: 500 }
  //     );
  //   }

  //   // Respond with success
  //   return NextResponse.json(
  //     {
  //       success: true,
  //       code: SUCCESS_CODES.OTP_SENT.code,
  //       message: `OTP has been sent to the organizer (@${organizerId}).`,
  //     },
  //     { status: 200 }
  //   );
  // } catch (error) {
  //   const errorMessage =
  //     error instanceof Error ? error.message : "An unknown error occurred";
  //   return NextResponse.json(
  //     {
  //       success: false,
  //       error: ERROR_CODES.UNKNOWN_ERROR,
  //       details: errorMessage,
  //     },
  //     { status: 500 }
  //   );
  // }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
