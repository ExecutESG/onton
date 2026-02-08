import { integer, json, pgEnum, pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { users } from "./users";
import { tasks } from "@/db/schema/tasks";

export interface AffiliationCustomDataForJoinTasks {
  joinedUsers?: number[]; // optional property
  [key: string]: number[] | undefined; // optionally allow other unknown keys
}
/** High-level user→task relationship: e.g., 'in_progress', 'done', etc. */
export const taskUserStatusEnum = pgEnum("task_user_status", ["need_to_check", "in_progress", "done", "failed"]);

/** Whether points are allocated to the user for the task */
export const taskUserPointStatusEnum = pgEnum("task_user_point_status", ["not_allocated", "allocated"]);

/** Whether the user has been given an SBT for a task or group */
export const taskSBTStatusEnum = pgEnum("task_user_sbt_status", [
  "has_not_sbt",
  "pending_creation",
  "failed",
  "created",
  "notified",
  "given",
]);
export const taskUsers = pgTable("users_task", {
  id: serial("id").primaryKey(),

  // user_id references your "users" table
  userId: integer("user_id")
    .references(() => users.user_id, {
      onDelete: "no action",
      onUpdate: "no action",
    })
    .notNull(),

  taskId: integer("task_id")
    .references(() => tasks.id, {
      onDelete: "no action",
      onUpdate: "no action",
    })
    .notNull(),

  status: taskUserStatusEnum("status").notNull().default("need_to_check"),
  pointStatus: taskUserPointStatusEnum("point_status").notNull().default("not_allocated"),

  taskSbt: taskSBTStatusEnum("task_sbt").notNull().default("has_not_sbt"),
  groupSbt: taskSBTStatusEnum("group_sbt").notNull().default("has_not_sbt"),
  customData: json("custom_data"),
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

// For reading entire rows
export type TaskUsers = InferSelectModel<typeof taskUsers>;

// For inserting new rows (omitting auto-generated fields)
export type TaskUsersInsert = Omit<TaskUsers, "id" | "createdAt" | "updatedAt">;

export type TaskUsersStatusType = (typeof taskUserStatusEnum.enumValues)[number];
export type TaskUsersPointStatusType = (typeof taskUserPointStatusEnum.enumValues)[number];
export type TaskSbtStatusType = (typeof taskSBTStatusEnum.enumValues)[number];
