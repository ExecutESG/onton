import { eventManagementProtectedProcedure, router } from "../trpc";
import { addEventPoaTrigger, getPoaByEventId, EventPoaTrigger } from "@/db/modules/eventPoaTriggers.db";
import { EventTriggerStatus, eventTriggerType, EventTriggerType } from "@/db/enum";
import { getEventByUuid } from "@/db/modules/events.db";
import { POA_CREATION_LIMIT, POA_CREATION_TIME_DISTANCE } from "@/sockets/constants";
import { z } from "zod";
import { logger } from "@/server/utils/logger";
export const POARouter = router({
  Create: eventManagementProtectedProcedure
    .input(
      z.object({
        poa_type: z.enum(eventTriggerType.enumValues).optional(),
      })
    )
    .mutation(async (opts) => {
      //opts.ctx.user.user_id
      const eventUuid = opts.ctx.event.event_uuid;
      const currentTimestamp = Math.floor(Date.now() / 1000);

      try {
        const event = await getEventByUuid(eventUuid);
        if (!event) {
          logger.error(`Event not found for UUID: ${eventUuid} in POA.Create`);
          return { success: false, message: "Event not found" };
        }

        if (event.start_date > currentTimestamp || event.end_date < currentTimestamp) {
          logger.error(`Event not active for UUID: ${eventUuid} in POA.Create`);
          return { success: false, message: "you can create POA only during the event" };
        }

        const poaType = opts.input.poa_type as EventTriggerType;
        if (!opts.input?.poa_type || !eventTriggerType.enumValues.includes(poaType)) {
          logger.error(`Invalid POA Type: ${opts.input.poa_type}`);
          return { success: false, message: "Invalid POA Type" };
        }

        // Check POA creation constraints
        const existingPOAs: any = await getPoaByEventId(event.event_id);

        // 1) Check if POA_CREATION_LIMIT reached
        if (existingPOAs.length >= POA_CREATION_LIMIT) {
          logger.error(`POA_CREATION_LIMIT reached for event: ${eventUuid}`);
          return {
            success: false,
            message: `You have reached the maximum POA creation limit of ${POA_CREATION_LIMIT} for this event.`,
          };
        }

        // 2) Check POA_CREATION_TIME_DISTANCE
        // Find the most recently created POA by startTime
        const lastPoa = existingPOAs.reduce((prev: EventPoaTrigger | null, curr: EventPoaTrigger) => {
          if (!prev || curr.startTime > prev.startTime) {
            return curr;
          }
          return prev;
        }, null);

        if (lastPoa && currentTimestamp - lastPoa.startTime < POA_CREATION_TIME_DISTANCE) {
          logger.error(`POA_CREATION_TIME_DISTANCE not met for event: ${eventUuid}`);
          return {
            success: false,
            message: `Please wait ${POA_CREATION_TIME_DISTANCE} seconds between creating POAs.`,
          };
        }

        // If checks are passed, create new POA
        const poaData = {
          eventId: event.event_id,
          poaOrder: 1,
          startTime: currentTimestamp,
          countOfSent: 0,
          countOfSuccess: 0,
          poaType: poaType,
          status: "active" as EventTriggerStatus,
          creator_user_id: opts.ctx.user.user_id,
        };

        const POAResult = await addEventPoaTrigger(poaData);
        if (!POAResult || POAResult.length === 0) {
          logger.error(`Error adding POA Trigger for event: ${eventUuid}`);
          return { success: false, message: "Error adding POA Trigger" };
        }

        logger.log(`POA Trigger added for event: ${eventUuid} with ID: ${POAResult[0].id}`);
        return { success: true, message: "POA Trigger added", POAResult };
      } catch (error) {
        logger.error("Error adding POA Trigger:", error);
        return {
          success: false,
          message: "Error adding POA Trigger",
        };
      }
    }),
  Info: eventManagementProtectedProcedure.query(async (opts) => {
    const eventUuid = opts.ctx.event.event_uuid;
    const event = await getEventByUuid(eventUuid);
    if (!event) {
      return { success: false, message: "Event not found", remainingPOA: 0, timeUntilNextPOA: 0 };
    }

    // After you fetch from DB (which may return nullable fields):
    const rawPOAs = await getPoaByEventId(event.event_id);

    // Transform them to strict EventPoaTrigger[]
    const existingPOAs = rawPOAs.map((poa) => {
      if (
        poa.eventId == null ||
        poa.poaOrder == null ||
        poa.startTime == null ||
        poa.countOfSent == null ||
        poa.countOfSuccess == null ||
        poa.poaType == null ||
        poa.status == null
      ) {
        throw new Error("DB returned null for a field that must be non-null.");
      }

      // Now cast since we confirmed none of the essential fields are null.
      return {
        ...poa,
        eventId: poa.eventId,
        poaOrder: poa.poaOrder,
        startTime: poa.startTime,
        countOfSent: poa.countOfSent,
        countOfSuccess: poa.countOfSuccess,
        poaType: poa.poaType,
        status: poa.status,
      } as EventPoaTrigger;
    });
    logger.log("Existing POAs:", existingPOAs.length);
    const remainingPOA = Math.max(0, POA_CREATION_LIMIT - existingPOAs.length);

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const lastPoa = existingPOAs.reduce((prev: EventPoaTrigger | null, curr: EventPoaTrigger) => {
      // If prev is null, just return curr
      if (!prev) return curr;

      // If curr.startTime is null, it can't be greater, so return prev
      if (curr.startTime === null) return prev;

      // If prev.startTime is null, curr is definitely greater
      if (prev.startTime === null) return curr;

      // Now both startTimes are not null
      return curr.startTime > prev.startTime ? curr : prev;
    }, null);

    let timeUntilNextPOA = 0;
    if (lastPoa && lastPoa.startTime) {
      const diff = currentTimestamp - lastPoa.startTime;
      if (diff < POA_CREATION_TIME_DISTANCE) {
        timeUntilNextPOA = POA_CREATION_TIME_DISTANCE - diff;
      }
    }

    return {
      success: true,
      message: "POA Info",
      remainingPOA,
      timeUntilNextPOA,
    };
  }),
});
