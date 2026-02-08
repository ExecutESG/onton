"use client";

import { Toaster } from "@/components/ui/toaster";
import { ConfigProvider } from "@/context/ConfigContext";
import { NavigationHistoryProvider } from "@/context/NavigationHistoryContext";
// import * as Sentry from "@sentry/nextjs";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { ThemeProvider } from "next-themes";
import React from "react";
import KonstaAppProvider from "./_components/KonstaAppProvider";
import NotificationProvider from "./_components/NotificationProvider";
import UserSaver from "./_components/UserSaver";
import WebAppProvider from "./_components/WebAppProvider";
import TRPCAPIProvider from "./_trpc/Provider";
import ThemeSetter from "./themeSetter";

// NOTE: don't remove these
// const TELEMETREE_API_KEY = "ffdf302a-c23a-417d-932d-b82b46573742";
// const TELEMETREE_PROJECT_ID = "57ca5abb-9d53-4417-b8eb-18cfb8345f0c";
// const TELEMETREE_APP_NAME = "Onton-mini-app";

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {/* <Sentry.ErrorBoundary> */}
      <TonConnectUIProvider
        actionsConfiguration={{
          twaReturnUrl: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event`,
        }}
        manifestUrl="https://storage.onton.live/onton/onton_manifest.json"
      >
        <ThemeProvider
          defaultTheme="light"
          attribute="class"
        >
          <WebAppProvider>
            <KonstaAppProvider>
              <TRPCAPIProvider>
                <NavigationHistoryProvider>
                  <ConfigProvider>
                    {/*<TwaAnalyticsProvider*/}
                    {/*  projectId={TELEMETREE_PROJECT_ID}*/}
                    {/*  apiKey={TELEMETREE_API_KEY}*/}
                    {/*  appName={TELEMETREE_APP_NAME}*/}
                    {/*>*/}
                    <ThemeSetter>
                      <NotificationProvider>
                        <UserSaver>{children}</UserSaver>
                      </NotificationProvider>
                    </ThemeSetter>
                    <Toaster />
                    {/*</TwaAnalyticsProvider>*/}
                  </ConfigProvider>
                </NavigationHistoryProvider>
              </TRPCAPIProvider>
            </KonstaAppProvider>
          </WebAppProvider>
        </ThemeProvider>
      </TonConnectUIProvider>
      {/* </Sentry.ErrorBoundary> */}
    </>
  );
};

export default Providers;
