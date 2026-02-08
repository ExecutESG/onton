import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/db";
import { logger } from "@/server/utils/logger";

import { eventMerchPrizeResults as r } from "@/db/schema/eventMerchPrizeResults";
import { eventMerchPrizes as p } from "@/db/schema/eventMerchPrizes";
import { eventMerchRaffles as rf } from "@/db/schema/eventMerchRaffles";
import { events as e } from "@/db/schema/events";
import { users as u } from "@/db/schema/users";

import { sendTelegramWithRetryRaffle } from "../helper/sendTelegramWithRetryRaffle";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function safeFullName(usr: { username?: string | null; first_name?: string | null; last_name?: string | null }) {
  const combo = [usr.first_name, usr.last_name].filter(Boolean).join(" ").trim();
  return usr.username ?? (combo || "there");
}

function raffleLink(eventUuid: string, raffleUuid: string) {
  const bot = process.env.NEXT_PUBLIC_BOT_USERNAME ?? process.env.BOT_USERNAME ?? "TonEventsBot";
  return `https://t.me/${bot}/event?startapp=${eventUuid}-merch-raffle-${raffleUuid}`;
}

function makeMessage(args: { who: string; item: string; fulfil: "ship" | "pickup"; event: string; link: string }) {
  if (args.fulfil === "pickup") {
    return (
      `🎉 Hi ${args.who}!\n\n` +
      `You’ve won **${args.item}** in the *${args.event}* merch raffle.\n` +
      `Please open the link below, confirm your details, then come to the pick-up desk and show this message.\n\n` +
      `${args.link}\n\n` +
      `Congratulations!\n— The organisers`
    );
  }

  /* ship */
  return (
    `🎉 Hi ${args.who}!\n\n` +
    `You’ve won **${args.item}** in the *${args.event}* merch raffle.\n` +
    `Tap the link below and fill in your shipping address (name, street, city, ZIP, phone) so we can dispatch your prize.\n\n` +
    `${args.link}\n\n` +
    `Congratulations!\n— The organisers`
  );
}

/* ------------------------------------------------------------------ */
/* main entry – execute from cron                                     */
/* ------------------------------------------------------------------ */

export async function sendAllPendingPrizeNotifications() {
  /* 1 . fetch every winner still waiting for a DM ------------------- */
  const winners = await db
    .select({
      id: r.id,
      user_id: r.user_id,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,

      fulfil_method: p.fulfil_method,
      item_name: p.item_name,

      event_title: e.title,
      event_uuid: e.event_uuid,

      merchRaffleUuid: rf.merchRaffleUuid,
    })
    .from(r)
    .innerJoin(u, eq(u.user_id, r.user_id))
    .innerJoin(p, eq(p.merch_prize_id, r.merch_prize_id))
    .innerJoin(rf, eq(rf.merchRaffleId, p.merch_raffle_id))
    .innerJoin(e, eq(e.event_id, rf.eventId))
    .where(
      and(
        eq(r.notif_status, "waiting"),
        isNotNull(r.rank) // winners only
      )
    );

  if (winners.length === 0) {
    logger.info("[notif] nothing to send – queue empty");
    // return { sent: 0, failed: 0 };
  }

  /* 2 . iterate & DM ----------------------------------------------- */
  let sent = 0;
  let failed = 0;

  for (const w of winners) {
    const chat_id = w.user_id;
    const link = raffleLink(w.event_uuid, w.merchRaffleUuid);

    const text = makeMessage({
      who: safeFullName(w),
      item: w.item_name,
      fulfil: w.fulfil_method,
      event: w.event_title,
      link,
    });

    try {
      await sendTelegramWithRetryRaffle({ chat_id, message: text });

      await db.update(r).set({ notif_status: "sent", notif_sent_at: new Date() }).where(eq(r.id, w.id));

      sent++;
    } catch (err) {
      await db
        .update(r)
        .set({
          notif_status: "failed",
          error: String(err).slice(0, 200),
        })
        .where(eq(r.id, w.id));

      logger.error(`[notif] DM to ${chat_id} failed – ${err}`);
      failed++;
    }
  }

  logger.info(`[notif] complete – sent ${sent}, failed ${failed}`);
  // return { sent, failed };
  return;
}
