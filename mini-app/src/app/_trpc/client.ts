import { createTRPCReact } from "@trpc/react-query";

import { type AppRouter } from "@/server";

export const trpc = createTRPCReact<AppRouter>({});

/* -------------------------------------------------------------- */
/*  Simple in-memory bucket for the session-JWT                   */
/* -------------------------------------------------------------- */
let sessionJwt: string | null = null;

/** Call this right after `/tonProof.verifyProof` returns its token */
export function setJwt(jwt: string | null) {
  sessionJwt = jwt;
}
export function getJwt() {
  return sessionJwt;
}
