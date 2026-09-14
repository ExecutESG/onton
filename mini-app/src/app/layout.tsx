/* eslint-disable @next/next/no-sync-scripts */
import NotificationHandler from "@/app/_components/NotificationHandler";
import { cn } from "@/lib/utils";
import { GoogleTagManager } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import React from "react";
import ModalsContainer from "./_components/ModalsContainer";
import "./globals.css";
import Providers from "./providers";

const mainFont = Roboto({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "ONTON",
  description: "Events on TON",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === "production" && (
          <>
            <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM as string} />
            <script
              src="https://dvq1zz1g273yl.cloudfront.net/buyer_v1.0.3.min.js"
              traffy-key="851"
            ></script>
          </>
        )}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive"></Script>
      </head>
      <body className={cn(mainFont.className)}>
        <Providers>
          <NotificationHandler />
          {children}
        </Providers>
        {process.env.NODE_ENV === "development" && (
          <script
            async
            src="http://localhost:8097"
          ></script>
        )}
        <ModalsContainer />
      </body>
    </html>
  );
}
