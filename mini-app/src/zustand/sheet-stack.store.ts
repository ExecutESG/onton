import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {} from "@redux-devtools/extension"; // required for devtools typing

interface State {
  anyOpen: boolean; // if there is any sheet open currently
  openCount: number; // number of open sheets
  wasMainButtonVisible: boolean;
}

interface Actions {
  openedOneSheet: () => void;
  closedOneSheet: () => void;
}

type SheetStackState = State & Actions;

/**
 * This state is used to track the number of open sheets (drawers from konst)
 * This state will also handle main button in which it will either hide/show it on open/close state
 */
export const useSheetStackStore = create<SheetStackState>()(
  devtools(
    immer((set) => {
      return {
        anyOpen: false,
        openCount: 0,
        wasMainButtonVisible: false,
        openedOneSheet: () =>
          set((state) => {
            state.openCount++;
            state.anyOpen = true;
            if (typeof window === "undefined") return;
            try {
              const { getPlatformBridge } = require("@/lib/platform/platformBridge");
              const bridge = getPlatformBridge();
              const mbState = bridge.getMainButtonState();
              if (mbState.isVisible) {
                state.wasMainButtonVisible = true;
                bridge.hideMainButton();
              } else {
                state.wasMainButtonVisible = false;
              }
            } catch {
              state.wasMainButtonVisible = false;
            }
          }),
        closedOneSheet: () => {
          set((state) => {
            if (state.anyOpen) {
              state.openCount--;
              state.anyOpen = state.openCount > 0;
              if (!state.anyOpen && state.wasMainButtonVisible && typeof window !== "undefined") {
                try {
                  const { getPlatformBridge } = require("@/lib/platform/platformBridge");
                  getPlatformBridge().showMainButton();
                } catch {}
              }
            }
          });
        },
      };
    })
  )
);
