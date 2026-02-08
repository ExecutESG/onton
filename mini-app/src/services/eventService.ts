import { getEventByUuid } from "@/db/modules/events.db";
import { logger } from "@/server/utils/logger";
// Validate event dates
export const validateEventDates = (start_date: number, end_date: number) => {
  const currentTime = Date.now();
  const startDate = start_date * 1000;
  const endDate = end_date * 1000;

  const one_hour = 3600 * 1000;
  const four_hour = 6 * one_hour;

  // Check-in Window
  if (currentTime < startDate - four_hour || currentTime > endDate) {
    return {
      success: false,
      error: "Either the event has not started or it has already ended.",
    };
  }

  return { success: true };
};

export const validateEventData = async (event_uuid: string) => {
  try {
    const eventData = await getEventByUuid(event_uuid, false);

    // Check if the event exists
    if (!eventData) {
      return {
        success: false,
        error: `Event not found with UUID: ${event_uuid}`,
      };
    }

    // Validate the activity_id
    if (!eventData.activity_id || eventData.activity_id < 0) {
      return {
        success: false,
        error: `Invalid activity ID: ${eventData.activity_id} for event UUID: ${event_uuid}`,
      };
    }

    // Return success with event data
    return { success: true, data: eventData };
  } catch (error) {
    // Log unexpected errors
    const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred";
    logger.error(`validateEventData Unexpected Error:`, error);
    return {
      success: false,
      error: errorMsg,
    };
  }
};
const eventService = {
  validateEventDates,
  validateEventData,
};

export default eventService;
