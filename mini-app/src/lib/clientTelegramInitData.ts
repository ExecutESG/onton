/**
 * Client-side utility to synchronously extract Telegram Mini App initData.
 * Telegram passes initData in the URL hash (#tgWebAppData=...) when launching the webview,
 * meaning it is available immediately on the very first JavaScript tick before
 * external scripts (like telegram-web-app.js) load or React finishes hydration.
 */

export function getClientTelegramInitData(): string {
  if (typeof window === "undefined") return "";

  // 1. window.Telegram.WebApp.initData (if SDK already initialized)
  if (window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }

  // 2. Direct from URL hash (#tgWebAppData=...)
  try {
    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (rawHash) {
      const params = new URLSearchParams(rawHash);
      const tgWebAppData = params.get("tgWebAppData");
      if (tgWebAppData) {
        return tgWebAppData;
      }
    }
  } catch {}

  // 3. sessionStorage fallback (cached from earlier in the session)
  try {
    const sessionData = sessionStorage.getItem("telegram:initParams");
    if (sessionData) return sessionData;

    const tgSession = sessionStorage.getItem("Telegram.WebView.initParams");
    if (tgSession) {
      const parsed = JSON.parse(tgSession);
      if (parsed?.tgWebAppData) return parsed.tgWebAppData;
    }
  } catch {}

  return "";
}

/**
 * Checks whether the current runtime environment is inside Telegram (TMA).
 */
export function isTelegramClient(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!window.Telegram?.WebApp?.initData ||
    window.location.hash.includes("tgWebAppData") ||
    !!(window as any).TelegramWebviewProxy ||
    !!sessionStorage.getItem("telegram:initParams") ||
    !!sessionStorage.getItem("Telegram.WebView.initParams")
  );
}
