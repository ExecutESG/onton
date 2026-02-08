// get by id

import { db } from "@/db/db";
import { EventField, eventFields } from "@/db/schema/eventFields";
import { and, eq } from "drizzle-orm";
import { redisTools } from "@/lib/redisTools";

export const getDynamicFieldsCacheKey = (eventID: number) => redisTools.cacheKeys.dynamic_fields + eventID;

const getEventFields = async (event_id: number) => {
  return await db
    .select()
    .from(eventFields)
    .where(and(eq(eventFields.id, event_id)))
    .execute();
};
// Function to insert event field
const insertEventField = async (
  trx: typeof db, // Transaction context type
  eventFieldData: {
    emoji: string;
    title: string;
    description: string;
    placeholder: string | undefined;
    type: string;
    order_place: number;
    event_id: number;
    updatedBy: string;
  }
) => {
  await trx.transaction(async (trx) => {
    await trx.insert(eventFields).values(eventFieldData).execute();
    await redisTools.deleteCache(getDynamicFieldsCacheKey(eventFieldData.event_id));
  });
};

// Function to update an event field
const updateEventFieldLog = async (trx: typeof db, fieldId: number, updatedBy: string) => {
  await trx
    .update(eventFields)
    .set({
      updatedBy: updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(eventFields.id, fieldId))
    .execute();
};

// Function to select event fields by event ID
const selectEventFieldsByEventId = async (trx: typeof db, eventId: number) => {
  return await trx.select().from(eventFields).where(eq(eventFields.event_id, eventId)).execute();
};

// Function to delete an event field by its ID
const deleteEventFieldById = async (trx: typeof db, fieldId: number, eventId: number) => {
  await trx.transaction(async (trx) => {
    await redisTools.deleteCache(getDynamicFieldsCacheKey(eventId));
    return await trx
      .delete(eventFields)
      .where(and(eq(eventFields.id, fieldId), eq(eventFields.event_id, eventId)))
      .execute();
  });
};

// Upsert (update or insert) event field based on field existence
const upsertEventField = async (trx: typeof db, field: any, index: number, userId: string, eventId: number) => {
  const fieldData = {
    emoji: field.emoji,
    title: field.title,
    description: field.description,
    placeholder: field.type === "button" ? field.url : field.placeholder,
    type: field.type,
    order_place: index,
    updatedBy: userId,
    updatedAt: new Date(),
  };

  await trx.transaction(async (trx) => {
    if (field.id) {
      // Update the existing field
      await trx.update(eventFields).set(fieldData).where(eq(eventFields.id, field.id)).execute();
    } else {
      // Insert a new field
      await trx
        .insert(eventFields)
        .values({
          ...fieldData,
          event_id: eventId, // Include event ID for new records
        })
        .execute();
    }
    await redisTools.deleteCache(getDynamicFieldsCacheKey(eventId));
  });
};

// Function to handle dynamic fields
const handleDynamicFields = async (trx: typeof db, eventData: any, userId: string, eventId: number) => {
  const dynamicFields = eventData.dynamic_fields.filter((f: any) => f.title !== "secret_phrase_onton_input");

  for (const [index, field] of dynamicFields.entries()) {
    await upsertEventField(trx, field, index, userId, eventId);
  }
};
// Function to get event field of secret_phrase_onton_input
const getEventFieldByTitleAndEventId = async (title: string, eventId: number) => {
  const result = await db
    .select()
    .from(eventFields)
    .where(and(eq(eventFields.title, title), eq(eventFields.event_id, eventId)))
    .execute();
  return result[0];
};
const getDynamicFields = async (eventId: number): Promise<EventField[] | null> => {
  let dynamicFields = null;
  const cachedDynamicFields = await redisTools.getCache(eventFieldsDB.getDynamicFieldsCacheKey(eventId));
  if (cachedDynamicFields) {
    dynamicFields = cachedDynamicFields;
  } else {
    dynamicFields = await db
      .select()
      .from(eventFields)
      .where(eq(eventFields.event_id, eventId))
      .execute()
      // remove the placeholder from dynamic fields
      .then((fields) =>
        fields.map((field) => {
          if (field.title === "secret_phrase_onton_input") {
            return {
              ...field,
              placeholder: "",
            };
          }
          return field;
        })
      );
    dynamicFields.sort((a, b) => a.order_place! - b.order_place!);
    await redisTools.setCache(eventFieldsDB.getDynamicFieldsCacheKey(eventId), dynamicFields, redisTools.cacheLvl.short);
  }
  return dynamicFields;
};
// export module
const eventFieldsDB = {
  getEventFields,
  insertEventField,
  updateEventFieldLog,
  selectEventFieldsByEventId,
  deleteEventFieldById,
  upsertEventField,
  handleDynamicFields,
  getEventFieldByTitleAndEventId,
  getDynamicFieldsCacheKey,
  getDynamicFields,
};
export default eventFieldsDB;
