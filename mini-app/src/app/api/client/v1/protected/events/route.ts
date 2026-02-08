import { z } from "zod";
import { NextResponse } from "next/server";
import { getOrganizerEvents } from "@/db/modules/events.db"; // Ensure the function is correctly imported
import { validateJwtFromRequest } from "@/app/api/client/v1/authService";

// Zod schema for validating query parameters
const getEventsListSchema = z.object({
  limit: z.string().optional().nullable(), // Optional query param for limit (as string)
  offset: z.string().optional().nullable(), // Optional query param for offset (as string)
});

// Define error codes for consistent error handling
const ERROR_CODES = {
  ORGANIZER_NOT_FOUND: {
    code: "ORGANIZER_NOT_FOUND",
    message: "Organizer not found in JWT payload.",
  },
};

/**
 * @swagger
 * /organizer/events:
 *   get:
 *     summary: Fetch the list of events for an organizer (JWT protected)
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         required: false
 *         description: Limit the number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *         required: false
 *         description: Pagination offset
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: A list of events
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 */
export async function GET(request: Request) {
  /* ----------------------------- OUT OF SERVICE ----------------------------- */
  return NextResponse.json({
    success: false,
    error: "out_of_service",
  });
  // // Validate JWT token from the request
  // const jwtValidation = await validateJwtFromRequest(request);

  // if (!jwtValidation.success) {
  //   return jwtValidation.response; // Return the JWT error response if token is invalid
  // }

  // // Check if the organizerId exists, otherwise return an error
  // const { organizerId } = jwtValidation.payload || {};
  // if (!organizerId) {
  //   return NextResponse.json(
  //     {
  //       success: false,
  //       error: ERROR_CODES.ORGANIZER_NOT_FOUND,
  //     },
  //     { status: 400 }
  //   );
  // }

  // // Parse query parameters from the request URL
  // const url = new URL(request.url);
  // const limitParam = url.searchParams.get("limit");
  // const offsetParam = url.searchParams.get("offset");

  // // Validate the query parameters using Zod
  // const parsed = getEventsListSchema.safeParse({
  //   limit: limitParam,
  //   offset: offsetParam,
  // });

  // if (!parsed.success) {
  //   // Return validation errors with status 400
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

  // // Safely parse limit and offset to numbers if provided
  // const limit = parsed.data.limit ? parseInt(parsed.data.limit, 10) : undefined;
  // const offset = parsed.data.offset
  //   ? parseInt(parsed.data.offset, 10)
  //   : undefined;

  // try {
  //   // Fetch organizer's events from the database using the organizerId, limit, and offset
  //   const events = await getOrganizerEvents(organizerId, limit, offset);

  //   // Return the list of events as the response
  //   return NextResponse.json(events, { status: 200 });
  // } catch (error: unknown) {
  //   const errorMessage =
  //     error instanceof Error ? error.message : "An unknown error occurred";
  //   return NextResponse.json({ error: errorMessage }, { status: 500 });
  // }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
