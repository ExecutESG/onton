import { organizerLimitsService } from "@/services/organizerLimits";
import { OrganizerLimitsOverride } from "@/db/schema/users";
import { apiKeyAuthentication } from "@/server/apiKeyAuth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { user_id: string } }) {
  const authError = apiKeyAuthentication(req);
  if (authError) return authError;

  const userId = parseInt(params.user_id, 10);
  if (isNaN(userId)) {
    return Response.json({ message: "Invalid user ID" }, { status: 400 });
  }

  const summary = await organizerLimitsService.getOrganizerLimitsSummary(userId);
  if (!summary) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  return Response.json(summary);
}

export async function PATCH(req: NextRequest, { params }: { params: { user_id: string } }) {
  const bodyText = await req.clone().text();
  const authError = apiKeyAuthentication(req, bodyText);
  if (authError) return authError;

  const userId = parseInt(params.user_id, 10);

  if (isNaN(userId)) {
    return Response.json({ message: "Invalid user ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const limitsOverride = body?.limits_override as OrganizerLimitsOverride | null | undefined;

    if (limitsOverride !== null && limitsOverride !== undefined && typeof limitsOverride !== "object") {
      return Response.json({ message: "Invalid limits_override format" }, { status: 400 });
    }

    const success = await organizerLimitsService.setOrganizerLimitsOverride(
      userId,
      limitsOverride === undefined ? null : limitsOverride
    );

    if (!success) {
      return Response.json({ message: "User not found" }, { status: 404 });
    }

    const updatedSummary = await organizerLimitsService.getOrganizerLimitsSummary(userId);
    return Response.json({
      success: true,
      user_id: userId,
      limits_override: limitsOverride,
      summary: updatedSummary,
    });
  } catch (error) {
    return Response.json({ message: "Invalid JSON payload" }, { status: 400 });
  }
}
