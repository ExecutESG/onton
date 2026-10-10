import { csbtTreesDB } from "@/db/modules/csbtTrees.db";
import { csbtTreeService } from "@/services/csbtTreeService";
import { logger } from "@/server/utils/logger";

/**
 * Cron: freezeCsbtTrees
 *
 * Scans for events where `end_date + 24h < now` with no native cSBT tree,
 * builds the Merkle tree from checked-in attendees, archives the leaves JSON
 * to MinIO, and persists the root in the `csbt_trees` database table.
 */
export const freezeCsbtTrees = async (pushLockTTl?: () => any) => {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoffSec = nowSec - 24 * 3600; // end_date + 24h < now

    const candidateEvents = await csbtTreesDB.getEndedEventsWithoutNativeTree(cutoffSec, 20);
    if (candidateEvents.length === 0) {
      return;
    }

    logger.log(`freezeCsbtTrees: Found ${candidateEvents.length} ended events to freeze`);

    for (const evt of candidateEvents) {
      if (pushLockTTl) await pushLockTTl();
      try {
        await csbtTreeService.freezeNativeEventTree(evt.eventUuid);
      } catch (err) {
        logger.error(`freezeCsbtTrees: Failed to freeze event ${evt.eventUuid}:`, err);
      }
    }
  } catch (error) {
    logger.error("freezeCsbtTrees execution error:", error);
  }
};
