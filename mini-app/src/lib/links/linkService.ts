/**
 * Universal LinkService for ONTON
 * Generates canonical, platform-agnostic web URLs with Telegram deep link fallbacks
 * and UTM tracking.
 */

export interface LinkOptions {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  forceTelegram?: boolean;
}

export class LinkService {
  private static getBaseWebUrl(): string {
    if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_URL) {
      return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    }
    return "https://onton.live";
  }

  private static getBotUsername(): string {
    if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BOT_USERNAME) {
      return process.env.NEXT_PUBLIC_BOT_USERNAME.replace(/^@/, "");
    }
    if (typeof process !== "undefined" && process.env.BOT_USERNAME) {
      return process.env.BOT_USERNAME.replace(/^@/, "");
    }
    return "theontonbot";
  }

  /**
   * Generates a canonical event URL.
   * If forceTelegram is true, returns Telegram deep link.
   * Otherwise returns universal web URL with UTM parameters.
   */
  static getEventUrl(eventUuid: string, options: LinkOptions = {}): string {
    if (options.forceTelegram) {
      return this.getTelegramEventDeepLink(eventUuid, options.ref);
    }

    const baseUrl = `${this.getBaseWebUrl()}/events/${eventUuid}`;
    return this.appendQueryParams(baseUrl, options);
  }

  /**
   * Generates the Telegram Mini App deep link for an event.
   */
  static getTelegramEventDeepLink(eventUuid: string, ref?: string): string {
    const bot = this.getBotUsername();
    if (ref) {
      return `https://t.me/${bot}/event?startapp=${eventUuid}_ref_${ref}`;
    }
    return `https://t.me/${bot}/event?startapp=${eventUuid}`;
  }

  /**
   * Generates an organizer / channel profile URL.
   */
  static getChannelUrl(channelId: string | number, options: LinkOptions = {}): string {
    if (options.forceTelegram) {
      const bot = this.getBotUsername();
      return `https://t.me/${bot}/event?startapp=channels_${channelId}`;
    }

    const baseUrl = `${this.getBaseWebUrl()}/channels/${channelId}`;
    return this.appendQueryParams(baseUrl, options);
  }

  /**
   * Generates a tournament URL.
   */
  static getTournamentUrl(tournamentId: string | number, options: LinkOptions = {}): string {
    if (options.forceTelegram) {
      const bot = this.getBotUsername();
      return `https://t.me/${bot}/event?startapp=tournaments_${tournamentId}`;
    }

    const baseUrl = `${this.getBaseWebUrl()}/tournaments/${tournamentId}`;
    return this.appendQueryParams(baseUrl, options);
  }

  /**
   * Generates campaign / affiliate join links.
   */
  static getAffiliateUrl(linkHash: string, options: LinkOptions = {}): string {
    if (options.forceTelegram) {
      const bot = this.getBotUsername();
      return `https://t.me/${bot}/event?startapp=campaign-aff-${linkHash}`;
    }

    const baseUrl = `${this.getBaseWebUrl()}/join/${linkHash}`;
    return this.appendQueryParams(baseUrl, options);
  }

  /**
   * Resolves a smart link based on user agent (e.g. redirects to Telegram when inside Telegram client).
   */
  static resolveSmartEventLink(eventUuid: string, userAgent?: string, options: LinkOptions = {}): string {
    if (this.isTelegramUserAgent(userAgent)) {
      return this.getTelegramEventDeepLink(eventUuid, options.ref);
    }
    return this.getEventUrl(eventUuid, options);
  }

  /**
   * Detects if the requesting user agent is the Telegram in-app browser or bot.
   */
  static isTelegramUserAgent(userAgent?: string): boolean {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return ua.includes("telegram") || ua.includes("tgweb");
  }

  private static appendQueryParams(url: string, options: LinkOptions): string {
    const params = new URLSearchParams();
    if (options.ref) params.set("ref", options.ref);
    if (options.utm_source) params.set("utm_source", options.utm_source);
    if (options.utm_medium) params.set("utm_medium", options.utm_medium);
    if (options.utm_campaign) params.set("utm_campaign", options.utm_campaign);

    const qs = params.toString();
    if (!qs) return url;
    return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
  }
}
