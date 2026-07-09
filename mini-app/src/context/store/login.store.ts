import { create } from "zustand";

type LoginStore = {
  isOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
};

export const useLoginStore = create<LoginStore>((set) => ({
  isOpen: false,
  openLogin: () => set({ isOpen: true }),
  closeLogin: () => set({ isOpen: false }),
}));
