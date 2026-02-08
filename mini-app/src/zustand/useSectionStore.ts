import { create } from "zustand";

/**
 * For your “steps” or “tabs” or “sub-pages,” we define them as string-based.
 * Examples:
 *  - "none"
 *  - "event_setup_form_general_step"
 *  - "event_setup_form_time_place_step"
 *  - "event_setup_form_registration_setup"
 *  - "event_setup_form_reward_step"
 *  - "edit_event"
 *  - "event_orders"
 *  - "promotion_code"
 *  - etc.
 */
export type Section =
  | "none"
  | "event_setup_form_general_step"
  | "event_setup_form_time_place_step"
  | "event_setup_form_registration_setup"
  | "event_setup_form_reward_step"
  | "edit_event"
  | "event_orders"
  | "promotion_code"
  | "guests_list"
  | "get_attendance"
  // ... or any string
  | string;

interface SectionStackState {
  /**
   * sections: an array (stack) of Section.
   * The top is at sections[sections.length - 1].
   */
  sections: Section[];

  /**
   * getCurrentSection() => returns the top of the stack
   */
  getCurrentSection: () => Section;

  /**
   * setSection(newSec):
   *   - pushes newSec onto the stack
   */
  setSection: (section: Section) => void;

  /**
   * goBack():
   *   - pops the top off the stack if length > 1
   *   - returns true if it actually went back, false if the stack had only 1 element left
   */
  goBack: () => boolean;

  /**
   * clearSections():
   *   - clears the stack, leaving only ["none"]
   *   - you might call this after finishing the last step
   */
  clearSections: () => void;
}

export const useSectionStore = create<SectionStackState>((set, get) => ({
  // By default, there's one element => "none"
  sections: ["none"],

  getCurrentSection: () => {
    const state = get();
    const stack = state.sections;
    return stack[stack.length - 1] || "none";
  },

  setSection: (section) => {
    set((state) => ({
      sections: [...state.sections, section],
    }));
  },

  goBack: () => {
    let didGoBack = false;
    set((state) => {
      if (state.sections.length > 1) {
        // pop the top
        const newStack = state.sections.slice(0, -1);
        didGoBack = true;
        return { sections: newStack };
      }
      // if stack only has 1 => do nothing
      return {};
    });
    return didGoBack;
  },

  clearSections: () => {
    set(() => ({
      sections: ["none"],
    }));
  },
}));
