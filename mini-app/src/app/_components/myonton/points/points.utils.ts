import type { UsersScoreActivityType } from "@/db/schema/usersScore";

export function getTitle(type: UsersScoreActivityType) {
  switch (type) {
    case "free_online_event":
      return "Participated Free Online Events";
    case "free_offline_event":
      return "Participated Free In-Person Events";
    case "paid_online_event":
      return "Participated Paid Online Events";
    case "paid_offline_event":
      return "Participated Paid In-Person Events";
    case "join_onton_affiliate":
      return "Referred Users";
  }
}

export function getNotFoundTitle(type: UsersScoreActivityType) {
  switch (type) {
    case "free_online_event":
      return "Have not participated a free online event yet?";
    case "free_offline_event":
      return "Have not participated a free in-person event yet?";
    case "paid_online_event":
      return "Have not participated a paid online event yet?";
    case "paid_offline_event":
      return "Have not participated a paid in-person event yet?";
    case "join_onton_affiliate":
      return "Have not referred any users yet?";
  }
}

/**
 * Checks if the given point type is an event-related type
 * @param type - The point type to check
 * @returns {boolean} True if the type is any of the event types (free/paid, online/offline), false otherwise
 */
export function isPointEventItem(type: UsersScoreActivityType): boolean {
  return (
    type === "free_online_event" ||
    type === "free_offline_event" ||
    type === "paid_online_event" ||
    type === "paid_offline_event"
  );
}
