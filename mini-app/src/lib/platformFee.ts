import { Address, Cell } from "@ton/core";

export type SupportedFeeCurrency = "TON" | "USDT";

export interface SplitResult {
  platformFeeRaw: bigint;
  organizerAmountRaw: bigint;
  feeBps: number;
}

export const MIN_FEE_TON_NANOTONS = BigInt(60000000); // 0.06 TON (60,000,000 nanotons)
export const MIN_FEE_USDT_MICROS = BigInt(250000); // 0.25 USDT (250,000 micro-USDT)
export const PLATFORM_FEE_BPS = 300; // 3% (300 bps)
export const STARS_FEE_BPS = 500; // 5% (500 bps)

const ZERO_BIGINT = BigInt(0);
const HALF_SCALE = BigInt(5000);
const BPS_SCALE = BigInt(10000);

/**
 * Computes non-custodial fee split for ticket orders (Issue #1034).
 *
 * Rules:
 * - 300 bps (3%) platform fee.
 * - Minimum fee: 0.06 TON (60,000,000 nanotons) or 0.25 USDT (250,000 micro-USDT).
 * - If feeWaiverTicketsRemaining > 0: fee is 0 bps, platformFeeRaw = 0, organizerAmountRaw = totalAmountRaw.
 * - platformFeeRaw + organizerAmountRaw strictly equals totalAmountRaw.
 */
export function computeSplit(
  totalAmountRaw: bigint,
  currency: SupportedFeeCurrency,
  feeWaiverTicketsRemaining: number
): SplitResult {
  if (totalAmountRaw <= ZERO_BIGINT) {
    return {
      platformFeeRaw: ZERO_BIGINT,
      organizerAmountRaw: ZERO_BIGINT,
      feeBps: feeWaiverTicketsRemaining > 0 ? 0 : PLATFORM_FEE_BPS,
    };
  }

  if (feeWaiverTicketsRemaining > 0) {
    return {
      platformFeeRaw: ZERO_BIGINT,
      organizerAmountRaw: totalAmountRaw,
      feeBps: 0,
    };
  }

  const minFee = currency === "TON" ? MIN_FEE_TON_NANOTONS : MIN_FEE_USDT_MICROS;

  // Round half-up: (amount * bps + 5000) / 10000
  const computedFee = (totalAmountRaw * BigInt(PLATFORM_FEE_BPS) + HALF_SCALE) / BPS_SCALE;
  const nominalFee = computedFee < minFee ? minFee : computedFee;
  const platformFeeRaw = nominalFee > totalAmountRaw ? totalAmountRaw : nominalFee;
  const organizerAmountRaw = totalAmountRaw - platformFeeRaw;

  return {
    platformFeeRaw,
    organizerAmountRaw,
    feeBps: PLATFORM_FEE_BPS,
  };
}

export interface VerifyTraceParams {
  trace: any;
  orderUuid: string;
  expectedPlatformFeeRaw: bigint;
  expectedOrganizerAmountRaw: bigint;
  recipientAddress: string;
  treasuryAddress: string;
  isJetton: boolean;
  expectedJettonMaster?: string | null;
  decimals?: number;
}

export interface VerifyTraceResult {
  valid: boolean;
  reason?: string;
  organizerAmountFound?: bigint;
  platformFeeFound?: bigint;
}

export const normaliseAddress = (addr?: string | null): string | null => {
  if (!addr) return null;
  try {
    return Address.parse(addr).toRawString();
  } catch {
    return addr.trim();
  }
};

/**
 * Helper to recursively flatten all transactions from a TonCenter v3 trace tree.
 */
export function extractTransactionsFromTrace(traceNode: any): any[] {
  if (!traceNode) return [];
  const results: any[] = [];

  if (Array.isArray(traceNode.traces)) {
    for (const t of traceNode.traces) {
      results.push(...extractTransactionsFromTrace(t));
    }
    return results;
  }

  if (Array.isArray(traceNode)) {
    for (const item of traceNode) {
      results.push(...extractTransactionsFromTrace(item));
    }
    return results;
  }

  if (traceNode.transaction) {
    results.push(traceNode.transaction);
  } else if (traceNode.hash || traceNode.in_msg || traceNode.out_msgs) {
    results.push(traceNode);
  }

  if (Array.isArray(traceNode.children)) {
    for (const child of traceNode.children) {
      results.push(...extractTransactionsFromTrace(child));
    }
  }

  return results;
}

/**
 * Helper to recursively flatten high-level actions if present in the trace.
 */
export function extractActionsFromTrace(traceNode: any): any[] {
  if (!traceNode) return [];
  const actions: any[] = [];

  if (Array.isArray(traceNode.actions)) {
    actions.push(...traceNode.actions);
  }
  if (Array.isArray(traceNode.traces)) {
    for (const t of traceNode.traces) {
      actions.push(...extractActionsFromTrace(t));
    }
  }
  if (Array.isArray(traceNode.children)) {
    for (const child of traceNode.children) {
      actions.push(...extractActionsFromTrace(child));
    }
  }

  return actions;
}

interface ParsedTransferInfo {
  destination: string | null;
  rawAmount: bigint;
  comment?: string | null;
  jettonMaster?: string | null;
  isJetton: boolean;
}

/**
 * Extracts all native and jetton transfers from trace transactions and actions.
 */
function extractTransfers(trace: any): ParsedTransferInfo[] {
  const transfers: ParsedTransferInfo[] = [];

  // 1. High-level actions (if present)
  const actions = extractActionsFromTrace(trace);
  for (const act of actions) {
    if (act.type === "jetton_transfer" || act.jetton_transfer) {
      const jt = act.jetton_transfer || act;
      const masterRaw =
        jt.jetton_master ||
        jt.jettonAddress ||
        (typeof jt.jetton === "string" ? jt.jetton : jt.jetton?.address);
      transfers.push({
        destination: normaliseAddress(jt.recipient || jt.destination),
        rawAmount: BigInt(jt.amount ?? 0),
        comment: jt.comment || jt.forward_payload?.comment || null,
        jettonMaster: normaliseAddress(masterRaw),
        isJetton: true,
      });
    } else if (act.type === "ton_transfer" || act.ton_transfer) {
      const tt = act.ton_transfer || act;
      transfers.push({
        destination: normaliseAddress(tt.recipient || tt.destination),
        rawAmount: BigInt(tt.amount ?? 0),
        comment: tt.comment || null,
        isJetton: false,
      });
    }
  }

  // 2. Low-level transactions
  const transactions = extractTransactionsFromTrace(trace);
  for (const tx of transactions) {
    const allMsgs = [...(tx.out_msgs || [])];
    if (tx.in_msg) allMsgs.push(tx.in_msg);

    for (const msg of allMsgs) {
      const dest = normaliseAddress(msg.destination);
      const opcode = msg.opcode;

      // Native TON transfer
      if (opcode === "0x00000000" || opcode === 0 || (!opcode && msg.value && Number(msg.value) > 0)) {
        let comment: string | null = null;
        if (msg.message_content?.decoded?.comment) {
          comment = msg.message_content.decoded.comment;
        } else if (msg.decoded?.comment) {
          comment = msg.decoded.comment;
        } else if (typeof msg.comment === "string") {
          comment = msg.comment;
        }

        const rawVal =
          typeof msg.value === "string"
            ? BigInt(msg.value.split(".")[0])
            : BigInt(Math.round(Number(msg.value ?? 0)));

        transfers.push({
          destination: dest,
          rawAmount: rawVal,
          comment,
          isJetton: false,
        });
      }

      // Jetton Transfer Notification (0x7362d09c) or Jetton Transfer (0x0f8a7ea5)
      if (opcode === "0x7362d09c" || opcode === "0x0f8a7ea5") {
        let jettonAmount: bigint = ZERO_BIGINT;
        let comment: string | null = null;
        let jettonMaster: string | null = null;
        let transferDest: string | null = opcode === "0x7362d09c" ? dest : null;

        // Try decoded fields first
        if (msg.jetton_amount !== undefined) {
          jettonAmount = BigInt(msg.jetton_amount);
        }
        if (msg.jetton_master) {
          jettonMaster = normaliseAddress(msg.jetton_master);
        }
        if (msg.recipient) {
          transferDest = normaliseAddress(msg.recipient);
        }

        // Parse cell body if available and jettonAmount is not yet parsed
        if (msg.message_content?.body) {
          try {
            const cell = Cell.fromBase64(msg.message_content.body);
            const slice = cell.beginParse();
            const op = slice.loadUint(32);
            if (op === 0x7362d09c) {
              slice.skip(64); // query_id
              jettonAmount = slice.loadCoins();
              slice.loadAddressAny(); // sender
              const forward = slice.loadBit() ? slice.loadRef().beginParse() : slice;
              if (forward.remainingBits >= 32) {
                const forwardOp = forward.loadUint(32);
                if (forwardOp === 0) {
                  comment = forward.loadStringTail();
                }
              }
            } else if (op === 0x0f8a7ea5) {
              slice.skip(64); // query_id
              jettonAmount = slice.loadCoins();
              const toAddr = slice.loadAddressAny();
              if (toAddr) transferDest = normaliseAddress(toAddr.toString());
              slice.loadMaybeAddress(); // responseDestination
              slice.loadMaybeRef(); // customPayload
              slice.loadCoins(); // forwardAmount
              const eitherForward = slice.loadBit() ? slice.loadRef().beginParse() : slice;
              if (eitherForward.remainingBits >= 32) {
                const forwardOp = eitherForward.loadUint(32);
                if (forwardOp === 0) {
                  comment = eitherForward.loadStringTail();
                }
              }
            }
          } catch {
            // Ignore cell parse failure, fall back to decoded properties
          }
        }

        if (msg.comment) comment = msg.comment;
        if (msg.message_content?.decoded?.comment) comment = msg.message_content.decoded.comment;

        transfers.push({
          destination: transferDest,
          rawAmount: jettonAmount > ZERO_BIGINT ? jettonAmount : BigInt(msg.rawAmount ?? 0),
          comment,
          jettonMaster,
          isJetton: true,
        });
      }
    }
  }

  return transfers;
}

/**
 * Verifies that a transaction trace contains both the platform fee payment to treasury
 * AND the sibling payment to the organizer's recipient_address.
 */
export function verifyFeeSplitTrace(params: VerifyTraceParams): VerifyTraceResult {
  const {
    trace,
    orderUuid,
    expectedPlatformFeeRaw,
    expectedOrganizerAmountRaw,
    recipientAddress,
    treasuryAddress,
    isJetton,
    expectedJettonMaster,
  } = params;

  if (!trace) {
    return { valid: false, reason: "empty_trace" };
  }

  const expectedRecipientNorm = normaliseAddress(recipientAddress);
  const expectedTreasuryNorm = normaliseAddress(treasuryAddress);
  const expectedMasterNorm = normaliseAddress(expectedJettonMaster);

  const decimals = params.decimals ?? (isJetton ? 6 : 9);
  const maxTolerance = decimals >= 6 ? BigInt(10 ** (decimals - 6)) : BigInt(1);

  const matchesAmount = (actual: bigint, expected: bigint): boolean => {
    const diff = actual > expected ? actual - expected : expected - actual;
    return diff <= maxTolerance;
  };

  const transfers = extractTransfers(trace);
  const relevantTransfers = transfers.filter((t) => t.isJetton === isJetton);

  // Check jetton master mismatch if jetton
  if (isJetton && expectedMasterNorm) {
    for (const t of relevantTransfers) {
      if (t.jettonMaster && t.jettonMaster !== expectedMasterNorm) {
        return { valid: false, reason: "wrong_jetton_master" };
      }
    }
  }

  // Find fee transfer to treasury
  const feeTransfer = relevantTransfers.find(
    (t) =>
      t.destination === expectedTreasuryNorm &&
      matchesAmount(t.rawAmount, expectedPlatformFeeRaw)
  );

  // Find organizer transfer
  const organizerTransfer = relevantTransfers.find(
    (t) =>
      t.destination === expectedRecipientNorm &&
      matchesAmount(t.rawAmount, expectedOrganizerAmountRaw)
  );

  // Check if a transfer with the organizer amount went to a wrong recipient
  const wrongRecipientTransfer = relevantTransfers.find(
    (t) =>
      t.destination !== expectedRecipientNorm &&
      t.destination !== expectedTreasuryNorm &&
      matchesAmount(t.rawAmount, expectedOrganizerAmountRaw)
  );

  if (wrongRecipientTransfer && !organizerTransfer) {
    return { valid: false, reason: "wrong_recipient" };
  }

  if (!organizerTransfer) {
    return { valid: false, reason: "missing_organizer_transfer" };
  }

  if (expectedPlatformFeeRaw > ZERO_BIGINT && !feeTransfer) {
    return { valid: false, reason: "missing_fee_transfer" };
  }

  return {
    valid: true,
    platformFeeFound: feeTransfer ? feeTransfer.rawAmount : ZERO_BIGINT,
    organizerAmountFound: organizerTransfer.rawAmount,
  };
}
