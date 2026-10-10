// import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast (#1052): refuse to serve with missing, short or default secrets.
    const { assertRequiredSecrets } = await import("@/server/utils/requiredSecrets");
    try {
      assertRequiredSecrets();
    } catch (err) {
      // The message names keys only, never values.
      console.error(`[startup] ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  // Temporarily disable Sentry setup
  // if (process.env.NEXT_RUNTIME === "nodejs") {
  //   await import("../sentry.server.config");
  // }

  // if (process.env.NEXT_RUNTIME === "edge") {
  //   await import("../sentry.edge.config");
  // }
}

// export const onRequestError = Sentry.captureRequestError;
