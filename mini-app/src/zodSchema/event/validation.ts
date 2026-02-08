import { StoreEventData } from "@/zustand/createEventStore";
import { z } from "zod";
import { dataValidationSchema } from "../dataValidationSchema";

export const generalStepDataSchema = z.object({
  title: z.string({ required_error: "Please enter a title" }).min(5, { message: "Title must be at least 5 characters" }),
  subtitle: z
    .string({ required_error: "Please enter a subtitle" })
    .min(1, { message: "Subtitle must be at least 1 characters" }),
  description: z
    .string({ required_error: "Please enter a description" })
    .min(20, { message: "Description must be at least 20 character" }),
  image_url: z.string({ required_error: "Please select an image" }).url({ message: "Please select a valid image" }),
  hub: z.string({ required_error: "Please select a hub" }).min(1, { message: "Please select a hub" }),
  category_id: z.number({ required_error: "Please select a category" }),
});

export function rewardStepValidation(isPaid: boolean, hasRegistration: boolean, editing: boolean) {
  return z.object({
    secret_phrase:
      isPaid || hasRegistration
        ? z.string().optional() // Not required when the event is paid
        : editing
          ? z.string().optional()
          : z
              .string()
              .min(4, { message: "Password must be at least 4 characters" })
              .max(60, { message: "Password must be less than 60 characters" }),
    ts_reward_url: editing
      ? z.string().url({ message: "Please select a valid reward image URL" }).optional()
      : z.string().url({ message: "Please select a valid reward image URL" }),
    video_url: editing
      ? z.string().url({ message: "Please select a valid reward video URL" }).optional()
      : z.string().url({ message: "Please select a valid reward video URL" }),
  });
}

export function timeplaceStepValidation(
  editOptions: { eventHash?: string } | undefined,
  startDateLimit: number,
  eventData: StoreEventData | undefined,
  formDataObject: Record<string, any>
) {
  return z
    .object({
      // if it was an update we let users enter whenever time they want
      start_date: z
        .number()
        .positive("Start date must be a valid positive timestamp")
        .refine((data) => Boolean(editOptions?.eventHash) || data > startDateLimit, {
          message: "Start date must be in the future",
        }),
      end_date: z
        .number()
        .positive("End date must be a valid positive timestamp")
        // End date must be greater than now
        .min((Date.now() + 1000 * 60 * 4) / 1000, {
          message: "End date must be in the future",
        })
        .refine(
          (data) => {
            return Boolean(editOptions?.eventHash) || data > formDataObject?.start_date!;
          },
          {
            message: "End date must be after start date",
          }
        ),
      timezone: z.string().min(1),
      duration: z.number().refine((data) => data > 0, {
        message: "Duration must be greater than 0",
      }),
      eventLocationType: z.enum(["online", "in_person"]),
      location: z.string().optional(),
      cityId: z.number().optional(),
      countryId: z.number().optional(),
    })
    .refine(
      (data) => {
        if (data.eventLocationType === "online") {
          return dataValidationSchema.urlSchema.safeParse(data.location).success;
        }
        return true;
      },
      {
        message: "Please enter a valid URL for online events",
        path: ["location"],
      }
    )
    .refine(
      (data) => {
        if (data.eventLocationType === "in_person") {
          return data.cityId !== undefined && data.countryId !== undefined;
        }
        return true;
      },
      {
        message: "City and Country are required for in-person events",
        path: ["cityId", "countryId"],
      }
    );
}
