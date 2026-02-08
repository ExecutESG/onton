import { generateRandomHash } from "@/lib/generateRandomHash";
import { affiliateLinksDB } from "@/db/modules/affiliateLinks.db";
import { partnershipAffiliatePurchasesDB } from "@/db/modules/partnershipAffiliatePurchases.db";
import { initDataProtectedProcedure, router } from "../trpc";
import { TRPCError } from "@trpc/server";
import { PARTNER_ONION_CAP, TBOOK_FAIRLAUNCH_MINIAPP_URL } from "@/constants";

export const affiliateRouter = router({
  getFairlaunchAffiliate: initDataProtectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.user_id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    /* 1) fetch or create this user’s link */
    let link = await affiliateLinksDB.getAffiliateLinkForType(userId, "fairlaunch-partnership");
    if (!link) {
      link = await affiliateLinksDB.createAffiliateLinkByType(
        `fairlaunch-partnership-${userId}`,
        "fairlaunch-partnership",
        userId,
        generateRandomHash(8),
        "fairlaunch-partnership"
      );
    }

    /* 2) all purchases credited to THIS link */
    const purchasesRaw = await partnershipAffiliatePurchasesDB.getPurchasesByLinkId(link.id, { limit: 500 });

    /* 3) enrich rows (UI convenience) */
    const purchases = purchasesRaw.map((p) => ({
      id: p.id,
      walletAddress: p.walletAddress,
      walletLink: `https://tonviewer.com/${p.walletAddress}`,
      telegramUserId: p.userEntry === "telegram" ? p.telegramUserId : null,
      telegramUserName: p.userEntry === "telegram" ? p.telegramUserName : null,
      telegramLink: p.userEntry === "telegram" && p.telegramUserName ? `https://t.me/${p.telegramUserName}` : null,
      usdtAmount: p.usdtAmount,
      onionAmount: p.onionAmount,
      timeOfBought: p.timeOfBought,
      userEntry: p.userEntry,
    }));

    /* 4) per‑user totals */
    const currentTotals = purchasesRaw.reduce(
      (acc, p) => {
        acc.usdt += Number(p.usdtAmount);
        acc.onion += Number(p.onionAmount);
        return acc;
      },
      { usdt: 0, onion: 0 }
    );

    /* 5) GLOBAL totals (for progress bar) */
    const globalTotals = await partnershipAffiliatePurchasesDB.getGlobalTotals();
    const onionSoldGlobal = globalTotals.onion;
    const progressPct = Math.min((onionSoldGlobal / PARTNER_ONION_CAP) * 100, 100);
    //engage.tbook.com/fair-launch/onion?partner=tol
    /* 6) shareable deep link */
    const botUser = process.env.NEXT_PUBLIC_BOT_USERNAME || "theontonbot";
    const url = `${TBOOK_FAIRLAUNCH_MINIAPP_URL}?partner=${link.linkHash}`;

    return {
      ...link,
      url,
      purchases,
      currentTotals, // ← user‑specific totals
      globalTotals, // ← community totals
      capInfo: {
        totalCap: PARTNER_ONION_CAP,
        onionSold: onionSoldGlobal,
        progressPct,
      },
    };
  }),
});
