import { eventCategories, eventParticipationType, giataCity } from "@/db/schema";
import { users } from "@/db/schema/users";
import { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const raffleKindEnum = pgEnum("raffle_kind", ["ton", "merch"]);

export const events = pgTable(
  "events",
  {
    event_id: serial("event_id").primaryKey(),
    event_uuid: uuid("event_uuid").notNull(),

    enabled: boolean("enabled").default(true),
    hidden: boolean("hidden").default(false),

    type: integer("type"),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    description: text("description").notNull(),
    image_url: text("image_url").notNull(),
    wallet_address: text("wallet_address"),
    giveaway_wallet_address: text("giveaway_wallet_address"),
    raffleKind: raffleKindEnum("raffle_kind"),
    society_hub: text("society_hub"),
    society_hub_id: text("society_hub_id"),
    activity_id: integer("activity_id"),
    sbt_collection_address: text("sbt_collection_address"),
    secret_phrase: text("secret_phrase").default(""),
    start_date: integer("start_date").notNull(),
    end_date: integer("end_date").notNull(),
    timezone: text("timezone"),

    location: text("location"),
    website: json("website").$type<{
      label: string;
      link: string;
    }>(),
    owner: bigint("owner", { mode: "number" })
      .references(() => users.user_id)
      .notNull(),

    ticketToCheckIn: boolean("ticketToCheckIn").default(false),
    participationType: eventParticipationType("participation_type").default("online").notNull(),
    cityId: integer("city_id").references(() => giataCity.id),
    countryId: integer("country_id").references(() => giataCity.id),
    tsRewardImage: text("ts_reward_image"),
    tsRewardVideo: text("ts_reward_video"),
    eventTelegramGroup: bigint("event_telegram_group", { mode: "number" }),
    /* ------------------------- // < Event Registration ------------------------ */
    has_registration: boolean("has_registration").default(false),
    has_approval: boolean("has_approval").default(false),
    capacity: integer("capacity"),
    has_waiting_list: boolean("has_waiting_list").default(false),
    /* ------------------------- // Event Registration > ------------------------ */
    category_id: integer("category_id").references(() => eventCategories.category_id),
    /* ------------------------------- Paid Event ------------------------------- */
    has_payment: boolean("has_payment").notNull().default(false),
    /* ------------------------------- Paid Event ------------------------------- */
    moderationMessageId: bigint("moderation_message_id", { mode: "number" }),
    created_at: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
  },
  (table) => ({
    eventUuidIdx: index("events_event_uuid_idx").on(table.event_uuid),
    typeIdx: index("events_type_idx").on(table.type),
    titleIdx: index("events_title_idx").on(table.title),
    walletAddressIdx: index("events_wallet_address_idx").on(table.wallet_address),
    societyHubIdx: index("events_society_hub_idx").on(table.society_hub),
    startDateIdx: index("events_start_date_idx").on(table.start_date),
    endDateIdx: index("events_end_date_idx").on(table.end_date),
    ownerIdx: index("events_owner_idx").on(table.owner),
    hiddenIdx: index("events_hidden_idx").on(table.hidden),
    createdAtIdx: index("events_created_at_idx").on(table.created_at),
    updatedAtIdx: index("events_updated_at_idx").on(table.updatedAt),
    participationTypeIdx: index("events_participation_type_idx").on(table.participationType),
    event_uuid_unique: uniqueIndex().on(table.event_uuid),
    moderationMessageIdIndex: index("events_moderation_message_id_idx").on(table.moderationMessageId),
    categoryIdIdx: index("events_category_id_idx").on(table.category_id),
    giveaway_wallet_address_idx: index("events_giveaway_wallet_address_idx").on(table.giveaway_wallet_address),
  })
);

export type EventRow = InferSelectModel<typeof events>;
export type RaffleKindType = EventRow["raffleKind"];
