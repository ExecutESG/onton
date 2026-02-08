import eventDB from "@/db/modules/events.db";
import { UsersScoreActivityType } from "@/db/schema/usersScore";
import { userScoreDb } from "@/db/modules/userScore.db";
import { logger } from "@/server/utils/logger";
import { userScoreRulesDB } from "@/db/modules/userScoreRules.db";

export type MaybeInsertUserScoreResult =
  | {
      user_point: number;
      organizer_point: number;
      error: null;
    }
  | {
      user_point: number | null;
      organizer_point: number | null;
      error: string;
    };
/**
 * Inserts a new user score record if none exists yet for this user+event.
 *
 * We derive the "activityType" from:
 * - event.has_payment -> "paid" vs. "free"
 * - event.participationType -> "online" vs. "in_person"
 *
 * Then we pick the correct point value:
 *   "free_online_event" : 10 points
 *   "free_offline_event": 15 points
 *   "paid_online_event": 20 points
 *   "paid_offline_event": 25 points
 */
export async function maybeInsertUserScore(userId: number, eventId: number): Promise<MaybeInsertUserScoreResult> {
  // 1. Fetch event
  const eventRow = await eventDB.fetchEventById(eventId);
  if (!eventRow) {
    logger.warn(`Event not found for eventId=${eventId}. Skipping user score insert.`);
    return { user_point: null, organizer_point: null, error: "Event not found" };
  }

  // 2. Derive activity type & point values
  const isPaid = !!eventRow.has_payment;
  const isOnline = eventRow.participationType === "online";

  let chosenActivityType: UsersScoreActivityType;
  let points: number;
  let organizerPoints = 0.2; // Default organizer points percentage
  if (isPaid && isOnline) {
    chosenActivityType = "paid_online_event";
    points = 10;
    organizerPoints = points * 0.2; // 20% of user points for organizer
  } else if (isPaid && !isOnline) {
    chosenActivityType = "paid_offline_event";
    points = 20;
    organizerPoints = points * 0.2; // 20% of user points for organizer
  } else if (!isPaid && isOnline) {
    chosenActivityType = "free_online_event";
    points = 1;
    organizerPoints = points * 0.02; // 2% of user points for organizer
  } else {
    chosenActivityType = "free_offline_event";
    points = 10;
    organizerPoints = points * 0.2; // 20% of user points for organizer
  }

  /// override points if custom rule exists
  try {
    const rule = await userScoreRulesDB.getMatchingUserScoreRule({
      subjectUserId: eventRow.owner, // participant id
      activityType: chosenActivityType,
      itemType: "event",
      itemId: eventId,
    });

    if (rule) {
      logger.log(
        `[UserScore] Custom rule ${rule.id} applies: ` +
          `${rule.point} points instead of ${chosenActivityType} for event=${eventId} by user=${userId}`
      );
      points = parseFloat(rule.point);
    }
  } catch (err) {
    logger.error("Failed to fetch custom rule, falling back to defaults", err);
  }

  try {
    // 3. Insert participant score
    let participantInserted = false;
    try {
      await userScoreDb.createUserScore({
        userId,
        activityType: chosenActivityType,
        point: points,
        active: true,
        itemId: eventId,
        itemType: "event",
      });
      participantInserted = true;
      logger.log(`[UserScore] Inserted ${chosenActivityType} for user=${userId}, event=${eventId}, points=${points}`);
    } catch (err) {
      const message = String(err);
      if (message.includes("duplicate key value") || message.includes("unique constraint")) {
        logger.log(`[UserScore] Score already exists for user=${userId}, event=${eventId}. Skipping organizer update.`);
        return { user_point: points, organizer_point: organizerPoints, error: `Score already exists` };
      } else {
        logger.error(`[UserScore] Failed creating participant score for user=${userId}, event=${eventId}: ${message}`);
        return { user_point: points, organizer_point: organizerPoints, error: "Failed creating participant score" };
      }
    }

    // 4. Insert / update organizer score ONLY if participant score actually inserted
    if (participantInserted) {
      try {
        await userScoreDb.upsertOrganizerScore({
          userId: eventRow.owner,
          activityType: chosenActivityType,
          point: organizerPoints,
          active: true,
          itemId: eventId,
          itemType: "organize_event",
        });
        logger.log(
          `[UserScore] Upserted organizer score for owner=${eventRow.owner}, event=${eventId}, points=${organizerPoints}`
        );
      } catch (err) {
        const message = String(err);
        return {
          user_point: points,
          organizer_point: organizerPoints,
          error: `Failed creating organizer score: ${message}`,
        };
      }
    }

    // 5. Success (participantInserted true means new points, false means nothing new)
    return {
      user_point: participantInserted ? points : 0,
      organizer_point: participantInserted ? organizerPoints : 0,
      error: null,
    };
  } catch (err) {
    const message = String(err);
    logger.error(`[maybeInsertUserScore] Unexpected error: ${message}`);
    return { user_point: points, organizer_point: organizerPoints, error: message };
  }
}
