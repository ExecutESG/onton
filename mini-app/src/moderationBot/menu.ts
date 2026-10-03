import { InlineKeyboard } from "grammy";
import { logger } from "@/server/utils/logger";

/**
 * The main moderation menu (Approve/Reject/etc.)
 * Called BEFORE an event is approved.
 */
export function tgBotModerationMenu(eventUuid: string) {
  return new InlineKeyboard()
    .text("✅ Approve", `approve_${eventUuid}`)
    .row()
    .text("❌ Duplicate", `rejectDuplicate_${eventUuid}`)
    .text("❌ Inappropriate content", `rejectInappropriate_${eventUuid}`)
    .row()
    .text("❌ Spam or self-promotion", `rejectSpam_${eventUuid}`)
    .text("❌ Incorrect information", `rejectIncorrect_${eventUuid}`)
    .row()
    .text("❌ Missing information", `rejectMissing_${eventUuid}`)
    .text("❌ Safety concerns", `rejectSafety_${eventUuid}`)
    .row()
    .text("❌ Copyright", `rejectCopyright_${eventUuid}`)
    .text("❌ Custom reason", `rejectCustom_${eventUuid}`)
    .row()
    .text("🔃 Update Data", `updateEventData_${eventUuid}`);
}

/**
 * The reactive post-publish moderation menu (Lu.ma-style Trust & Safety).
 * Displayed when an event is automatically published.
 * Gives moderators 1-tap reactive takedown and safety controls.
 */
export function tgBotPostPublishModerationMenu(eventUuid: string, organizerUserId: number | string) {
  return new InlineKeyboard()
    .text("🚫 Delist Event", `delist_${eventUuid}`)
    .text("⚠️ Warn Organizer", `warn_${organizerUserId}_${eventUuid}`)
    .row()
    .text("🔨 Ban Organizer", `ban_${organizerUserId}_${eventUuid}`)
    .text("🔃 Update Data", `updateEventData_${eventUuid}`);
}

/**
 * Menu displayed after an event has been delisted.
 * Moderator can re-list the event or refresh data.
 */
export function tgBotDelistedMenu(eventUuid: string) {
  return new InlineKeyboard()
    .text("♻️ Re-list Event", `relist_${eventUuid}`)
    .row()
    .text("🔃 Update Data", `updateEventData_${eventUuid}`);
}

/**
 * Menu displayed when attendees submit community abuse reports for an event.
 */
export function tgBotReportedEventMenu(eventUuid: string) {
  return new InlineKeyboard()
    .text("🚫 Confirm Delist", `confirmDelist_${eventUuid}`)
    .text("✅ Dismiss Report", `dismissReport_${eventUuid}`)
    .row()
    .text("🔃 Update Data", `updateEventData_${eventUuid}`);
}

/**
 * A simpler menu displayed AFTER the event is approved.
 * Moderator can send a notice to the organizer (or add more buttons as needed).
 */
export function tgBotApprovedMenu(eventUuid: string) {
  logger.log("tgBotApprovedMenu");
  return new InlineKeyboard()
    .text("🔔 Send Notice", `sendNotice_${eventUuid}`)
    .row()
    .text("🔃 Update Data", `updateEventData_${eventUuid}`);
}

/**
 * Convert short keys (e.g. "Duplicate") to descriptive strings used for rejection messages.
 */
export function parseRejectReason(reason: string): string {
  switch (reason) {
    case "Duplicate":
      return "Duplicate event";
    case "Inappropriate":
      return "Inappropriate content";
    case "Spam":
      return "Spam or self-promotion";
    case "Incorrect":
      return "Incorrect information";
    case "Missing":
      return "Missing required information";
    case "Safety":
      return "Safety concerns";
    case "Copyright":
      return "Copyright infringement";
    default:
      return "No specific reason";
  }
}
