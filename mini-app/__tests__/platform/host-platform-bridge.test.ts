import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectPlatform,
  getPlatformBridge,
  isTelegramEnvironment,
  _resetPlatformBridge,
} from "@/lib/platform/platformBridge";

describe("HostPlatformBridge", () => {
  beforeEach(() => {
    _resetPlatformBridge();
    // Simulate browser window
    vi.stubGlobal("window", {
      Telegram: undefined,
      history: {
        back: vi.fn(),
        length: 2,
      },
      open: vi.fn(),
      alert: vi.fn(),
      confirm: vi.fn(() => true),
    });
    vi.stubGlobal("navigator", {
      vibrate: vi.fn(),
    });
  });

  it("detects browser environment when window.Telegram is undefined", () => {
    expect(isTelegramEnvironment()).toBe(false);
    expect(detectPlatform()).toBe("browser");
  });

  it("initializes BrowserPlatformBridge with safe defaults", () => {
    const bridge = getPlatformBridge();
    expect(bridge.platform).toBe("browser");
    expect(bridge.isTelegram).toBe(false);
    expect(bridge.isReady).toBe(true);

    const mbState = bridge.getMainButtonState();
    expect(mbState.isVisible).toBe(false);
    expect(mbState.isActive).toBe(true);
    expect(mbState.isLoading).toBe(false);
  });

  it("manages MainButton state and notifies subscribers", () => {
    const bridge = getPlatformBridge();
    const mockListener = vi.fn();
    const unsub = bridge.subscribeMainButton(mockListener);

    // Initial state sent to subscriber
    expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({ isVisible: false }));

    // Set button params
    const onClick = vi.fn();
    bridge.setMainButton({
      text: "Register Now",
      color: "#ff0000",
      isVisible: true,
      onClick,
    });

    expect(bridge.getMainButtonState().text).toBe("Register Now");
    expect(bridge.getMainButtonState().color).toBe("#ff0000");
    expect(bridge.getMainButtonState().isVisible).toBe(true);

    bridge.hideMainButton();
    expect(bridge.getMainButtonState().isVisible).toBe(false);

    bridge.showMainButton();
    expect(bridge.getMainButtonState().isVisible).toBe(true);

    bridge.setMainButtonLoading(true);
    expect(bridge.getMainButtonState().isLoading).toBe(true);

    unsub();
  });

  it("manages BackButton state and triggers callback or history back", () => {
    const bridge = getPlatformBridge();
    const mockListener = vi.fn();
    const unsub = bridge.subscribeBackButton(mockListener);

    expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({ isVisible: false }));

    const onBack = vi.fn();
    bridge.showBackButton(onBack);

    const state = bridge.getBackButtonState();
    expect(state.isVisible).toBe(true);
    state.onClick?.();
    expect(onBack).toHaveBeenCalledTimes(1);

    bridge.hideBackButton();
    expect(bridge.getBackButtonState().isVisible).toBe(false);

    unsub();
  });

  it("invokes navigator.vibrate safely on hapticFeedback", () => {
    const bridge = getPlatformBridge();
    bridge.hapticFeedback("impact", "medium");
    expect(navigator.vibrate).toHaveBeenCalledWith(15);
  });

  it("opens links via window.open in browser mode", () => {
    const bridge = getPlatformBridge();
    bridge.openLink("https://onton.live/events/123");
    expect(window.open).toHaveBeenCalledWith(
      "https://onton.live/events/123",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("shows confirm and alert dialogs as promises", async () => {
    const bridge = getPlatformBridge();
    const confirmed = await bridge.showConfirm("Are you sure?");
    expect(confirmed).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith("Are you sure?");

    await bridge.showAlert("Success!");
    expect(window.alert).toHaveBeenCalledWith("Success!");
  });
});
