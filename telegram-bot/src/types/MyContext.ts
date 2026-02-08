import { Context, SessionFlavor } from "grammy"
import { SocietyHub } from "../helpers/getHubs"
import { SbtRewardCollection } from "./SbtRewardCollection"

export interface SessionData {
  /* ------------------ SBT Distribution Flow ------------------ */
  sbtdistStep?:
    | "askEventUUID"
    | "confirmEventSelection"
    | "chooseDistributionMethod"
    | "askCsvFile"
    | "handleAllApproved"
    | "done";

  sbtEventUUID?: string;
  sbtEventTitle?: string;

  /* ------------------ Affiliate Flow ------------------ */
  affiliateStep?:
    | "chooseType"
    | "reporting"
    | "askEventUUID"
    | "pickingEvent"
    | "confirmEvent"
    | "chooseAction"
    | "askCountOfLinks"
    | "askTitleOfLinks"
    | "generatingLinks"
    | "chooseLinkCreationMode"
    | "waitingForCsvUpload"
    | "reviewCsvRows"
    | "askMessageToAffiliatorsCsv"
    | "askTitleOfLinksCsv"
    | undefined;
  affiliateLinkType?: "EVENT" | "HOME";
  affiliateEventUUID?: string;
  affiliateEventId?: number;
  affiliateEventTitle?: string;
  affiliateLinkCount?: number;
  affiliateLinkTitle?: string;
  existingLinksCount?: number;
  csvCreatedLinks?: { affiliator_user_id: string; link_hash: string }[];
  csvRows?: any[];

  /* ------------------ Group Linking Flow ------------------ */
  groupStep?:
    | "selectEvent"
    | "confirmEvent"
    | "askGroupId"
    | "confirmGroup"
    | undefined;
  groupEventId?: number;
  groupEventUUID?: string;
  groupEventTitle?: string;
  pendingGroupId?: number;
  /* ------------------ Tournament Flow ------------------ */
  tournamentStep?:
    | "pickGame"
    | "askTournamentId"
    | "askInviteMessage"
    | "check"
    | "confirmInsert"
    | "confirmCreate"
    | "askTournamentPhoto"
    | "askTournamentLink"
    | "askCollection"          // <-- NEW
    | "NAVIGATE_COLLECTIONS"   // <-- NEW
    | "done"
    | undefined;

  tournamentData?: {
    gameId?: string;
    tournamentId?: string;
    photoFileId?: string;
    existingTournament?: any;  // store check result if needed
    createConfirmed?: boolean;
    tournamentLink?: string;

    // Below are the new fields for the SBT-collection sub-flow
    _postCollectionStep?: "askTournamentPhoto" | "confirmCreate";
    selectedCollectionId?: number;

    // If you want to store the entire list of fetched collections
    collections?: SbtRewardCollection[];
    currentIndex?: number;
    navigationMessageId?: number;
  };
  /* ------------------ Play2Win Featured Flow ------------------ */
  play2winStep?: "askList" | "done";

  /* ------------------ Channel Button Flow ------------------ */
  channelButtonStep?: "askPostId" | "askLink" | "askButtonText" | "removeButton";
  channelButtonPostId?: number;
  channelButtonLink?: string;

  /* ------------------ Broadcast Flow ------------------ */
  broadcastStep?: "chooseTarget" | "askEventUuid" | "askCsv" | "askBroadcast" | "done";
  broadcastType?: "event" | "csv";

  // For Event-based broadcast
  broadcastEventUuid?: string;
  broadcastEventTitle?: string;
  broadcastUserIds?: string[];  // consolidated list of user IDs to broadcast to

  // For CSV-based broadcast
  broadcastCsvUserIds?: string[];
  /* ------------------ SBT Collection Flow ------------------ */
  collectionStep?:
    | "CHOOSE_HUB"
    | "CHOOSE_ACTION"
    | "NAVIGATE_COLLECTIONS"
    | "UPLOAD_IMAGE"
    | "UPLOAD_VIDEO"
    | "DONE";

  collectionData?: {
    hubId?: number;
    hubName?: string;
    collections?: SbtRewardCollection[]; // We'll define this interface below
    currentIndex?: number;
    selectedCollectionId?: number;
    imageBuffer?: Buffer;
    videoBuffer?: Buffer;
    navigationMessageId?: number;
    imageLink?: string;
    hubs?: SocietyHub[];
  };
  toIdStep?:
    | "askMethod"
    | "askFile"
    | "askText"
    | "done";
  /* ---------- Poll Creation Flow ---------- */
  pollStep?:
      | "askCsv"
      | "askChoiceType"
      | "askPollQuestion"
      | "askPollAnswer"
      | "askPollAnswerMore"
      | "askDeadline"
      | "askDeadlineMethod"
      | "askDeadlineHours"
      | "askDeadlineDateTime"
      | "confirmPoll"
      | "done";

  pollUserIds?: string[];         // from CSV
  pollQuestion?: string;
  pollAnswers?: string[];
  pollDeadline?: Date;
  pollIsMultiple?: boolean;

}

export type MyContext = Context & SessionFlavor<SessionData>;
