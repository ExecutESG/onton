import { csbtTreesDB } from "@/db/modules/csbtTrees.db";
import { fetchOntonSettings } from "@/db/modules/ontoSetting";
import { computeEventHashBigInt } from "@/lib/csbt";
import { openWallet, waitSeqno } from "@/lib/sbt";
import { logger } from "@/server/utils/logger";
import { beginCell, internal, SendMode, Address } from "@ton/core";
import { v2_client } from "@/services/tonCenter";
import { sleep } from "@/utils";

export const CSBT_REGISTRY_SET_ROOT_OP = 0x73657472; // 'setr'

/**
 * Polls the cSBT registry contract getter method `get_root` to verify
 * that the expected Merkle root has been persisted on-chain.
 */
export async function pollForOnChainRoot(
  client: { runMethod: (address: Address, name: string, args?: any[]) => Promise<any> },
  registryAddress: string,
  eventHash: bigint,
  expectedRoot: bigint,
  maxAttempts = 10,
  intervalMs = 2000
): Promise<boolean> {
  let address: Address;
  try {
    address = Address.parse(registryAddress);
  } catch (err) {
    logger.error(`pollForOnChainRoot: Invalid registry address "${registryAddress}":`, err);
    return false;
  }

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await client.runMethod(address, "get_root", [
        { type: "int", value: eventHash },
      ]);
      const storedRoot = res.stack.readBigNumber();
      if (storedRoot === expectedRoot) {
        return true;
      }
    } catch (err) {
      logger.warn(`pollForOnChainRoot: attempt ${i + 1}/${maxAttempts} failed:`, err);
    }
    if (i < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }
  return false;
}

/**
 * Cron: anchorCsbtRoots
 *
 * Scans for frozen cSBT trees where `anchored_at IS NULL`, and anchors
 * each Merkle root onto the TON cSBT Registry contract from ONTON_MINTER_WALLET.
 *
 * The contract address is read from onton_setting key `CSBT_REGISTRY_ADDRESS`.
 * If unset, skips execution with a warning log.
 */
export const anchorCsbtRoots = async (pushLockTTl?: () => any) => {
  try {
    // 1. Resolve CSBT_REGISTRY_ADDRESS
    let registryAddress: string | null = null;
    try {
      const { config, configProtected } = await fetchOntonSettings();
      registryAddress =
        (config.CSBT_REGISTRY_ADDRESS as string) ||
        (configProtected.CSBT_REGISTRY_ADDRESS as string) ||
        process.env.CSBT_REGISTRY_ADDRESS ||
        null;
    } catch {
      registryAddress = process.env.CSBT_REGISTRY_ADDRESS || null;
    }

    if (!registryAddress) {
      logger.warn(
        "anchorCsbtRoots: CSBT_REGISTRY_ADDRESS is unset in onton_setting. Skipping on-chain anchoring."
      );
      return;
    }

    // 2. Fetch unanchored trees
    const unanchoredTrees = await csbtTreesDB.getUnanchoredTrees(10);
    if (unanchoredTrees.length === 0) {
      return;
    }

    // 3. Resolve minter mnemonic (support CSBT_ANCHOR_MNEMONIC || MNEMONIC)
    const mnemonic = process.env.CSBT_ANCHOR_MNEMONIC || process.env.MNEMONIC;
    if (!mnemonic) {
      logger.warn(
        "anchorCsbtRoots: CSBT_ANCHOR_MNEMONIC or MNEMONIC is not configured. Skipping on-chain anchoring."
      );
      return;
    }

    const mnemonicWords = mnemonic.trim().split(/\s+/).filter(Boolean);
    const wallet = await openWallet(mnemonicWords);
    const client = v2_client();

    logger.log(`anchorCsbtRoots: Found ${unanchoredTrees.length} unanchored cSBT trees to anchor.`);

    for (const tree of unanchoredTrees) {
      if (pushLockTTl) await pushLockTTl();

      try {
        const eventHash = computeEventHashBigInt(tree.kind, tree.eventUuid);
        const rootBigInt = BigInt(tree.root.startsWith("0x") ? tree.root : "0x" + tree.root);

        const body = beginCell()
          .storeUint(CSBT_REGISTRY_SET_ROOT_OP, 32)
          .storeUint(BigInt(tree.id), 64) // query_id correlates to tree ID in tx explorer
          .storeUint(eventHash, 256)
          .storeUint(rootBigInt, 256)
          .endCell();

        const beforeSeqno = await wallet.contract.getSeqno();

        await wallet.contract.sendTransfer({
          seqno: beforeSeqno,
          secretKey: wallet.keyPair.secretKey,
          messages: [
            internal({
              value: "0.08",
              to: registryAddress,
              body,
            }),
          ],
          sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        });

        const afterSeqno = await waitSeqno(beforeSeqno, wallet);

        let confirmedSeqno = afterSeqno;
        if (confirmedSeqno <= beforeSeqno) {
          try {
            confirmedSeqno = await wallet.contract.getSeqno();
          } catch {
            // ignore
          }
        }

        if (confirmedSeqno <= beforeSeqno) {
          logger.warn(
            `anchorCsbtRoots: Wallet seqno did not increment for tree ${tree.id} (before: ${beforeSeqno}, after: ${afterSeqno}). Transaction pending or dropped. Skipping markTreeAnchored.`
          );
          continue;
        }

        const maxAttempts = parseInt(process.env.CSBT_ANCHOR_POLL_ATTEMPTS || "10", 10) || 10;
        const intervalMs = parseInt(process.env.CSBT_ANCHOR_POLL_INTERVAL_MS || "2000", 10) || 2000;

        // Verify on-chain root storage before marking tree anchored
        const isVerified = await pollForOnChainRoot(
          client,
          registryAddress,
          eventHash,
          rootBigInt,
          maxAttempts,
          intervalMs
        );

        if (!isVerified) {
          logger.error(
            `anchorCsbtRoots: On-chain root verification failed for tree ${tree.id} (${tree.kind}, event ${tree.eventUuid}). Root was rejected, bounced, or timed out. Skipping markTreeAnchored.`
          );
          continue;
        }

        const anchorTxIdentifier = `ton:seqno:${confirmedSeqno}`;
        await csbtTreesDB.markTreeAnchored(tree.id, anchorTxIdentifier);

        logger.log(
          `anchorCsbtRoots: Successfully anchored tree ${tree.id} (${tree.kind}) for event ${tree.eventUuid} at seqno ${confirmedSeqno}`
        );
      } catch (treeErr) {
        logger.error(`anchorCsbtRoots: Failed to anchor tree ${tree.id} for event ${tree.eventUuid}:`, treeErr);
      }
    }
  } catch (error) {
    logger.error("anchorCsbtRoots execution error:", error);
  }
};
