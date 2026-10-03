export type PlatformType = "telegram" | "browser" | "standalone_pwa";

export interface MainButtonState {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  isLoading: boolean;
  color?: string;
  textColor?: string;
  onClick?: () => void;
}

export interface BackButtonState {
  isVisible: boolean;
  onClick?: () => void;
}

export type HapticImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
export type HapticNotificationType = "error" | "success" | "warning";

export interface HostPlatformBridge {
  platform: PlatformType;
  isTelegram: boolean;
  isReady: boolean;
  ready(): void;
  expand(): void;
  close(): void;

  // MainButton
  getMainButtonState(): MainButtonState;
  setMainButton(options: Partial<MainButtonState>): void;
  showMainButton(): void;
  hideMainButton(): void;
  setMainButtonLoading(isLoading: boolean): void;
  subscribeMainButton(listener: (state: MainButtonState) => void): () => void;

  // BackButton
  getBackButtonState(): BackButtonState;
  showBackButton(onClick?: () => void): void;
  hideBackButton(): void;
  subscribeBackButton(listener: (state: BackButtonState) => void): () => void;

  // Haptics
  hapticFeedback(
    type?: "impact" | "notification" | "selection",
    style?: HapticImpactStyle | HapticNotificationType
  ): void;

  // Navigation & External Links
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;

  // Dialogs
  showAlert(message: string): Promise<void>;
  showConfirm(message: string): Promise<boolean>;
}
