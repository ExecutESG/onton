"use client";

import { useEffect, useState } from "react";
import { getPlatformBridge } from "./platformBridge";
import { BackButtonState, HostPlatformBridge, MainButtonState, PlatformType } from "./types";

export interface UsePlatformBridgeResult {
  bridge: HostPlatformBridge;
  platform: PlatformType;
  isTelegram: boolean;
  mainButton: MainButtonState;
  backButton: BackButtonState;
  setMainButton: (options: Partial<MainButtonState>) => void;
  showMainButton: () => void;
  hideMainButton: () => void;
  showBackButton: (onClick?: () => void) => void;
  hideBackButton: () => void;
  hapticFeedback: HostPlatformBridge["hapticFeedback"];
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
}

export const usePlatformBridge = (): UsePlatformBridgeResult => {
  const bridge = getPlatformBridge();
  const [mainButton, setMainButtonState] = useState<MainButtonState>(bridge.getMainButtonState());
  const [backButton, setBackButtonState] = useState<BackButtonState>(bridge.getBackButtonState());

  useEffect(() => {
    const unsubMain = bridge.subscribeMainButton(setMainButtonState);
    const unsubBack = bridge.subscribeBackButton(setBackButtonState);
    return () => {
      unsubMain();
      unsubBack();
    };
  }, [bridge]);

  return {
    bridge,
    platform: bridge.platform,
    isTelegram: bridge.isTelegram,
    mainButton,
    backButton,
    setMainButton: (opts) => bridge.setMainButton(opts),
    showMainButton: () => bridge.showMainButton(),
    hideMainButton: () => bridge.hideMainButton(),
    showBackButton: (onClick) => bridge.showBackButton(onClick),
    hideBackButton: () => bridge.hideBackButton(),
    hapticFeedback: (type, style) => bridge.hapticFeedback(type, style),
    showAlert: (msg) => bridge.showAlert(msg),
    showConfirm: (msg) => bridge.showConfirm(msg),
  };
};

export default usePlatformBridge;
