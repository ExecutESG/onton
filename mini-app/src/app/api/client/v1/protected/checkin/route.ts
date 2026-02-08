import { z } from "zod";
import { NextResponse } from "next/server";
import ticketDB from "@/db/modules/ticket.db";
import rewardsService from "@/services/rewardsService";
import { validateJwtFromRequest } from "@/app/api/client/v1/authService";
import { selectUserById } from "@/db/modules/users.db";

// Zod schema to validate the request body
const checkInTicketSchema = z.object({
  order_uuid: z.string(),
});

// Define error codes for consistent error responses
const ERROR_CODES = {
  TICKET_NOT_FOUND: { code: "TICKET_NOT_FOUND", message: "Ticket not found." },
  TICKET_ALREADY_CHECKED_IN: {
    code: "TICKET_ALREADY_CHECKED_IN",
    message: "Ticket has already been checked in.",
  },
  TICKET_UPDATE_FAILED: {
    code: "TICKET_UPDATE_FAILED",
    message: "Failed to update ticket status.",
  },
  UNKNOWN_ERROR: {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred.",
  },
  REWARD_CREATION_FAILED: {
    code: "REWARD_CREATION_FAILED",
    message: "Failed to create reward for the user.",
  },
  JWT_INVALID: {
    code: "JWT_INVALID",
    message: "Invalid or missing JWT token.",
  },
};

// Type guard to check if result is alreadyCheckedIn type
function isAlreadyCheckedIn(result: any): result is { alreadyCheckedIn: boolean } {
  return result && "alreadyCheckedIn" in result;
}

/**
 * @swagger
 * /checkin:
 *   post:
 *     summary: Check in a ticket for an event (JWT protected)
 *     description: Checks in a ticket for an event using the order UUID. If the user is successfully checked in, it returns the check-in status, user information, and embeds the reward creation result in `rewardResult`. Requires a valid JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order_uuid:
 *                 type: string
 *                 description: The UUID of the ticket order to check in.
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket checked in successfully and returns user information and reward creation status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Whether the check-in was successful.
 *                   example: true
 *                 state:
 *                   type: string
 *                   description: The current state of the ticket after the check-in process.
 *                   example: "CHECKED_IN" or "USED"
 *                 result:
 *                   type: object
 *                   description: The result of the check-in process, containing details of the ticket.
 *                 userInfo:
 *                   type: object
 *                   description: User information related to the ticket.
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User ID.
 *                     name:
 *                       type: string
 *                       description: Name of the user.
 *                     email:
 *                       type: string
 *                       description: Email of the user.
 *                 rewardResult:
 *                   type: object
 *                   description: The result of the reward creation process.
 *       401:
 *         description: Unauthorized (Invalid or missing JWT token)
 *       400:
 *         description: Invalid request body or missing parameters.
 *       404:
 *         description: Ticket not found.
 *       500:
 *         description: Internal server error.
 */
export async function POST(req: Request) {
  /* ----------------------------- OUT OF SERVICE ----------------------------- */
  return NextResponse.json({
    success: false,
    error: "out_of_service",
  });
  // // First, validate the JWT token
  // const jwtValidation = await validateJwtFromRequest(req);
  // if (!jwtValidation.success) {
  //   return jwtValidation.response; // Return the JWT error response if invalid
  // }

  // // Parse and validate the request body
  // const body = await req.json();
  // const parsed = checkInTicketSchema.safeParse(body);

  // if (!parsed.success) {
  //   return NextResponse.json(
  //     {
  //       error: parsed.error.errors.map((err) => ({
  //         path: err.path,
  //         message: err.message,
  //       })),
  //     },
  //     { status: 400 }
  //   );
  // }

  // const { order_uuid } = parsed.data;

  // try {
  //   // Check in the ticket
  //   const result = await ticketDB.checkInTicket(order_uuid);

  //   if (!result) {
  //     return NextResponse.json(
  //       {
  //         success: false,
  //         error: ERROR_CODES.TICKET_UPDATE_FAILED,
  //       },
  //       { status: 500 }
  //     );
  //   }
  //   const ticketInfo = await ticketDB.getTicketByUuid(order_uuid);

  //   if (!ticketInfo?.user_id) {
  //     return NextResponse.json(
  //       {
  //         success: false,
  //         error: ERROR_CODES.TICKET_NOT_FOUND,
  //       },
  //       { status: 404 }
  //     );
  //   }
  //   const userInfo = await selectUserById(ticketInfo.user_id);
  //   // If already checked in, return result with no reward processing
  //   if (isAlreadyCheckedIn(result)) {
  //     return NextResponse.json(
  //       {
  //         success: true,
  //         state: "USED",
  //         result: result,
  //         ticketInfo: ticketInfo,
  //         userInfo: userInfo,
  //         rewardResult: null, // No reward processing
  //       },
  //       { status: 200 }
  //     );
  //   }

  //   // Proceed with reward creation after a successful check-in
  //   const ticketData = await ticketDB.getTicketByUuid(order_uuid);
  //   let rewardResult = null;
  //   if (ticketData?.user_id && ticketData?.event_uuid) {
  //     try {
  //       const rewardCreation = await rewardsService.createUserRewardSBT({
  //         user_id: ticketData.user_id,
  //         event_uuid: ticketData.event_uuid,
  //         ticketOrderUuid: order_uuid,
  //       });
  //       // Capture reward result in case of success or failure
  //       if (rewardCreation.success) {
  //         rewardResult = { success: true, rewardResult: rewardCreation };
  //       } else {
  //         rewardResult = {
  //           success: false,
  //           error: ERROR_CODES.REWARD_CREATION_FAILED,
  //           rewardResult: rewardCreation,
  //         };
  //       }
  //     } catch (rewardError: unknown) {
  //       rewardResult = {
  //         success: false,
  //         error: ERROR_CODES.UNKNOWN_ERROR,
  //         details: (rewardError as Error).message,
  //       };
  //     }
  //   }
  //   const dealRoomResult = await dealRoomService.RefreshGuestList("2742f5902ad54152a969f5dac15d716d");
  //   // Return both check-in result and reward result in the response
  //   return NextResponse.json(
  //     {
  //       success: true,
  //       state: "CHECKED_IN",
  //       result: result,
  //       dealRoomResult: dealRoomResult,
  //       ticketInfo: ticketInfo,
  //       userInfo: userInfo,
  //       rewardResult: rewardResult || {
  //         success: false,
  //         error: ERROR_CODES.REWARD_CREATION_FAILED,
  //       },
  //     },
  //     { status: 200 }
  //   );
  // } catch (error: unknown) {
  //   const errorMessage =
  //     error instanceof Error ? error.message : "An unknown error occurred";
  //   return NextResponse.json(
  //     { error: ERROR_CODES.UNKNOWN_ERROR, details: errorMessage },
  //     { status: 500 }
  //   );
  // }
}

// Export dynamic flag
export const dynamic = "force-dynamic";
