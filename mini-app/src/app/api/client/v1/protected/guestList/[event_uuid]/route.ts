import { z } from "zod";
import { NextResponse } from "next/server";
import { selectVisitorsByEventUuid } from "@/db/modules/visitors.db";
import { validateJwtFromRequest } from "@/app/api/client/v1/authService";

// Zod schema for validating the path and query parameters
const getGuestListSchema = z.object({
  event_uuid: z.string(),
  limit: z.string().optional().nullable(), // Optional query param for limit
  cursor: z.string().optional().nullable(), // Optional query param for cursor
  search: z.string().optional().nullable(), // Optional query param for search
});

/**
 * @swagger
 * /guestList/{event_uuid}:
 *   get:
 *     summary: Fetch the guest list for an event (JWT protected)
 *     parameters:
 *       - in: path
 *         name: event_uuid
 *         schema:
 *           type: string
 *         required: true
 *         description: Event UUID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         required: false
 *         description: Limit the number of results
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: number
 *         required: false
 *         description: Pagination cursor
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search term to filter guests
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: A list of guests
 *       401:
 *         description: Unauthorized (Invalid or missing JWT)
 */
export async function GET(request: Request, { params }: { params: { event_uuid: string } }) {
  /* ----------------------------- OUT OF SERVICE ----------------------------- */
  return NextResponse.json({
    success: false,
    error: "out_of_service",
  });
  // // First, validate the JWT token
  // const jwtValidation = await validateJwtFromRequest(request);

  // if (!jwtValidation.success) {
  //   return jwtValidation.response; // Return the JWT error response
  // }

  // const { event_uuid } = params;

  // // Parse the query parameters
  // const url = new URL(request.url);
  // const limit = url.searchParams.get("limit");
  // const cursor = url.searchParams.get("cursor");
  // const search = url.searchParams.get("search");

  // // Validate the event_uuid and optional query params
  // const parsed = getGuestListSchema.safeParse({
  //   event_uuid,
  //   limit: limit || undefined,
  //   cursor: cursor || undefined,
  //   search: search || undefined,
  // });

  // if (!parsed.success) {
  //   // Return validation errors with status 400
  //   return NextResponse.json(
  //     {
  //       error: parsed.error.errors.map((err) => ({
  //         path: err.path ,
  //         message: err.message ,
  //       })),
  //     },
  //     { status: 400 }
  //   );
  // }

  // try {
  //   // Fetch guest list from the database
  //   const data = await selectVisitorsByEventUuid(
  //     parsed.data.event_uuid,
  //     limit ? parseInt(limit, 10) : 10000,
  //     cursor ? parseInt(cursor, 10) : undefined,
  //     false, // Always set dynamic_fields to false
  //     search || undefined
  //   );
  //   return NextResponse.json(data, { status: 200 });
  // } catch (error: unknown) {
  //   const errorMessage =
  //     error instanceof Error ? error.message : "An unknown error occurred";
  //   return NextResponse.json({ error: errorMessage }, { status: 500 });
  // }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
