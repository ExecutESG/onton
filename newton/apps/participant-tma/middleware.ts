import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getEventDataOnly } from "./services/event.services.ssr";

export async function middleware(req: NextRequest) {
  try {
    const tgAppStartParam = req.nextUrl.searchParams.get("tgWebAppStartParam");

    const userToken = req.cookies.get("token");
    console.log("tgAppStartParam", tgAppStartParam);
    const utm_source = req.nextUrl.searchParams.get("utm_source");

    if (tgAppStartParam) {
      const isEdit = tgAppStartParam.startsWith("edit_");
      const isAffiliate = tgAppStartParam.includes("-affiliate-");
      const isOrganizerProfile = tgAppStartParam.startsWith("channels_");
      const isTournament = tgAppStartParam.startsWith("tournaments_");
      const isTab = tgAppStartParam.startsWith("tab_");
      const isCampaign = tgAppStartParam.startsWith("campaign");
      const isOntonJoinAffiliate = tgAppStartParam.startsWith("join-");

      if (isOrganizerProfile) {
        console.log("redirecting to organizer profile");
        return NextResponse.redirect(new URL(`/channels/${tgAppStartParam.replace("channels_", "")}`, req.nextUrl.origin));
      }

      if (tgAppStartParam && tgAppStartParam.includes("-merch-raffle-")) {
        const [eventUuid, raffleUuid] = tgAppStartParam.split("-merch-raffle-");
        if (eventUuid && raffleUuid) {
          return NextResponse.redirect(new URL(`/events/${eventUuid}/merch-raffle/${raffleUuid}`, req.nextUrl.origin));
        }
        // fallthrough → malformed, continue with other rules
      }
      if (tgAppStartParam && tgAppStartParam.includes("-raffle-")) {
        const [eventUuid, raffleUuid] = tgAppStartParam.split("-raffle-");
        if (eventUuid && raffleUuid) {
          return NextResponse.redirect(new URL(`/events/${eventUuid}/raffle-ui/${raffleUuid}`, req.nextUrl.origin));
        }
        // fallthrough → malformed, continue with other rules
      }

      if (isTab) {
        const tab = tgAppStartParam.replace("tab_", "");
        switch (tab) {
          case "play":
            return NextResponse.redirect(new URL(`/play-2-win`, req.nextUrl.origin));
          case "my":
            return NextResponse.redirect(new URL(`/my`, req.nextUrl.origin));
          case "channels":
            return NextResponse.redirect(new URL(`/channels`, req.nextUrl.origin));
          case "campaign":
            return NextResponse.redirect(new URL(`/genesis-onions/`, req.nextUrl.origin));
          case "onion-snapshot":
            return NextResponse.redirect(new URL(`/onion-snapshot/`, req.nextUrl.origin));
          case "snapshot_claim":
            return NextResponse.redirect(new URL(`/onion-snapshot/claim-points`, req.nextUrl.origin));
          case "launch_partner":
            return NextResponse.redirect(new URL(`/my/partner/onion-affiliate`, req.nextUrl.origin));
          case "quest":
            return NextResponse.redirect(new URL(`/my/quest/`, req.nextUrl.origin));
          case "sample":
            return NextResponse.redirect(new URL(`/sample/`, req.nextUrl.origin));
          case "task_sample":
            return NextResponse.redirect(new URL(`/task-sample/`, req.nextUrl.origin));
          case "claim_sample":
            return NextResponse.redirect(new URL(`/claim-sample/`, req.nextUrl.origin));

          default:
            return NextResponse.redirect(new URL(`/`, req.nextUrl.origin));
        }
      }

      if (isTournament) {
        console.log("redirecting to tournament");
        return NextResponse.redirect(
          new URL(`/play-2-win/${tgAppStartParam.replace("tournaments_", "")}`, req.nextUrl.origin)
        );
      }
      if (isCampaign) {
        const splitAffiliate = tgAppStartParam.split("-aff-");
        const affiliateId = splitAffiliate[1] ?? "";
        console.log("redirecting to affiliate", splitAffiliate);
        const url = new URL(`/genesis-onions/`, req.nextUrl.origin);
        url.searchParams.set("is_affiliate", "1");
        url.searchParams.set("affiliate", affiliateId);
        console.log("redirecting to affiliate", url.searchParams);

        return NextResponse.redirect(url);
      }
      if (isOntonJoinAffiliate) {
        const url = new URL(`/`, req.nextUrl.origin);
        return NextResponse.redirect(url);
      }
      if (isEdit) {
        const eventId = tgAppStartParam.replace("edit_", "");
        console.log("redirecting to edit event", eventId);
        return NextResponse.redirect(new URL(`/events/${eventId}/manage`, req.nextUrl.origin));
      }

      if (isAffiliate) {
        const splitAffiliate = tgAppStartParam.split("-affiliate-");
        const affiliateId = splitAffiliate[1] ?? "";
        console.log("redirecting to affiliate", splitAffiliate);
        const url = new URL(`/ptma/event/${splitAffiliate[0]}`, req.nextUrl.origin);
        url.searchParams.set("is_affiliate", "1");
        url.searchParams.set("affiliate_id", affiliateId);
        console.log("redirecting to affiliate", url.searchParams);

        return NextResponse.redirect(url);
      }

      const event = await getEventDataOnly(tgAppStartParam, null);
      const ptam_utm_link = utm_source ? `&utm_source=${utm_source}` : "";

      if (event?.ticketToCheckIn) {
        console.log("Redirecting to ptma", tgAppStartParam);
        const redirectUrl =
          `/ptma/event/${tgAppStartParam}?not_authenticated=${userToken ? "false" : "true"}` + ptam_utm_link;

        return NextResponse.redirect(new URL(redirectUrl, req.nextUrl.origin));
      }
      const utm_link = utm_source ? `?utm_source=${utm_source}` : "";
      return NextResponse.redirect(new URL(`/events/${tgAppStartParam}` + utm_link, req.nextUrl.origin));
    }
    console.log("no tgAppStartParam");
    // If no redirection occurs, fall through gracefully.
    return NextResponse.next();
  } catch (error) {
    console.error("Error in middleware:", error);
    return NextResponse.next();
  }
}
