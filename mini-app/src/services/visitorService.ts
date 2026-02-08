// Helper function to validate and retrieve visitor
import visitorsDB from "@/db/modules/visitors.db";
import eventDB from "@/db/modules/events.db";
import { TRPCError } from "@trpc/server";
import userEventFieldsDB from "@/db/modules/userEventFields.db";
import { logger } from "@/server/utils/logger";

export const getAndValidateVisitor = async (user_id: number, event_uuid: string, ticketOrderUuid?: string | null) => {
  try {
    // Check if the visitor exists, depending on the ticketOrderUuid
    const visitor = ticketOrderUuid
      ? await visitorsDB.addVisitor(user_id, event_uuid)
      : await visitorsDB.getVisitor(user_id, event_uuid);

    // If visitor not found, return a failure response
    if (!visitor || !visitor?.id) {
      return {
        success: false,
        error: `Visitor not found for user ID: ${user_id} and event UUID: ${event_uuid}`,
      };
    }

    // If no ticketOrderUuid, validate if the visitor is valid
    if (!ticketOrderUuid) {
      const isValidVisitor = await visitorsDB.selectValidVisitorById(visitor.id);

      // If the visitor is invalid, return a failure response
      if (!isValidVisitor.length) {
        return {
          success: false,
          error: "Invalid visitor: complete the tasks first.",
        };
      }
    }

    // If everything is valid, return the visitor information
    return { success: true, data: visitor };
  } catch (error) {
    // Catch any unexpected errors and return them
    const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred";
    logger.error(`getAndValidateVisitor Unexpected Error:`, error);
    return {
      success: false,
      error: errorMsg,
    };
  }
};

export const addVisitor = async (opts: any) => {
  const { event_uuid } = opts.input;
  const { user_id } = opts.ctx.user;

  // Fetch the event by UUID
  const event = await eventDB.selectEventByUuid(event_uuid);
  if (!event) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Event not found",
    });
  }
  // logger.log(`Event: `, event);
  if (event.ticketToCheckIn) {
    logger.error(`Event requires ticket to check in: ${event_uuid}`);
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This event requires a ticket to add user as visitor to the event",
    });
  }

  // Check if the user has already completed the task
  const taskCompleted = await userEventFieldsDB.checkPasswordTask(user_id, event.event_id);

  if (!taskCompleted && event.participationType !== "in_person") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "You have not completed the task",
    });
  }

  // Add a visitor if the task is not completed
  const visitor = await visitorsDB.addVisitor(user_id, event_uuid);
  return {
    code: "OK",
    message: "Visitor added",
    data: visitor,
  };
};
const visitorService = {
  getAndValidateVisitor,
  addVisitor,
};

export default visitorService;
