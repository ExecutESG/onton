"use client";

import { httpLink, TRPCLink } from "@trpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState } from "react";
import { getJwt, trpc } from "./client";
import { useUserStore } from "@/context/store/user.store";
import { observable } from "@trpc/server/observable";
import { getClientTelegramInitData } from "@/lib/clientTelegramInitData";

const initDataExpirationAlert = () => {
  sessionStorage.removeItem("telegram:initParams");

  const hasTelegramContext = typeof window !== "undefined" && !!window.Telegram?.WebApp?.initData;
  if (hasTelegramContext && window.Telegram?.WebApp) {
    if (!window.Telegram.WebApp?.isVersionAtLeast("6.0")) {
      console.error("Telegram WebApp version is lower than 6.0");
      alert("Your Telegram version is too old. Please update the app.");
      window.Telegram.WebApp.close();
    }
    window.Telegram.WebApp.showPopup(
      {
        message: "Your session has expired. Please restart the app.",
        buttons: [{ type: "close" }],
      },
      () => {
        window.Telegram.WebApp.close();
      }
    );
  }
};

const createCombinedLink = (): TRPCLink<any> => {
  return () => {
    return (opts) => {
      return observable((observer) => {
        let attempts = 0;
        const MAX_ATTEMPTS = 3;

        function attempt() {
          return opts.next(opts.op).subscribe({
            next(value) {
              observer.next(value);
            },
            error(err) {
              // Handle unauthorized error
              if (err.data?.code === "UNAUTHORIZED") {
                console.error("UNAUTHORIZED error in response:", err);
                const hasSentInitData = !!(getClientTelegramInitData() || useUserStore.getState().initData);
                const isExplicitExpiry =
                  err.message?.toLowerCase().includes("expired") ||
                  err.message?.toLowerCase().includes("invalid");
                if (hasSentInitData && isExplicitExpiry) {
                  initDataExpirationAlert();
                }
                observer.error(err);
                return;
              }

              // Handle 500 errors with retry
              const shouldRetry =
                err.data?.httpStatus === 500 ||
                err.data?.httpStatus === 502 ||
                err.data?.httpStatus === 503 ||
                err.data?.httpStatus === 504;
              if (shouldRetry && attempts < MAX_ATTEMPTS) {
                attempts++;
                // Exponential backoff delay
                const delay = Math.min(1000 * 2 ** attempts, 5000);
                setTimeout(attempt, delay);
                return;
              }

              observer.error(err);
            },
            complete() {
              observer.complete();
            },
          });
        }

        return attempt();
      });
    };
  };
};

export default function TRPCAPIProvider({ children }: { children: React.ReactNode }) {
  const { initData } = useUserStore();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false, // handling it manually in our customLink
            retryOnMount: false,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(
    trpc.createClient({
      links: [
        createCombinedLink(), // custom link to handlen retring
        httpLink({
          url: process.env.NEXT_PUBLIC_TRPC_BASE_URL ? process.env.NEXT_PUBLIC_TRPC_BASE_URL + "/api/trpc" : "/api/trpc",
          headers() {
            const headers: Record<string, string> = {};

            /* Telegram init-data (dynamic resolution) */
            const storeInitData = useUserStore.getState().initData;
            const tgInitData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData : "";
            const sessionInitData = typeof window !== "undefined" ? sessionStorage.getItem("telegram:initParams") || "" : "";
            const activeInitData = storeInitData || tgInitData || sessionInitData || getClientTelegramInitData();

            if (activeInitData) headers.Authorization = activeInitData;

            /* Session-JWT from ton-proof */
            const jwt = getJwt();
            if (jwt) headers["x-session-jwt"] = jwt;

            return headers;
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider
      client={trpcClient}
      queryClient={queryClient}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
