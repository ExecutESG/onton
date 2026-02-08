/* server/trpc/raffleRouter.ts  –  ONE router for both TON + multi-merch  */

import { router, eventManagementProtectedProcedure, initDataProtectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { Address } from "@ton/ton";
import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import eventRafflesDB from "@/db/modules/eventRaffles.db";
import eventRaffleResultsDB from "@/db/modules/eventRaffleResults.db";
import eventMerchRafflesDB from "@/db/modules/eventMerchRaffles.db";
import eventMerchPrizesDB from "@/db/modules/eventMerchPrizes.db";
import eventMerchPrizeResultsDB from "@/db/modules/eventMerchPrizeResults.db";
import { eventRaffles, RaffleStatusType } from "@/db/schema/eventRaffles";
import raffleTokensDB from "@/db/modules/raffleTokens.db";

import { db } from "@/db/db";

import { fetchTonBalance } from "@/lib/tonBalance";
import { amountToUnits } from "@/lib/tokenUnits";
import eventDB from "@/db/modules/events.db";
import { eventRegistrantsDB } from "@/db/modules/eventRegistrants.db";
import { v2_client } from "@/services/tonCenter";

export const ensureDateWindowOK = async (eventId: number): Promise<void> => {
  const event = await eventDB.getEventById(eventId);
  if (!event) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
  }

  const now = Date.now(); // ms
  const start = event.start_date * 1_000; // → ms

  /* event not yet started */
  if (now < start) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Raffle not open yet – event starts at ${new Date(start).toISOString()}`,
    });
  }
};

export const ensureRegistrationOK = async (eventId: number, userId: number): Promise<void> => {
  const event = await eventDB.getEventById(eventId);
  if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
  if (!event.has_registration) return;

  const reg = await eventRegistrantsDB.getRegistrantRequest(event.event_uuid, userId);
  const ok = reg && (reg.status === "approved" || reg.status === "checkedin");
  if (!ok) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This event requires an approved registration to participate in the raffle.",
    });
  }
};

const serialise = async (row: typeof eventRaffles.$inferSelect) => {
  const token = await raffleTokensDB.getTokenById(row.token_id);
  return {
    ...row,
    prize_pool_nanoton: row.prize_pool_nanoton ? row.prize_pool_nanoton.toString() : null,
    token: token
      ? {
          token_id: token.token_id,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          master_address: token.master_address,
          is_native: token.is_native,
          logo_url: token.logo_url,
        }
      : null,
  };
};

/* ───────── router ───────── */
export const raffleRouter = router({
  /* ───────────────── TON  ───────────────── */

  defineOrUpdate: eventManagementProtectedProcedure
    .input(
      z
        .object({
          event_uuid: z.string().uuid(),
          top_n: z.number().int().min(1).max(1000),
          prize_pool_amount: z.number().positive(),
          token_id: z.number().int().positive().optional(),
        })
        .superRefine((val, ctx) => {
          const perWinner = val.prize_pool_amount / val.top_n;
          if (!(perWinner > 0)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["prize_pool_amount"],
              message: "Per-winner amount must be greater than zero.",
            });
          }
        })
    )
    .mutation(async ({ input, ctx }) => {
      const eventId = ctx.event.event_id;
      const kind = ctx.event.raffleKind;
      if (kind === "merch")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already using merch raffle",
        });

      const tokenId = input.token_id ?? 1;
      const token = await raffleTokensDB.getTokenById(tokenId);
      if (!token) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown raffle token" });
      }

      const perWinner = input.prize_pool_amount / input.top_n;
      if (token.is_native && perWinner <= 0.02) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Per-winner amount must be greater than 0.02 TON. Your current per-winner amount is ${perWinner.toFixed(4)} TON.`,
        });
      }

      const poolNano = amountToUnits(input.prize_pool_amount, token.decimals ?? 0);
      if (poolNano <= BigInt(0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Prize pool must be greater than zero." });
      }

      const row = await eventRafflesDB.upsert(eventId, input.top_n, poolNano, tokenId);
      /* ❷ mark the event the first time */
      if (kind === null) {
        await eventDB.patchEvent(eventId, { raffleKind: "ton" });
      }
      return serialise(row);
    }),

  listTokens: eventManagementProtectedProcedure
    .input(z.object({ event_uuid: z.string().uuid() }))
    .query(async () => {
      const tokens = await raffleTokensDB.listTokens();
      return tokens.map((token) => ({
        token_id: token.token_id,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        master_address: token.master_address,
        is_native: token.is_native,
        logo_url: token.logo_url,
      }));
    }),

  /* ───────────────── MERCH  –  RAFFLE SHELL ───────────────── */

  ensureMerchRaffle: eventManagementProtectedProcedure
    .input(z.object({ event_uuid: z.string().uuid() }))
    .mutation(async ({ ctx }) => {
      const eventId = ctx.event.event_id;
      const kind = ctx.event.raffleKind;

      if (kind === "ton") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Event already uses TON raffle" });
      }

      /* ❶ create merch raffle directly bound to the event */
      let merch = await eventMerchRafflesDB.fetchByEvent(eventId);
      if (!merch) merch = await eventMerchRafflesDB.createForEvent(eventId);

      /* ❷ mark the event the first time */
      if (kind === null && merch) {
        await eventDB.patchEvent(eventId, { raffleKind: "merch" });
      }
      return merch;
    }),

  /* ───────────────── MERCH  –  PRIZE CRUD ───────────────── */

  saveMerchPrize: eventManagementProtectedProcedure
    .input(
      z.object({
        merch_raffle_uuid: z.string().uuid(),
        merch_prize_id: z.number().optional(), // undefined → create
        item_name: z.string().min(3),
        item_description: z.string().optional(),
        image_url: z.string().url().nullable().optional(),
        top_n: z.number().int().min(1).max(1000),
        fulfil_method: z.enum(["ship", "pickup"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const eventId = ctx.event.event_id;
      const kind = ctx.event.raffleKind;

      const raffle = await eventMerchRafflesDB.fetchMerchRaffleByUuid(input.merch_raffle_uuid);
      if (!raffle) throw new TRPCError({ code: "NOT_FOUND" });
      if (kind === "ton") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Event already uses TON raffle" });
      }
      const base = {
        item_name: input.item_name,
        item_description: input.item_description ?? null,
        image_url: input.image_url ?? null,
        top_n: input.top_n,
        fulfil_method: input.fulfil_method,
        need_shipping: input.fulfil_method === "ship",
      };
      /* ❷ mark the event the first time */
      if (kind === null) {
        await eventDB.patchEvent(eventId, { raffleKind: "merch" });
      }
      return input.merch_prize_id
        ? eventMerchPrizesDB.updatePrize(input.merch_prize_id, base)
        : eventMerchPrizesDB.createPrize(raffle.merchRaffleId, base);
    }),

  /* ───────────────── ORGANISER  –  DASHBOARDS ───────────────── */
  infoForOrganizer: eventManagementProtectedProcedure.query(async ({ ctx }) => {
    /* this endpoint is only for TON giveaways */
    if (ctx.event.raffleKind !== "ton") return null;

    /* 1️⃣ TON-raffle row */
    const raffle = await eventRafflesDB.fetchRaffleByEvent(ctx.event.event_id);
    if (!raffle) return null; // nothing defined yet

    /* 2️⃣ DB summary (unchanged) */
    const summary = await eventRafflesDB.getRaffleSummaryForOrganizer(raffle.raffle_uuid);
    if (!summary) throw new TRPCError({ code: "NOT_FOUND", message: "raffle disappeared" });

    /* 3️⃣ live deployment probe (balance already calculated inside summary) */
    let deployed = false;
    if (summary.wallet.address) {
      try {
        const provider = v2_client().provider(Address.parse(summary.wallet.address));
        const st: any = await provider.getState();
        deployed = st?.state === "active";
      } catch {
        deployed = false;
      }
    }
    Object.assign(summary.wallet as any, {
      deployed,
    });

    return summary;
  }),

  /* Lightweight wallet balance probe (v2-backed) */
  getWalletBalance: eventManagementProtectedProcedure
    .input(
      z.object({
        address: z.string().min(36).max(66), // user-friendly or raw
      })
    )
    .query(async ({ input }) => {
      // Reuse the shared helper with caching and v2 fallback
      const balanceNano = await fetchTonBalance(input.address);
      return {
        address: input.address,
        balanceNano: balanceNano.toString(),
        balanceTon: Number(balanceNano) / 1e9,
      };
    }),

  /* ───────────────────────── organiser – merch raffle ───────────────────────── */
  infoForOrganizerMerch: eventManagementProtectedProcedure.query(async ({ ctx }) => {
    /* endpoint only valid for merch raffles */
    if (ctx.event.raffleKind !== "merch") return null;

    /* 1️⃣ existing merch-raffle row – DO NOT auto-create */
    const merchRaffle = await eventMerchRafflesDB.fetchByEvent(ctx.event.event_id);
    if (!merchRaffle) return null; // nothing defined yet

    /* 2️⃣ prizes + winners */
    const rawPrizes = await eventMerchPrizesDB.listPrizesForRaffle(merchRaffle.merchRaffleId);
    const prizes = await Promise.all(rawPrizes.map((p) => eventMerchPrizesDB.getPrizeWithWinners(p.merch_prize_id)));

    return { raffle: merchRaffle, prizes };
  }),

  /* ------------------------------------------------------------------ */
  /*  TON giveaway – trigger                                             */
  /* ------------------------------------------------------------------ */
  trigger: eventManagementProtectedProcedure
    .input(z.object({ raffle_uuid: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const raffle = await eventRafflesDB.fetchRaffleByUuid(input.raffle_uuid);
      if (!raffle || raffle.status !== "funded") throw new TRPCError({ code: "BAD_REQUEST" });

      /* <-- use the helper */
      const fundingSnapshot = await eventRafflesDB.getRaffleSummaryForOrganizer(raffle.raffle_uuid);
      if (!fundingSnapshot?.funding?.tonSufficient || !fundingSnapshot.funding.tokenSufficient) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Raffle wallet is not fully funded.",
        });
      }

      const n = await eventRaffleResultsDB.countParticipantsForRaffle(raffle.raffle_id);
      if (n === 0)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No eligible participants yet",
        });

      await db.transaction(async (tx) => {
        await eventRaffleResultsDB.setEligibilityForRaffle(tx, raffle.raffle_id, raffle.top_n);
        await tx
          .update(eventRaffles)
          .set({ status: "distributing", updated_at: new Date() })
          .where(eq(eventRaffles.raffle_id, raffle.raffle_id));
      });

      return { ok: true };
    }),

  /* ------------------------------------------------------------------ */
  /*  Merch prize – trigger                                              */
  /* ------------------------------------------------------------------ */
  triggerMerchPrize: eventManagementProtectedProcedure
    .input(z.object({ merch_prize_id: z.number() }))
    .mutation(async ({ input }) => {
      /* ① fetch prize */
      const prize = await eventMerchPrizesDB.fetchPrizeById(input.merch_prize_id);
      if (!prize || prize.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Prize is closed" });
      }

      /* ② un-assigned pool for this raffle (new helper!) */
      const pool = await eventMerchPrizeResultsDB.fetchUnassignedScores(prize.merch_raffle_id);
      if (pool.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No participants yet",
        });
      }

      /* ③ top-N by score DESC */
      const winners = pool.slice(0, prize.top_n);

      /* ④ assign prize + rank */
      await Promise.all(
        winners.map((row, i) =>
          eventMerchPrizeResultsDB.assignPrize({
            id: row.id,
            merch_prize_id: prize.merch_prize_id,
            rank: i + 1,
            status: "pending",
          })
        )
      );

      /* ⑤ flip status */
      await eventMerchPrizesDB.updatePrize(prize.merch_prize_id, {
        status: "distributing",
      });

      return { ok: true };
    }),

  // src/server/routers/raffle.ts  (or wherever you keep the router)

  listMerchPrizes: initDataProtectedProcedure
    .input(z.object({ merch_raffle_uuid: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      /* 1 . raffle & prizes ------------------------------------------------- */
      const raffle = await eventMerchRafflesDB.fetchMerchRaffleByUuid(input.merch_raffle_uuid);
      if (!raffle) throw new TRPCError({ code: "NOT_FOUND" });
      await ensureRegistrationOK(raffle.eventId, user.user_id);

      const prizes = await eventMerchPrizesDB.listPrizesForRaffle(raffle.merchRaffleId);

      /* 2 . un-assigned row for this viewer (only one per raffle) ----------- */
      let myUnassigned: Awaited<ReturnType<typeof eventMerchPrizeResultsDB.fetchUnassignedRow>> | null = null;
      if (user) {
        myUnassigned = await eventMerchPrizeResultsDB.fetchUnassignedRow({
          merch_raffle_id: raffle.merchRaffleId,
          user_id: user.user_id,
        });
      }

      /* 3 . decorate every prize ------------------------------------------- */
      const rows = await Promise.all(
        prizes.map(async (p) => {
          /* winners – only after completion */
          const winners =
            p.status === "completed" ? await eventMerchPrizeResultsDB.getPrizeWithWinners(p.merch_prize_id) : [];

          /* guests – show *everyone* while prize still open */
          const guests =
            p.status === "completed"
              ? [] // hide after winners picked
              : await eventMerchPrizeResultsDB.listParticipantsForPrize(p.merch_prize_id);

          /* viewer row: look for exact prize row first, fall back to un-assigned */
          let my: typeof myUnassigned | null = null;
          if (user) {
            my =
              (await eventMerchPrizeResultsDB.fetchUserRow({
                merch_prize_id: p.merch_prize_id,
                user_id: user.user_id,
              })) || myUnassigned;
          }

          return { prize: p, winners, guests, my };
        })
      );

      return { raffle, prizes: rows };
    }),

  /* ───────────────── TON GIVE-AWAY  (unchanged logic) ───────────────── */
  /* ───────── spinTon mutation ───────── */
  spinTon: initDataProtectedProcedure
    .input(
      z.object({
        raffle_uuid: z.string().uuid(), // TON-raffle UUID
        wallet_address: z.string().min(36).max(48), // user wallet (bounce/-f)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      /* 1. load raffle */
      const raffle = await eventRafflesDB.fetchRaffleByUuid(input.raffle_uuid);
      if (!raffle || ["distributing", "completed"].includes(raffle.status)) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      /* 2. already spun? – return the saved score */
      const existed = await eventRaffleResultsDB.fetchUserScore(raffle.raffle_id, user.user_id);
      if (existed) {
        return { alreadyPlayed: true, score: existed.score };
      }

      /* 3. date window check */
      await ensureDateWindowOK(raffle.event_id);
      await ensureRegistrationOK(raffle.event_id, user.user_id);

      /* 4. create & store score */
      const score = randomInt(1, 1_000_000);
      const parsed = Address.parse(input.wallet_address);
      const addrRaw = `${parsed.workChain}:${parsed.hash.toString("hex")}`;

      await eventRaffleResultsDB.addUserScore({
        raffle_id: raffle.raffle_id,
        user_id: user.user_id,
        score,
        wallet_address: addrRaw,
      });

      /* 5. copy score into all merch-prizes of the same event (if any) */
      const merch = await eventMerchRafflesDB.fetchByEvent(raffle.event_id);
      if (merch) {
        const prizes = await eventMerchPrizesDB.listPrizesForRaffle(merch.merchRaffleId);
        await Promise.all(
          prizes.map((p) =>
            eventMerchPrizeResultsDB.addUserScore({
              merch_raffle_id: merch.merchRaffleId,
              user_id: user.user_id,
              score,
            })
          )
        );
      }

      /* 6. recompute TON top-N */
      await eventRaffleResultsDB.computeTopN(raffle.raffle_id, raffle.top_n);

      return { alreadyPlayed: false, score };
    }),

  /* ───────────────── MERCH RAFFLE (no wallet needed) ───────────────── */
  spinMerch: initDataProtectedProcedure
    .input(z.object({ merch_raffle_uuid: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      /* ① raffle */
      const merch = await eventMerchRafflesDB.fetchMerchRaffleByUuid(input.merch_raffle_uuid);
      if (!merch) throw new TRPCError({ code: "NOT_FOUND" });

      /* ② already spun?  ─── any row, assigned or not */
      const existing = await eventMerchPrizeResultsDB.fetchRowByRaffleAndUser({
        merch_raffle_id: merch.merchRaffleId,
        user_id: user.user_id,
      });
      if (existing) return { alreadyPlayed: true, score: existing.score };

      /* ③ date window */
      await ensureDateWindowOK(merch.eventId);
      await ensureRegistrationOK(merch.eventId, user.user_id);

      /* ④ single score row (un-assigned) */
      const score = randomInt(1, 1_000_000);
      await eventMerchPrizeResultsDB.addUserScore({
        merch_raffle_id: merch.merchRaffleId,
        user_id: user.user_id,
        score,
      });

      return { alreadyPlayed: false, score };
    }),

  /* ───────────────── USER VIEWS ───────────────── */

  view: initDataProtectedProcedure
    .input(z.object({ raffle_uuid: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const raffle = await eventRafflesDB.fetchRaffleByUuid(input.raffle_uuid);
      if (!raffle) throw new TRPCError({ code: "NOT_FOUND" });
      await ensureRegistrationOK(raffle.event_id, ctx.user.user_id);
      return eventRaffleResultsDB.getUserView(input.raffle_uuid, ctx.user.user_id);
    }),

  viewMerchPrize: initDataProtectedProcedure.input(z.object({ merch_prize_id: z.number() })).query(({ ctx, input }) =>
    eventMerchPrizeResultsDB.getPrizeWithWinners(input.merch_prize_id).then((r) => {
      if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "prize missing" });
      return {
        prize: r.prize,
        my: r.winners.find((w) => w.user_id === ctx.user.user_id) ?? null,
      };
    })
  ),
  submitShippingInfo: initDataProtectedProcedure
    .input(
      z.object({
        merch_prize_id: z.number(),
        full_name: z.string().min(3).max(80),
        shipping_address: z.string().min(10).max(255),
        zip_code: z.string().min(3).max(16),
        phone: z.string().min(6).max(32),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // ① locate winner row
      const row = await eventMerchPrizeResultsDB.fetchUserRow({
        merch_prize_id: input.merch_prize_id,
        user_id: user.user_id,
      });
      if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "Not a winner of this prize" });

      // ② fetch prize to know fulfil-method
      const prize = await eventMerchPrizesDB.fetchPrizeById(input.merch_prize_id);
      if (!prize) throw new TRPCError({ code: "NOT_FOUND" });

      // ③ write address / phone
      await eventMerchPrizeResultsDB.setContactInfo({
        merch_prize_id: input.merch_prize_id,
        user_id: user.user_id,
        full_name: input.full_name,
        shipping_address: input.shipping_address,
        zip_code: input.zip_code,
        phone: input.phone,
      });

      // ④ bump status for pickup flow

      return { ok: true };
    }),

  /* ───────────────── ORGANISER – update shipping state ──────────── */
  updateMerchPrizeShipping: eventManagementProtectedProcedure
    .input(
      z
        .object({
          event_uuid: z.string().uuid(),
          merch_prize_result_id: z.number(),
          action: z.enum(["ship", "deliver", "collect"]),
          tracking_number: z.string().max(120).optional(),
        })
        .refine((v) => (v.action === "ship" ? Boolean(v.tracking_number && v.tracking_number.trim().length > 0) : true), {
          message: "Tracking number is required to mark as shipped",
          path: ["tracking_number"],
        })
    )
    .mutation(async ({ input, ctx }) => {
      // Authorization: ensure the result belongs to the current event
      const row = await eventMerchPrizeResultsDB.fetchResultWithPrizeAndEvent(input.merch_prize_result_id);
      if (!row || !row.event_id || row.event_id !== ctx.event.event_id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Result not in this event" });
      }

      // Business rule checks by action
      if (input.action === "ship") {
        if (row.status !== "awaiting_shipping") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Result not awaiting shipping" });
        }
        await eventMerchPrizeResultsDB.markPrizeShipped(input.merch_prize_result_id, input.tracking_number ?? null);
      } else if (input.action === "deliver") {
        if (row.status !== "shipped") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Result not shipped yet" });
        }
        await eventMerchPrizeResultsDB.markPrizeDelivered(input.merch_prize_result_id);
      } else if (input.action === "collect") {
        if (row.status !== "awaiting_pickup") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Result not awaiting pickup" });
        }
        await eventMerchPrizeResultsDB.markPrizeCollected(input.merch_prize_result_id);
      }
      return { ok: true };
    }),
});
