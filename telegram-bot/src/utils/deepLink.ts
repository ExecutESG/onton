/**
 * Universal Deep Link Parser for ONTON Telegram Bot
 * Maps telegram /start parameters (from LinkService and TMA deep links)
 * to Mini App routes and CTA button text.
 * 
 * Resolves Issue #968 (Deep-link routing discarding prefixes).
 */

export interface DeepLinkResolution {
  targetUrl: string;
  buttonText: string;
}

export function resolveDeepLink(rawParam: string, baseUrl?: string): DeepLinkResolution | null {
  if (!rawParam || typeof rawParam !== "string") return null;

  const appBaseUrl = (baseUrl || process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL || "https://app.onton.live").replace(/\/$/, "");

  // 1. Events: event_<uuid> or event_<uuid>_ref_<ref>
  if (rawParam.startsWith("event_")) {
    const rest = rawParam.replace("event_", "");
    if (rest.includes("_ref_")) {
      const [eventUuid, ref] = rest.split("_ref_");
      return {
        targetUrl: `${appBaseUrl}/events/${eventUuid}?ref=${ref}`,
        buttonText: "Open Event",
      };
    }
    return {
      targetUrl: `${appBaseUrl}/events/${rest}`,
      buttonText: "Open Event",
    };
  }

  // 2. Raw UUID format: e.g. 4b287361-a06f-43dd-87c1-2d3a68f99fa7 or <uuid>_ref_<ref>
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  if (uuidRegex.test(rawParam)) {
    if (rawParam.includes("_ref_")) {
      const [eventUuid, ref] = rawParam.split("_ref_");
      return {
        targetUrl: `${appBaseUrl}/events/${eventUuid}?ref=${ref}`,
        buttonText: "Open Event",
      };
    }
    return {
      targetUrl: `${appBaseUrl}/events/${rawParam}`,
      buttonText: "Open Event",
    };
  }

  // 3. Ticket Pass: ticket_<uuid> or ticket-<uuid>
  if (rawParam.startsWith("ticket_") || rawParam.startsWith("ticket-")) {
    const eventUuid = rawParam.replace(/^ticket[_-]/, "");
    return {
      targetUrl: `${appBaseUrl}/tickets/${eventUuid}`,
      buttonText: "🎟 View Ticket",
    };
  }

  // 4. Channels: channels_<id> or channel_<id>
  if (rawParam.startsWith("channels_") || rawParam.startsWith("channel_")) {
    const channelId = rawParam.replace(/^channels?_/, "");
    return {
      targetUrl: `${appBaseUrl}/channels/${channelId}`,
      buttonText: "View Channel",
    };
  }

  // 4. Tournaments: tournaments_<id> or tournament_<id>
  if (rawParam.startsWith("tournaments_") || rawParam.startsWith("tournament_")) {
    const tournamentId = rawParam.replace(/^tournaments?_/, "");
    return {
      targetUrl: `${appBaseUrl}/tournaments/${tournamentId}`,
      buttonText: "Open Tournament",
    };
  }

  // 5. Affiliate Campaigns: campaign-aff-<hash>, campaign_<hash>, or affiliate-<hash>
  if (
    rawParam.startsWith("campaign-aff-") ||
    rawParam.startsWith("campaign_") ||
    rawParam.startsWith("affiliate-")
  ) {
    const hash = rawParam.replace(/^(campaign-aff-|campaign_|affiliate-)/, "");
    return {
      targetUrl: `${appBaseUrl}/join/${hash}`,
      buttonText: "Join Partner Campaign",
    };
  }

  // 6. Referral & General Onboarding: join_<slug> or join-<slug>
  if (rawParam.startsWith("join_") || rawParam.startsWith("join-")) {
    return {
      targetUrl: `${appBaseUrl}/?startapp=${rawParam}`,
      buttonText: "Join ONTON",
    };
  }

  return null;
}
