/* ------------------------------------------------------------------ */
/*  Utilities for TON-Proof v2                                        */
/* ------------------------------------------------------------------ */

import { sha256 } from "@noble/hashes/sha256";
import { utf8ToBytes } from "@noble/hashes/utils";
import nacl from "tweetnacl";
import { Address, Cell, contractAddress, loadStateInit, StateInit } from "@ton/core";

/* ------------------------------------------------------------------ */
/*  CONSTANTS (from white-paper)                                      */
/* ------------------------------------------------------------------ */

export const TON_PROOF_PREFIX = utf8ToBytes("ton-proof-item-v2/");
export const TON_CONNECT_PREFIX = utf8ToBytes("ton-connect");
export const ALLOWED_DOMAINS = [
  "t.me",
  "onton.tg",
  "onton.live",
  "mohammad-app.toncloud.observer",
  "mohammad-app.toncloud.observer",
  "tonkeeper.app",
  "tonkeeper.com",
  "tonhub.com",
  "mytonwallet.app",
];
export const VALID_AGE_SEC = 3600 + 600; // 600-second TTL

/* ------------------------------------------------------------------ */
/*  Simple numeric helpers                                            */
/* ------------------------------------------------------------------ */
export const be32 = (n: number) => Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

export const le32 = (n: number) => Uint8Array.from([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);

export const le64 = (num: number) => {
  const out = new Uint8Array(8);
  let lo = num >>> 0; // low 32 bits
  out[0] = lo & 255;
  out[1] = (lo >>> 8) & 255;
  out[2] = (lo >>> 16) & 255;
  out[3] = (lo >>> 24) & 255;
  let hi = Math.floor(num / 2 ** 32) >>> 0;
  out[4] = hi & 255;
  out[5] = (hi >>> 8) & 255;
  out[6] = (hi >>> 16) & 255;
  out[7] = (hi >>> 24) & 255;
  return out;
};

export const hexToU8 = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));
export const b64ToU8 = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));

/* ------------------------------------------------------------------ */
/*  Extract public-key from standard wallet StateInit                 */
/* ------------------------------------------------------------------ */
export function tryParsePublicKey(st: StateInit): Buffer | null {
  if (!st.data) return null;
  try {
    const slice = st.data.beginParse();
    // wallet v3/v4 keep raw key in first 256 bits
    return Buffer.from(slice.loadUintBig(256).toString(16).padStart(64, "0"), "hex");
  } catch {
    return null;
  }
}
const u32be = (n: number) => Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u32le = (n: number) => Uint8Array.from([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
const u64le = (n: number) => {
  const lo = n >>> 0;
  const hi = (n / 2 ** 32) >>> 0;
  return Uint8Array.from([
    lo & 255,
    (lo >>> 8) & 255,
    (lo >>> 16) & 255,
    (lo >>> 24) & 255,
    hi & 255,
    (hi >>> 8) & 255,
    (hi >>> 16) & 255,
    (hi >>> 24) & 255,
  ]);
};
/* ------------------------------------------------------------------ */
/*  Build the exact byte-string a wallet signs (white-paper §5)       */
/* ------------------------------------------------------------------ */
export function buildSignedBody(opts: {
  address: Address;
  domainLength: number;
  domainValue: Uint8Array;
  timestamp: number;
  payload: Uint8Array;
}) {
  return new Uint8Array([
    ...TON_PROOF_PREFIX,
    ...u32be(opts.address.workChain),
    ...opts.address.hash, // 32-bytes
    ...u32le(opts.domainLength),
    ...opts.domainValue,
    ...u64le(opts.timestamp),
    ...opts.payload,
  ]);
}

/* ------------------------------------------------------------------ */
/*  Ed25519 verification                                              */
/* ------------------------------------------------------------------ */
export function ed25519Verify(
  body: Uint8Array, // result of buildSignedBody
  sigBase64: string,
  pubKeyHex: string
): boolean {
  /* ① sha256(message) */
  const msgHash = sha256(body);

  /* ② 0xFFFF || "ton-connect" || sha256(message) */
  const prehashed = new Uint8Array([0xff, 0xff, ...TON_CONNECT_PREFIX, ...msgHash]);

  /* ③ sha256(whole-buf) — **this** is what gets signed */
  const whatIsSigned = sha256(prehashed);

  /* ④ detached verify */
  return nacl.sign.detached.verify(whatIsSigned, b64ToU8(sigBase64), hexToU8(pubKeyHex));
}

export function u8eq(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
