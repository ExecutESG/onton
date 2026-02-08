import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { taskSBT } from "@/db/schema/taskSbt";

export const taskGroups = pgTable("task_groups", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 255 }),
  sbtId: integer("sbt_id").references(() => taskSBT.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),

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

export type TaskGroups = InferSelectModel<typeof taskGroups>;
export type TaskGroupsInsert = Omit<TaskGroups, "id" | "createdAt" | "updatedAt">;
