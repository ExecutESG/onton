import { csbtTreesDB } from "@/db/modules/csbtTrees.db";
import { fetchOntonSettings } from "@/db/modules/ontoSetting";
import { computeEventHashBigInt } from "@/lib/csbt";
import { openWallet, waitSeqno } from "@/lib/sbt";
import { logger } from "@/server/utils/logger";
import { beginCell, internal, SendMode } from "@ton/core";

export const CSBT_REGISTRY_SET_ROOT_OP = 0x73657472; // 'setr'

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

    // 3. Resolve minter mnemonic
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
      logger.warn("anchorCsbtRoots: MNEMONIC is not configured. Skipping on-chain anchoring.");
      return;
    }

    const mnemonicWords = mnemonic.split(" ").filter(Boolean);
    const wallet = await openWallet(mnemonicWords);

    logger.log(`anchorCsbtRoots: Found ${unanchoredTrees.length} unanchored cSBT trees to anchor.`);

    for (const tree of unanchoredTrees) {
      if (pushLockTTl) await pushLockTTl();

      try {
        const eventHash = computeEventHashBigInt(tree.kind, tree.eventUuid);
        const rootBigInt = BigInt("0x" + tree.root);

        const body = beginCell()
          .storeUint(CSBT_REGISTRY_SET_ROOT_OP, 32)
          .storeUint(BigInt(0), 64) // query_id
          .storeUint(eventHash, 256)
          .storeUint(rootBigInt, 256)
          .endCell();

        const beforeSeqno = await wallet.contract.getSeqno();

        await wallet.contract.sendTransfer({
          seqno: beforeSeqno,
          secretKey: wallet.keyPair.secretKey,
          messages: [
            internal({
              value: "0.05",
              to: registryAddress,
              body,
            }),
          ],
          sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        });

        const afterSeqno = await waitSeqno(beforeSeqno, wallet);
        const anchorTxIdentifier = `ton:seqno:${afterSeqno}`;

        await csbtTreesDB.markTreeAnchored(tree.id, anchorTxIdentifier);

        logger.log(
          `anchorCsbtRoots: Successfully anchored tree ${tree.id} (${tree.kind}) for event ${tree.eventUuid} at seqno ${afterSeqno}`
        );
      } catch (treeErr) {
        logger.error(`anchorCsbtRoots: Failed to anchor tree ${tree.id} for event ${tree.eventUuid}:`, treeErr);
      }
    }
  } catch (error) {
    logger.error("anchorCsbtRoots execution error:", error);
  }
};
