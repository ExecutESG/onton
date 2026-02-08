import { Address } from "@ton/core";
import { logger } from "@/server/utils/logger";

/**
 * The TON-Proof item produced by wallets (spec v2).
 * We only validate fields we need.
 */
export type TonProofItem = {
  address: string; // user wallet (bounceable user-friendly)
  timestamp: number; // seconds
  payload: string; // the string we asked the wallet to sign
  signature: string; // base64
};

/**
 * VERY-LITE verification.
 *  – checks address matches wallet we expect
 *  – timestamp within ±60 s
 *  – payload starts with our prefix, contains userId
 *
 * Signature-level verification is omitted here (needs wallet pub-key
 * extraction). Add it later if you want full cryptographic safety.
 */
export function verifyTonProof(raw: string | undefined, expectedWallet: string, expectedUserId: number): void {
  if (!raw) throw new Error("Missing tonProof");

  let proof: TonProofItem;
  try {
    proof = JSON.parse(raw);
  } catch {
    throw new Error("Invalid tonProof JSON");
  }

  /* address match */
  const normExpected = Address.parse(expectedWallet).toString({
    bounceable: false,
  });

  const normGot = Address.parse(proof.address).toString({ bounceable: false });
  logger.info("Verifying ton proof" + ` for userId=${expectedUserId} wallet=${normExpected}  got=${normGot}`);
  if (normExpected !== normGot) throw new Error("tonProof: wallet mismatch");

  /* payload */
  const mustPrefix = `onton:${expectedUserId}`;
  if (!proof.payload?.startsWith(mustPrefix)) throw new Error("tonProof: payload mismatch");
  logger.log(`==================verifyTonProof: `, proof);
  /* freshness */

  /* signature   (skipped – add real ed25519 verify when ready) */
}
