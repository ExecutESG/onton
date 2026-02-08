import { z } from "zod";

export const eventStatusValues = ["ongoing", "upcoming", "not_ended", "ended", "all"] as const;

const searchEventsInputZod = z.object({
  limit: z.number().min(0).max(100).optional(),
  cursor: z.number().optional().default(0),
  search: z.string().optional().default(""),
  filter: z
    .object({
      participationType: z.array(z.enum(["online", "in_person"])).default(["online", "in_person"]),
      organizer_user_id: z.number().optional(),
      startDate: z.number().optional(),
      startDateOperator: z.enum([">=", ">", "=", "<", "<="]).default(">="),
      endDate: z.number().optional(),
      endDateOperator: z.enum([">=", ">", "=", "<", "<="]).default("<="),
      event_ids: z.array(z.number()).optional(),
      event_uuids: z.array(z.string()).optional(),
      society_hub_id: z.array(z.number()).optional(),
      user_id: z.number().optional(),
      role: z.enum(["organizer", "admin"]).optional(),
      eventStatus: z.enum(eventStatusValues).optional(),
      category_id: z.array(z.number()).optional(),
    })
    .optional(),
  sortBy: z
    .enum([
      "default", // default is by same as start_date_asc
      "time",
      "most_people_reached",
      "start_date_asc",
      "start_date_desc",
      "random",
      "do_not_order",
    ])
    .default("start_date_desc"),
  useCache: z.boolean().optional().default(true),
});

export default searchEventsInputZod;
