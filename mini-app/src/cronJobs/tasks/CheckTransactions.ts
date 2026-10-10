import { config } from "@/server/config";
import { logger } from "@/server/utils/logger";
import { db } from "@/db/db";
import { walletChecks } from "@/db/schema/walletChecks";
import { and, eq, or } from "drizzle-orm";
import tonCenter from "@/services/tonCenter";
import { Address } from "@ton/core";
import { orders } from "@/db/schema/orders";
import { tokenCampaignOrders, TokenCampaignOrdersStatus, eventPayment } from "@/db/schema";
import { eventTokens } from "@/db/schema/eventTokens";
import { publishOrderPaidEvent } from "@/lib/orderEvents";
import { verifyFeeSplitTrace } from "@/lib/platformFee";

export const CheckTransactions = async () => {
  // Get Orders to be Checked (Sort By Order.TicketDetails.Id)
  // Get Order.TicketDetails Wallet
  // Get Transactions From Past 30 Minutes
  // Update (DB) Paid Ones as paid others as failed
  // logger.log("@@@@ CheckTransactions  @@@@");

  const wallet_address = config?.ONTON_WALLET_ADDRESS;
  const campaign_wallet_address = config?.ONTON_WALLET_ADDRESS_CAMPAIGN;
  const minter_wallet_address = config?.ONTON_MINTER_WALLET;

  if (!wallet_address || !campaign_wallet_address || !minter_wallet_address) {
    logger.error("ONTON_WALLET_ADDRESS/CAMPAIGN/MINTER NOT SET");
    return;
  }
  const hour_ago = Math.floor((Date.now() - 3600 * 9 * 1000) / 1000);
  const wallet_checks_details = await db
    .select({ checked_lt: walletChecks.checked_lt })
    .from(walletChecks)
    .where(eq(walletChecks.wallet_address, wallet_address || ""))
    .execute();

  let start_lt = null;
  if (wallet_checks_details && wallet_checks_details.length) {
    if (wallet_checks_details[0]?.checked_lt) {
      start_lt = wallet_checks_details[0].checked_lt + BigInt(1);
    }
  }

  const start_utime = start_lt ? null : hour_ago;

  const transactions = await tonCenter.fetchAllTransactions(wallet_address, start_utime, start_lt);

  const parsed_orders = await tonCenter.parseTransactions(transactions, "onton_order=");

  const paymentTokens = await db.select().from(eventTokens).execute();
  const tokensById = new Map(paymentTokens.map((token) => [token.token_id, token]));
  logger.log("cron_trx_ fetched", parsed_orders.length, "transactions since", start_lt || start_utime, parsed_orders);
  const normalise = (addr?: string | null) => {
    if (!addr) return null;
    try {
      return Address.parse(addr).toRawString();
    } catch {
      return addr; // fallback to original if parsing fails
    }
  };

  let minPendingLt: bigint | null = null;

  for (const o of parsed_orders) {
    const orderRow = await db.query.orders.findFirst({ where: eq(orders.uuid, o.order_uuid) });
    if (!orderRow) continue;
    const token = tokensById.get(orderRow.token_id);
    if (!token) continue;
    const orderTokenIsJetton = Boolean(token.master_address && token.master_address.length > 0);
    if (orderTokenIsJetton) {
      if (o.kind !== "jetton") {
        logger.warn("cron_trx_kind_mismatch", { uuid: o.order_uuid, expected: "jetton", got: o.kind });
        continue;
      }
      const orderMaster = normalise(token.master_address);
      const txMaster = normalise(o.jettonMaster);
      if (orderMaster && txMaster && orderMaster !== txMaster) {
        logger.warn("cron_trx_master_mismatch", { uuid: o.order_uuid, orderMaster, txMaster });
        continue;
      }
    } else {
      if (o.kind !== "ton") {
        logger.warn("cron_trx_kind_mismatch", { uuid: o.order_uuid, expected: "ton", got: o.kind });
        continue;
      }
    }
    const decimals = token.decimals ?? 0;
    const txRawAmount = BigInt(o.rawAmount.toString());
    const expectedRawAmount = BigInt(Math.round(Number(orderRow.total_price ?? 0) * 10 ** decimals));

    // Allow at most 1000 nanotons (1e-6 TON) tolerance for minor network rounding if applicable
    const maxTolerance = decimals >= 6 ? BigInt(10 ** (decimals - 6)) : BigInt(1);

    const hasFeeSplit = orderRow.platform_fee_raw !== null && orderRow.organizer_amount_raw !== null;
    const expectedTreasuryAmount = hasFeeSplit ? orderRow.platform_fee_raw! : expectedRawAmount;

    const diffRaw =
      txRawAmount > expectedTreasuryAmount
        ? txRawAmount - expectedTreasuryAmount
        : expectedTreasuryAmount - txRawAmount;

    if (diffRaw > maxTolerance) {
      logger.warn("cron_trx_amount_mismatch", {
        uuid: o.order_uuid,
        expectedRaw: expectedTreasuryAmount.toString(),
        txRaw: txRawAmount.toString(),
        diffRaw: diffRaw.toString(),
      });
      continue;
    }

    if (hasFeeSplit) {
      const paymentInfo = await db.query.eventPayment.findFirst({
        where: eq(eventPayment.event_uuid, orderRow.event_uuid!),
      });

      if (!paymentInfo?.recipient_address) {
        logger.warn("cron_trx_recipient_missing", { uuid: o.order_uuid });
        continue;
      }

      let trace: any = null;
      try {
        trace = await tonCenter.fetchTrace(o.trx_hash);
      } catch (traceErr) {
        logger.warn("cron_trx_trace_fetch_failed", { uuid: o.order_uuid, error: traceErr });
        if (o.lt) {
          if (minPendingLt === null || o.lt < minPendingLt) {
            minPendingLt = o.lt;
          }
        }
        continue;
      }

      // If trace is empty or traces array is empty, indexer has not yet parsed trace tree; retry later
      if (!trace || (Array.isArray(trace?.traces) && trace.traces.length === 0)) {
        logger.warn("cron_trx_trace_empty_pending", { uuid: o.order_uuid });
        if (o.lt) {
          if (minPendingLt === null || o.lt < minPendingLt) {
            minPendingLt = o.lt;
          }
        }
        continue;
      }

      const traceVerification = verifyFeeSplitTrace({
        trace,
        orderUuid: o.order_uuid,
        expectedPlatformFeeRaw: orderRow.platform_fee_raw!,
        expectedOrganizerAmountRaw: orderRow.organizer_amount_raw!,
        recipientAddress: paymentInfo.recipient_address,
        treasuryAddress: wallet_address,
        isJetton: orderTokenIsJetton,
        expectedJettonMaster: token.master_address,
        decimals,
      });

      if (!traceVerification.valid) {
        logger.warn("cron_trx_fee_split_verification_failed", {
          uuid: o.order_uuid,
          reason: traceVerification.reason,
        });
        continue;
      }
    }

    const normalizedAmount = Number(txRawAmount) / 10 ** decimals;
    logger.log("cron_trx_", o.order_uuid, token.symbol, normalizedAmount, {
      order_state: orderRow.state,
      order_total: orderRow.total_price,
      token_id: orderRow.token_id,
      order_created: orderRow.created_at,
    });
    const updated = await db
      .update(orders)
      .set({ state: "processing", owner_address: o.owner.toString(), trx_hash: o.trx_hash, created_at: new Date() })
      .where(
        and(
          eq(orders.uuid, o.order_uuid),
          or(eq(orders.state, "new"), eq(orders.state, "confirming")),
          eq(orders.token_id, token.token_id)
        )
      )
      .returning({ uuid: orders.uuid });

    if (updated.length > 0) {
      // Sub-second fulfillment: publish order.paid event to RabbitMQ
      await publishOrderPaidEvent({
        orderUuid: o.order_uuid,
        eventUuid: orderRow.event_uuid || undefined,
        userId: orderRow.user_id ? Number(orderRow.user_id) : undefined,
        paymentMethod: token.symbol,
      });
    } else {
      logger.warn("cron_trx_update_skipped", {
        uuid: o.order_uuid,
        expectedAmount: normalizedAmount,
        orderAmount: orderRow.total_price,
        orderState: orderRow.state,
        tokenId: orderRow.token_id,
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                  Check Pending Fee-Waived Crypto Orders                    */
  /* -------------------------------------------------------------------------- */
  try {
    const pendingWaivedOrders = await db.query.orders.findMany({
      where: and(
        or(eq(orders.state, "new"), eq(orders.state, "confirming")),
        eq(orders.platform_fee_raw, BigInt(0))
      ),
    });

    for (const ord of pendingWaivedOrders) {
      if (Number(ord.total_price) <= 0 || !ord.event_uuid) continue;
      const paymentInfo = await db.query.eventPayment.findFirst({
        where: eq(eventPayment.event_uuid, ord.event_uuid),
      });
      if (!paymentInfo?.recipient_address) continue;
      const token = tokensById.get(ord.token_id);
      if (!token) continue;

      const recipientTrxs = await tonCenter.fetchAllTransactions(paymentInfo.recipient_address, hour_ago);
      const recipientOrders = await tonCenter.parseTransactions(recipientTrxs, "onton_order=");
      const matchingTrx = recipientOrders.find((ro) => ro.order_uuid === ord.uuid);
      if (!matchingTrx) continue;

      const decimals = token.decimals ?? 0;
      const maxTolerance = decimals >= 6 ? BigInt(10 ** (decimals - 6)) : BigInt(1);
      const expectedOrganizerAmount =
        ord.organizer_amount_raw ?? BigInt(Math.round(Number(ord.total_price) * 10 ** decimals));
      const diff =
        matchingTrx.rawAmount > expectedOrganizerAmount
          ? matchingTrx.rawAmount - expectedOrganizerAmount
          : expectedOrganizerAmount - matchingTrx.rawAmount;

      if (diff <= maxTolerance) {
        const updated = await db
          .update(orders)
          .set({
            state: "processing",
            owner_address: matchingTrx.owner.toString(),
            trx_hash: matchingTrx.trx_hash,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(orders.uuid, ord.uuid),
              or(eq(orders.state, "new"), eq(orders.state, "confirming"))
            )
          )
          .returning({ uuid: orders.uuid });

        if (updated.length > 0) {
          await publishOrderPaidEvent({
            orderUuid: ord.uuid,
            eventUuid: ord.event_uuid,
            userId: ord.user_id ? Number(ord.user_id) : undefined,
            paymentMethod: token.symbol,
          });
        }
      }
    }
  } catch (waivedErr) {
    logger.warn("cron_check_waived_orders_failed", waivedErr);
  }
  const campaign_wallet_checks_details = await db
    .select({ checked_lt: walletChecks.checked_lt })
    .from(walletChecks)
    .where(eq(walletChecks.wallet_address, campaign_wallet_address || ""))
    .execute();
  let campaign_start_lt = null;
  if (campaign_wallet_checks_details && campaign_wallet_checks_details.length) {
    if (campaign_wallet_checks_details[0]?.checked_lt) {
      campaign_start_lt = campaign_wallet_checks_details[0].checked_lt + BigInt(1);
    }
  }

  const campaign_start_utime = campaign_start_lt ? null : hour_ago;

  const campaign_transactions = await tonCenter.fetchAllTransactions(
    campaign_wallet_address,
    campaign_start_utime,
    campaign_start_lt
  );

  const parsed_campaign_orders = await tonCenter.parseTransactions(campaign_transactions, "OnionCampaign=");

  for (const co of parsed_campaign_orders) {
    const orderRow = await db.query.orders.findFirst({ where: eq(orders.uuid, co.order_uuid) });
    if (!co.verfied || !orderRow) continue;
    const token = tokensById.get(orderRow.token_id);
    if (!token) continue;
    if (co.order_uuid.length !== 36) {
      logger.error("cron_trx_campaign_ Invalid Order UUID", co.order_uuid);
      continue;
    }
    const decimals = token.decimals ?? 0;
    const amount = Number(co.rawAmount) / 10 ** decimals;
    const normalizedAmount = parseFloat(amount.toFixed(Math.min(decimals, 6)));
    logger.log("cron_trx_campaign_", co.order_uuid, token.symbol, normalizedAmount);
    await db
      .update(tokenCampaignOrders)
      .set({
        status: "processing" as TokenCampaignOrdersStatus, // or "completed", etc.
        trxHash: co.trx_hash,
        wallet_address: co.owner.toString(),
      })
      .where(
        and(
          eq(tokenCampaignOrders.uuid, co.order_uuid),
          or(
            eq(tokenCampaignOrders.status, "new"),
            eq(tokenCampaignOrders.status, "confirming"),
            eq(tokenCampaignOrders.status, "cancelled")
          )
        )
      )
      .execute();
  }
  //-- Finished Checking
  if (transactions && transactions.length) {
    const last_lt = BigInt(transactions[transactions.length - 1].lt);
    const newCheckedLt =
      minPendingLt !== null
        ? minPendingLt > BigInt(0)
          ? minPendingLt - BigInt(1)
          : BigInt(0)
        : last_lt;

    if (start_lt) {
      await db
        .update(walletChecks)
        .set({ checked_lt: newCheckedLt })
        .where(eq(walletChecks.wallet_address, wallet_address))
        .execute();
    } else {
      await db
        .insert(walletChecks)
        .values({ wallet_address: wallet_address, checked_lt: newCheckedLt })
        .onConflictDoUpdate({
          target: walletChecks.wallet_address,
          set: { checked_lt: newCheckedLt },
        })
        .execute();
    }
  }
  if (campaign_transactions && campaign_transactions.length) {
    const last_lt = BigInt(campaign_transactions[campaign_transactions.length - 1].lt);
    if (campaign_start_lt) {
      await db
        .update(walletChecks)
        .set({ checked_lt: last_lt })
        .where(eq(walletChecks.wallet_address, campaign_wallet_address))
        .execute();
    } else {
      await db
        .insert(walletChecks)
        .values({ wallet_address: campaign_wallet_address, checked_lt: last_lt })
        .onConflictDoUpdate({
          target: walletChecks.wallet_address,
          set: { checked_lt: last_lt },
        })
        .execute();
    }
  }
};
