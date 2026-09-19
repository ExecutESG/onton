import "@/lib/gracefullyShutdown";
import { getAuthenticatedUser, apiKeyAuthentication } from "@/server/auth";
import eventDB from "@/db/modules/events.db";
import { userRolesDB } from "@/db/modules/userRoles.db";
import { selectVisitorsByEventUuid } from "@/db/modules/visitors.db";

/**
 * Event Metadata and Guest List Export Endpoint
 * Resolves Issue #958: Requires organizer/admin authentication and validates event ownership.
 */
const handler = async (req: Request) => {
  const url = new URL(req.url);
  const searchParams = new URLSearchParams(url.search);

  const eventUuid =
    searchParams.get("event_uuid") ||
    searchParams.get("hash") ||
    searchParams.get("id");

  if (!eventUuid) {
    return Response.json(
      { error: "Missing required query parameter: event_uuid" },
      { status: 400 }
    );
  }

  // 1. Authenticate the caller
  const [authUserId, authError] = getAuthenticatedUser();
  const apiKeyError = apiKeyAuthentication(req);

  const isApiKeyValid = apiKeyError === null;
  const isUserAuthenticated = authUserId !== null && !authError;

  if (!isUserAuthenticated && !isApiKeyValid) {
    return Response.json(
      { error: "Unauthorized: authentication required to export event data" },
      { status: 401 }
    );
  }

  // 2. Fetch the event
  const event = await eventDB.selectEventByUuid(eventUuid);
  if (!event) {
    return Response.json(
      { error: `Event with uuid ${eventUuid} not found` },
      { status: 404 }
    );
  }

  // 3. Verify permissions (must be owner, co-organizer, or admin)
  if (!isApiKeyValid && authUserId) {
    const accessRoles = await userRolesDB.listActiveUserRolesForEvent(
      "event",
      Number(event.event_id)
    );
    const isOwner = authUserId === event.owner;
    const hasRole = accessRoles.some((r) => r.userId === authUserId);

    if (!isOwner && !hasRole) {
      return Response.json(
        { error: "Forbidden: organizer or administrative permissions required" },
        { status: 403 }
      );
    }
  }

  // 4. Retrieve attendees
  const format = searchParams.get("format");
  const visitorsResult = await selectVisitorsByEventUuid(eventUuid, -1, 0, false);
  const attendees = visitorsResult?.visitorsWithDynamicFields ?? [];

  if (format === "csv") {
    const headers = "user_id,username,first_name,last_name,created_at,has_ticket,ticket_status\n";
    const rows = attendees
      .map(
        (a: Record<string, unknown>) =>
          `"${a.user_id}","${a.username || ""}","${a.first_name || ""}","${a.last_name || ""}","${a.created_at || ""}","${a.has_ticket || false}","${a.ticket_status || ""}"`
      )
      .join("\n");

    return new Response(headers + rows, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="event_${eventUuid}_export.csv"`,
      },
    });
  }

  return Response.json({
    success: true,
    event_uuid: eventUuid,
    title: event.title,
    total_attendees: attendees.length,
    attendees,
  });
};

export { handler as GET, handler as POST };
export const dynamic = "force-dynamic";
