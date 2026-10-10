import { organizerLimitsService } from "@/services/organizerLimits";
import { verifyBotHmac } from "@/server/botHmacAuth";
import { NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const overrideSchema = z.object({
  eventsPerDay: z.number().int().min(0).optional(),
  maxUpcoming: z.number().int().min(0).nullable().optional(),
  maxCapacity: z.number().int().min(1).nullable().optional(),
}).strict();

export async function GET(req: NextRequest, { params }: { params: { user_id: string } }) {
  const authError = await verifyBotHmac(req);
  if (authError) return authError;

  const userId = parseInt(params.user_id, 10);
  if (isNaN(userId)) {
    return Response.json({ message: "Invalid user ID" }, { status: 400 });
  }

  const summary = await organizerLimitsService.getOrganizerLimitsSummary(userId);
  if (!summary) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  return Response.json({
    user_id: summary.userId,
    role: summary.role,
    tier: summary.tier,
    accountAgeDays: summary.accountAgeDays,
    hasPastCheckIns: summary.hasPastCheckIns,
    override: summary.override,
    effectiveLimits: {
      eventsPerDay: summary.effectiveLimits.eventsPerDay,
      maxUpcoming: summary.effectiveLimits.maxUpcoming,
      maxCapacity: summary.effectiveLimits.maxCapacity,
    },
    isAdmin: summary.isAdmin,
    eventsCreatedLast24Hours: summary.eventsCreatedLast24Hours,
    upcomingEventsCount: summary.upcomingEventsCount,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { user_id: string } }) {
  const authError = await verifyBotHmac(req);
  if (authError) return authError;

  const userId = parseInt(params.user_id, 10);

  if (isNaN(userId)) {
    return Response.json({ message: "Invalid user ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    let limitsOverride = body?.limits_override;

    if (limitsOverride !== null && limitsOverride !== undefined) {
      const parsed = overrideSchema.safeParse(limitsOverride);
      if (!parsed.success) {
        return Response.json({ message: "Invalid limits_override format", details: parsed.error }, { status: 400 });
      }
      limitsOverride = parsed.data;
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
      user_id: updatedSummary!.userId,
      limits_override: limitsOverride,
      summary: {
        user_id: updatedSummary!.userId,
        role: updatedSummary!.role,
        tier: updatedSummary!.tier,
        accountAgeDays: updatedSummary!.accountAgeDays,
        hasPastCheckIns: updatedSummary!.hasPastCheckIns,
        override: updatedSummary!.override,
        effectiveLimits: {
          eventsPerDay: updatedSummary!.effectiveLimits.eventsPerDay,
          maxUpcoming: updatedSummary!.effectiveLimits.maxUpcoming,
          maxCapacity: updatedSummary!.effectiveLimits.maxCapacity,
        },
        isAdmin: updatedSummary!.isAdmin,
        eventsCreatedLast24Hours: updatedSummary!.eventsCreatedLast24Hours,
        upcomingEventsCount: updatedSummary!.upcomingEventsCount,
      }
    });
  } catch (error) {
    return Response.json({ message: "Invalid JSON payload" }, { status: 400 });
  }
}
