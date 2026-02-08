"use client";

import useWebApp from "@/hooks/useWebApp";
// import * as Sentry from "@sentry/nextjs";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef } from "react";
import EventsSkeleton from "./molecules/skeletons/EventsSkeleton";

import { useUserStore } from "@/context/store/user.store";
import { useSectionStore } from "@/zustand/useSectionStore";

export default function WebAppProvider({ children }: { children: React.ReactNode }) {
  const webApp = useWebApp();
  const router = useRouter();
  const pathname = usePathname();

  const { setInitData, initData } = useUserStore();

  const theme = webApp?.themeParams;

  // Access multi-level stack from the store
  const { goBack } = useSectionStore();

  // 1) Sentry + initialization (disabled)
  useEffect(() => {
    if (webApp?.initDataUnsafe.user?.id) {
      setInitData(webApp.initData);
      // Sentry.init({ environment: process.env.NEXT_PUBLIC_ENV });
      // Sentry.setUser({
      //   id: webApp.initDataUnsafe.user?.id,
      //   username: webApp.initDataUnsafe.user?.username,
      // });
    }
  }, [setInitData, webApp?.initData, webApp?.initDataUnsafe.user?.id, webApp?.initDataUnsafe.user?.username]);

  // 2) Track initial history length
  const initialHistoryLength = useRef<number>(0);
  const previousHistoryLength = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.history) {
      initialHistoryLength.current = window.history.length || 0;
      previousHistoryLength.current = window.history.length || 0;
    }
  }, []);

  // 3) Telegram back button logic
  useEffect(() => {
    if (typeof window === "undefined" || !window.Telegram?.WebApp) return;

    const WebApp = window.Telegram.WebApp;
    const backButton = WebApp.BackButton;
    WebApp.isClosingConfirmationEnabled = true;
    // A function to show/hide the TG back button
    const decideVisibility = () => {
      const section = useSectionStore.getState().getCurrentSection();
      // If the route is "/" AND store top is "none", we hide
      if (pathname === "/" && section === "none") {
        backButton.hide();
      } else {
        backButton.show();
      }
    };

    decideVisibility();

    // Subscribe to store changes with the single-callback signature
    const unsub = useSectionStore.subscribe((newState, oldState) => {
      if (newState.sections !== oldState.sections) {
        decideVisibility();
      }
    });

    const handleBackButtonClicked = () => {
      // Attempt to pop from store

      const didGoBack = goBack();
      if (didGoBack) {
        // We popped one level => check if we're now at "none"
        const newTop = useSectionStore.getState().getCurrentSection();
        if (newTop === "none") {
          // We just returned to "none".
          // => Immediately do the route fallback so user doesn't press again
          fallbackHistoryOrHome();
        }
        return;
      }

      // If store couldn't pop => fallback
      fallbackHistoryOrHome();
    };

    // Function to do a real history.back() with popstate fallback => or go home
    const fallbackHistoryOrHome = () => {
      let popstateReceived = false;
      const handlePopstate = () => {
        popstateReceived = true;
      };
      window.addEventListener("popstate", handlePopstate);

      window.history.back();

      setTimeout(() => {
        window.removeEventListener("popstate", handlePopstate);
        if (!popstateReceived) {
          router.push("/");
        }
      }, 300);
    };

    WebApp.onEvent("backButtonClicked", handleBackButtonClicked);

    return () => {
      unsub();
      WebApp.offEvent("backButtonClicked", handleBackButtonClicked);
      backButton.hide();
    };
  }, [pathname, router, goBack]);

  // 5) If we don't have initData => show skeleton
  if (!initData) {
    return (
      <div
        className={"p-4"}
        style={{
          backgroundColor: theme?.bg_color,
        }}
      >
        <EventsSkeleton />;
      </div>
    );
  }

  return <>{children}</>;
}
