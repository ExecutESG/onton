import { index, integer, json, pgEnum, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { rewardStatus, rewardType } from "@/db/schema";
import { visitors } from "@/db/schema/visitors";
import { InferSelectModel } from "drizzle-orm";
import { RewardStatus, RewardType } from "@/db/enum";

export type RewardDataTyepe =
  | {
      reward_link: string;
      sbt_address?: string | null;
      ok?: boolean;
    }
  | { fail_reason: string; ok: false };

export const tonSocietyStatusEnum = pgEnum("ton_society_status_enum", [
  "NOT_CLAIMED",
  "CLAIMED",
  "RECEIVED",
  "NOT_ELIGIBLE",
]);

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitor_id: serial("visitor_id")
      .references(() => visitors.id)
      .notNull(),
    type: rewardType("type").notNull(),
    data: json("data").$type<RewardDataTyepe>(),
    tryCount: integer("try_count").default(0).notNull(),
    status: rewardStatus("status").notNull().default("created"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    event_start_date: integer("event_start_date").notNull(),
    event_end_date: integer("event_end_date").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "date",
      precision: 3,
    }).$onUpdate(() => new Date()),
    updatedBy: text("updated_by").default("system").notNull(),
    tonSocietyStatus: tonSocietyStatusEnum("ton_society_status").notNull().default("NOT_CLAIMED"),
  },
  (table) => ({
    visitorIdIdx: index("rewards_visitor_id_idx").on(table.visitor_id),
    typeIdx: index("rewards_type_idx").on(table.type),
    statusIdx: index("rewards_status_idx").on(table.status),
    createdAtIdx: index("rewards_created_at_idx").on(table.created_at),
    updatedAtIdx: index("rewards_updated_at_idx").on(table.updatedAt),
  })
);

export type RewardsSelectType = InferSelectModel<typeof rewards>;
export type RewardTonSocietyStatusType = (typeof tonSocietyStatusEnum.enumValues)[number];

//// most use  join query types
// to join rewards with visitors
export type RewardVisitorTypePartial = {
  rewardId: string;
  status: RewardStatus;
  data: RewardDataTyepe | null; // or a more specific type
  type: RewardType;
  tryCount: number;
  createdAt: Date;
  visitorId: number;
  eventUuid: string;
  userId: number;
};
