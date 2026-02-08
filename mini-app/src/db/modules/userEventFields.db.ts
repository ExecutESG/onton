import { eventFields, events, userEventFields } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/db";

export const getUserEventFields = async (user_id: number, event_id: number) => {
  return await db
    .select()
    .from(userEventFields)
    .where(and(eq(userEventFields.event_id, event_id), eq(userEventFields.user_id, user_id)))
    .execute();
};

export const checkPasswordTask = async (user_id: number, event_id: number) => {
  const userEventFieldsData = await getUserEventFields(user_id, event_id);
  return userEventFieldsData.find((field) => field.completed);
};

export const upsertUserEventFields = async (
  user_id: number,
  event_id: number,
  field_id: number,
  data: string
) => {
  return await db
    .insert(userEventFields)
    .values({
      user_id: user_id,
      event_id: event_id,
      event_field_id: field_id,
      data: data,
      completed: true,
      created_at: new Date(),
      updatedBy: user_id.toString(),
    })
    .onConflictDoUpdate({
      target: [userEventFields.user_id, userEventFields.event_field_id],
      set: {
        data: data,
        completed: true,
        updatedAt: new Date(),
      },
    })
    .returning()
    .execute();
};

export const getSecureUserEventFields = async (user_id: number, event_uuid: string) => {
  return await db
    .select({
      eventFieldId: userEventFields.event_field_id,
      userData: userEventFields.data,
      completed: userEventFields.completed,
      createdAt: userEventFields.created_at,
      // Add other fields from userEventFields as necessary
    })
    .from(events)
    .innerJoin(eventFields, eq(eventFields.event_id, events.event_id))
    .leftJoin(
      userEventFields,
      and(eq(userEventFields.event_field_id, eventFields.id), eq(userEventFields.user_id, user_id))
    )
    .where(eq(events.event_uuid, event_uuid))
    .execute();
};

// export module
const userEventFieldsDB = {
  getUserEventFields,
  checkPasswordTask,
  upsertUserEventFields,
  getSecureUserEventFields,
};

export default userEventFieldsDB;
