import { atom } from "jotai";

// wether user is requesting a ticket or not
export const isRequestingTicketAtom = atom<{ state: true; orderId: string } | { state: false }>({ state: false });

export const tsxBocAtom = atom<string | undefined>(undefined);

// discount code
export const discountCodeAtom = atom<string | undefined>(undefined);

// payment rail selection: Telegram Stars or On-Chain Crypto (USDT/TON)
export const paymentRailAtom = atom<"STARS" | "CRYPTO">("STARS");
