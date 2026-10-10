"use client";

import { getPlatformBridge } from "@/lib/platform/platformBridge";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export interface BackButtonProps {
  whereTo: string;
}

let isButtonShown = false;

const useWithBackButton = ({ whereTo }: BackButtonProps) => {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const bridge = getPlatformBridge();
    const goBack = () => {
      router.push(whereTo);
    };

    bridge.showBackButton(goBack);
    isButtonShown = true;

    return () => {
      isButtonShown = false;
      setTimeout(() => {
        if (!isButtonShown) {
          bridge.hideBackButton();
        }
      }, 10);
    };
  }, [router, whereTo]);
};

export { useWithBackButton };
