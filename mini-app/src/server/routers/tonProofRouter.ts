import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { initDataProtectedProcedure, router } from "@/server/trpc";

import { Address, Cell, loadStateInit, contractAddress } from "@ton/core";

import { TonClient4 } from "@ton/ton";

import {
  ALLOWED_DOMAINS,
  VALID_AGE_SEC,
  tryParsePublicKey,
  hexToU8,
  buildSignedBody,
  ed25519Verify,
  u8eq,
} from "@/server/utils/ton-proof-hash";

import { createAuthToken } from "@/server/utils/jwt";
import { redisTools } from "@/lib/redisTools";
import { utf8ToBytes } from "@noble/hashes/utils";
import { walletAlreadyClaimedByOtherUser } from "@/db/modules/tokenCampaignClaimOnion.db";
import { logger } from "@/server/utils/logger";
import { WALLET_FACTORIES } from "../utils/ walletFactories";

const proofSchema = z.object({
  address: z.string(),
  timestamp: z.number(),
  domain: z.object({
    lengthBytes: z.number(),
    value: z.string(),
  }),
  payload: z.string(),
  signature: z.string(),
  state_init: z.string().optional(),
});
/* ------------------------------------------------------------------ */
/*  Router                                                            */
/* ------------------------------------------------------------------ */
export const tonProofRouter = router({
  /* -------------------------------------------------------------- */
  /* 1. Create payload                                              */
  generatePayload: initDataProtectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.user_id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const challenge = crypto.randomUUID();
    await redisTools.setCache(`tp:${challenge}`, String(userId), 60);

    const timestamp = Math.floor(Date.now() / 1e3);
    const payload = `onton:${userId}:${challenge}:${timestamp}`;

    return { payload }; // plain string
  }),

  /* -------------------------------------------------------------- */
  /* 2. Verify proof                                                */
  verifyProof: initDataProtectedProcedure
    .input(
      z.object({
        address: z.string(),
        network: z.enum(["-239", "-3"]),
        public_key: z.string(), // hex, as provided by Ton-Connect
        proof: proofSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      /* ─────────────────────────────── quick / structural checks */
      const userId = ctx.user.user_id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      /* 0) has this wallet already been claimed by someone else? */
      if (await walletAlreadyClaimedByOtherUser(input.address, userId)) {
        throw new TRPCError({
          code: "CONFLICT", // 409 – fits “resource in use”
          message: "This wallet has already been linked to another user.",
        });
      }
      /* 1) same bounce-false address in params & inside proof */
      const addrReq = Address.parse(input.address).toString({ bounceable: false });
      const addrPro = Address.parse(input.proof.address).toString({ bounceable: false });
      if (addrReq !== addrPro) {
        throw new TRPCError({ code: "FORBIDDEN", message: "address mismatch" });
      }

      /* 2) allowed domain + freshness (±60 s) */
      if (!ALLOWED_DOMAINS.includes(input.proof.domain.value)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "domain not allowed" });
      }
      const age = Math.floor(Date.now() / 1e3) - input.proof.timestamp;
      if (Math.abs(age) > VALID_AGE_SEC) {
        throw new TRPCError({ code: "FORBIDDEN", message: "proof too old" });
      }

      /* ─────────────────────────────── public-key discovery      */

      let pubKey: Uint8Array | null = null;

      /* a) fast path – key inside state-init supplied by wallet  */
      if (input.proof.state_init) {
        const st = loadStateInit(Cell.fromBase64(input.proof.state_init).beginParse());
        pubKey = tryParsePublicKey(st) ?? null;
      }

      /* b) fallback – invoke ‘get_public_key’ on-chain           */
      if (!pubKey) {
        const endpoint = input.network === "-239" ? "https://mainnet-v4.tonhubapi.com" : "https://testnet-v4.tonhubapi.com";
        const api = new TonClient4({ endpoint });
        logger.log(`Using TON API endpoint: ${endpoint}`);
        try {
          const blk = await api.getLastBlock();
          const res = await api.runMethod(blk.last.seqno, Address.parse(input.address), "get_public_key", []);
          pubKey = hexToU8(res.reader.readBigNumber().toString(16).padStart(64, "0"));
        } catch {
          /* ignore – some wallets aren’t deployed yet             */
          logger.warn(`Failed to get public key for address ${input.address} on network ${input.network}`);
        }
      }

      /* c) compare with key Ton-Connect gave us                  */
      const suppliedBuf = Buffer.from(input.public_key, "hex");
      const addr = Address.parse(input.address);
      if (!pubKey) {
        let matched = false;

        for (const wf of WALLET_FACTORIES) {
          const wallet = wf.create({ workchain: addr.workChain, publicKey: suppliedBuf });

          if (wallet.address.equals(addr)) {
            logger.log(`Wallet template matched: ${wf.name}`);
            pubKey = suppliedBuf; // accept
            matched = true;
            break;
          }
        }

        if (!matched) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "public-key ↔ address mismatch (no wallet template fits)",
          });
        }
      }
      if (!pubKey) {
        throw new TRPCError({ code: "FORBIDDEN", message: "pub-key not found" });
      }
      if (!u8eq(pubKey, suppliedBuf)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "pub-key mismatch" });
      }

      /* d) optional: state-init ↔ address hash check             */
      if (input.proof.state_init) {
        const st = loadStateInit(Cell.fromBase64(input.proof.state_init).beginParse());
        const calcAddr = contractAddress(Address.parse(input.address).workChain, st);
        if (!calcAddr.equals(Address.parse(input.address))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "state_init mismatch" });
        }
      }

      /* ─────────────────────────────── cryptographic signature   */
      const body = buildSignedBody({
        address: Address.parse(input.address),
        domainLength: input.proof.domain.lengthBytes,
        domainValue: utf8ToBytes(input.proof.domain.value),
        timestamp: input.proof.timestamp,
        payload: utf8ToBytes(input.proof.payload),
      });

      if (!ed25519Verify(body, input.proof.signature, input.public_key)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid TON-Proof signature",
        });
      }

      /* ─────────────────────────────── success → real JWT        */
      const token = await createAuthToken({
        address: input.address,
        network: input.network,
      });

      return { token };
    }),
});
