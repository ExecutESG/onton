import { env } from "~/env.mjs";

export const isTestnet = !(/*NOT*/ ["production", "stage", "staging"].includes(env.NEXT_PUBLIC_ENV));

export const ALLOWED_TONFEST_EVENT_UUIDS = [
  "44c3e7fe-d187-445e-9794-e181d1145e10",
  "c5f9bd59-a46b-4dce-91cb-3cd146b255a5",
  "839960c1-12ec-405e-b372-be88ece4fa18",
];
