import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
export const taskSBT = pgTable("task_sbt", {
  id: serial("id").primaryKey(),
  sbtTitle: varchar("sbt_title", { length: 255 }).notNull(),
  sbtDescription: text("sbt_description"),
  sbtImageUrl: varchar("sbt_image_url", { length: 255 }),
  sbtRewardUrl: varchar("sbt_reward_url", { length: 255 }),
  sbtRewardLink: varchar("sbt_reward_link", { length: 255 }),

  createdAt: timestamp("created_at", {
    withTimezone: false,
    precision: 3,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: false,
    precision: 3,
  }),
});

export type TaskSBT = InferSelectModel<typeof taskSBT>;
export type TaskSBTInsert = Omit<TaskSBT, "id" | "createdAt" | "updatedAt">;
