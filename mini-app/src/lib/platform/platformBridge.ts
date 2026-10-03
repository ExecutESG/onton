import {
  BackButtonState,
  HostPlatformBridge,
  MainButtonState,
  PlatformType,
} from "./types";

export const isTelegramEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const win = window as any;
  return Boolean(
    win.Telegram?.WebApp?.initData ||
      win.TelegramWebviewProxy ||
      (win.Telegram?.WebApp && win.Telegram.WebApp.platform !== "unknown")
  );
};

export const detectPlatform = (): PlatformType => {
  if (typeof window === "undefined") return "browser";
  if (isTelegramEnvironment()) return "telegram";
  if (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as any)?.standalone
  ) {
    return "standalone_pwa";
  }
  return "browser";
};

class TelegramPlatformBridge implements HostPlatformBridge {
  platform: PlatformType = "telegram";
  isTelegram = true;
  isReady = false;

  private mainButtonListeners = new Set<(state: MainButtonState) => void>();
  private backButtonListeners = new Set<(state: BackButtonState) => void>();
  private activeBackClickHandler?: () => void;
  private activeMainClickHandler?: () => void;

  constructor() {
    if (typeof window !== "undefined") {
      this.initTelegramListeners();
    }
  }

  private get webApp() {
    return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  }

  private initTelegramListeners() {
    const wa = this.webApp;
    if (!wa) return;

    try {
      wa.onEvent("mainButtonClicked", () => {
        if (this.activeMainClickHandler) {
          this.activeMainClickHandler();
        }
      });
      wa.onEvent("backButtonClicked", () => {
        if (this.activeBackClickHandler) {
          this.activeBackClickHandler();
        } else if (typeof window !== "undefined") {
          window.history.back();
        }
      });
    } catch {
      // Ignore initial setup errors if events not supported
    }
  }

  ready(): void {
    try {
      this.webApp?.ready();
      this.isReady = true;
    } catch {
      this.isReady = true;
    }
  }

  expand(): void {
    try {
      this.webApp?.expand();
    } catch {}
  }

  close(): void {
    try {
      this.webApp?.close();
    } catch {
      if (typeof window !== "undefined") window.close();
    }
  }

  getMainButtonState(): MainButtonState {
    const mb = this.webApp?.MainButton;
    return {
      text: mb?.text || "",
      isVisible: Boolean(mb?.isVisible),
      isActive: Boolean(mb?.isActive),
      isLoading: Boolean(mb?.isProgressVisible),
      color: mb?.color,
      textColor: mb?.textColor,
    };
  }

  setMainButton(options: Partial<MainButtonState>): void {
    const mb = this.webApp?.MainButton;
    if (!mb) return;

    try {
      if (options.text !== undefined) mb.setText(options.text);
      if (options.color !== undefined) mb.setParams({ color: options.color });
      if (options.textColor !== undefined) mb.setParams({ text_color: options.textColor });
      if (options.isActive !== undefined) {
        if (options.isActive) mb.enable();
        else mb.disable();
      }
      if (options.isLoading !== undefined) {
        if (options.isLoading) mb.showProgress(false);
        else mb.hideProgress();
      }
      if (options.onClick !== undefined) {
        this.activeMainClickHandler = options.onClick;
      }
      if (options.isVisible !== undefined) {
        if (options.isVisible) mb.show();
        else mb.hide();
      }
      this.notifyMainButtonListeners();
    } catch {}
  }

  showMainButton(): void {
    try {
      this.webApp?.MainButton?.show();
      this.notifyMainButtonListeners();
    } catch {}
  }

  hideMainButton(): void {
    try {
      this.webApp?.MainButton?.hide();
      this.notifyMainButtonListeners();
    } catch {}
  }

  setMainButtonLoading(isLoading: boolean): void {
    try {
      if (isLoading) this.webApp?.MainButton?.showProgress(false);
      else this.webApp?.MainButton?.hideProgress();
      this.notifyMainButtonListeners();
    } catch {}
  }

  subscribeMainButton(listener: (state: MainButtonState) => void): () => void {
    this.mainButtonListeners.add(listener);
    listener(this.getMainButtonState());
    return () => this.mainButtonListeners.delete(listener);
  }

  private notifyMainButtonListeners() {
    const state = this.getMainButtonState();
    this.mainButtonListeners.forEach((fn) => fn(state));
  }

  getBackButtonState(): BackButtonState {
    return {
      isVisible: Boolean(this.webApp?.BackButton?.isVisible),
      onClick: this.activeBackClickHandler,
    };
  }

  showBackButton(onClick?: () => void): void {
    if (onClick) {
      this.activeBackClickHandler = onClick;
    }
    try {
      this.webApp?.BackButton?.show();
      this.notifyBackButtonListeners();
    } catch {}
  }

  hideBackButton(): void {
    try {
      this.webApp?.BackButton?.hide();
      this.notifyBackButtonListeners();
    } catch {}
  }

  subscribeBackButton(listener: (state: BackButtonState) => void): () => void {
    this.backButtonListeners.add(listener);
    listener(this.getBackButtonState());
    return () => this.backButtonListeners.delete(listener);
  }

  private notifyBackButtonListeners() {
    const state = this.getBackButtonState();
    this.backButtonListeners.forEach((fn) => fn(state));
  }

  hapticFeedback(
    type: "impact" | "notification" | "selection" = "impact",
    style: string = "medium"
  ): void {
    try {
      const hf = this.webApp?.HapticFeedback;
      if (!hf) return;
      if (type === "impact") {
        hf.impactOccurred(style as any);
      } else if (type === "notification") {
        hf.notificationOccurred(style as any);
      } else if (type === "selection") {
        hf.selectionChanged();
      }
    } catch {}
  }

  openLink(url: string, options?: { try_instant_view?: boolean }): void {
    try {
      if (this.webApp?.openLink) {
        this.webApp.openLink(url, options as any);
      } else if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  }

  openTelegramLink(url: string): void {
    try {
      if (this.webApp?.openTelegramLink) {
        this.webApp.openTelegramLink(url);
      } else if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  }

  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (this.webApp?.showAlert) {
          this.webApp.showAlert(message, () => resolve());
        } else {
          if (typeof window !== "undefined") alert(message);
          resolve();
        }
      } catch {
        if (typeof window !== "undefined") alert(message);
        resolve();
      }
    });
  }

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (this.webApp?.showConfirm) {
          this.webApp.showConfirm(message, (confirmed: boolean) => resolve(confirmed));
        } else {
          const result = typeof window !== "undefined" ? confirm(message) : false;
          resolve(result);
        }
      } catch {
        const result = typeof window !== "undefined" ? confirm(message) : false;
        resolve(result);
      }
    });
  }
}

class BrowserPlatformBridge implements HostPlatformBridge {
  platform: PlatformType;
  isTelegram = false;
  isReady = true;

  private mainButtonState: MainButtonState = {
    text: "",
    isVisible: false,
    isActive: true,
    isLoading: false,
  };

  private backButtonState: BackButtonState = {
    isVisible: false,
  };

  private mainButtonListeners = new Set<(state: MainButtonState) => void>();
  private backButtonListeners = new Set<(state: BackButtonState) => void>();

  constructor(platform: PlatformType = "browser") {
    this.platform = platform;
  }

  ready(): void {
    this.isReady = true;
  }

  expand(): void {
    // No-op on desktop/browser
  }

  close(): void {
    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    }
  }

  getMainButtonState(): MainButtonState {
    return { ...this.mainButtonState };
  }

  setMainButton(options: Partial<MainButtonState>): void {
    this.mainButtonState = {
      ...this.mainButtonState,
      ...options,
    };
    this.notifyMainButtonListeners();
  }

  showMainButton(): void {
    this.mainButtonState.isVisible = true;
    this.notifyMainButtonListeners();
  }

  hideMainButton(): void {
    this.mainButtonState.isVisible = false;
    this.notifyMainButtonListeners();
  }

  setMainButtonLoading(isLoading: boolean): void {
    this.mainButtonState.isLoading = isLoading;
    this.notifyMainButtonListeners();
  }

  subscribeMainButton(listener: (state: MainButtonState) => void): () => void {
    this.mainButtonListeners.add(listener);
    listener(this.getMainButtonState());
    return () => this.mainButtonListeners.delete(listener);
  }

  private notifyMainButtonListeners() {
    const state = this.getMainButtonState();
    this.mainButtonListeners.forEach((fn) => fn(state));
  }

  getBackButtonState(): BackButtonState {
    return { ...this.backButtonState };
  }

  showBackButton(onClick?: () => void): void {
    this.backButtonState = {
      isVisible: true,
      onClick: onClick || (() => {
        if (typeof window !== "undefined") window.history.back();
      }),
    };
    this.notifyBackButtonListeners();
  }

  hideBackButton(): void {
    this.backButtonState = {
      isVisible: false,
      onClick: undefined,
    };
    this.notifyBackButtonListeners();
  }

  subscribeBackButton(listener: (state: BackButtonState) => void): () => void {
    this.backButtonListeners.add(listener);
    listener(this.getBackButtonState());
    return () => this.backButtonListeners.delete(listener);
  }

  private notifyBackButtonListeners() {
    const state = this.getBackButtonState();
    this.backButtonListeners.forEach((fn) => fn(state));
  }

  hapticFeedback(
    _type?: "impact" | "notification" | "selection",
    _style?: string
  ): void {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  }

  openLink(url: string): void {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  openTelegramLink(url: string): void {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window !== "undefined") {
        window.alert(message);
      }
      resolve();
    });
  }

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window !== "undefined") {
        const result = window.confirm(message);
        resolve(result);
      } else {
        resolve(false);
      }
    });
  }
}

let bridgeInstance: HostPlatformBridge | null = null;

export const getPlatformBridge = (): HostPlatformBridge => {
  if (bridgeInstance) return bridgeInstance;

  const platform = detectPlatform();
  if (platform === "telegram") {
    bridgeInstance = new TelegramPlatformBridge();
  } else {
    bridgeInstance = new BrowserPlatformBridge(platform);
  }
  return bridgeInstance;
};

// Reset instance primarily for testing
export const _resetPlatformBridge = () => {
  bridgeInstance = null;
};
