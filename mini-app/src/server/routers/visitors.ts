import { z } from "zod";
import { selectVisitorsByEventUuid } from "@/db/modules/visitors.db";
import { eventManagementProtectedProcedure, router } from "../trpc";

export const visitorsRouter = router({
  // protect
  getAll: eventManagementProtectedProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        cursor: z.number().optional(),
        dynamic_fields: z.boolean().optional(),
        search: z.string().optional().default(""),
      })
    )
    .query(async (opts) => {
      const { limit = 25, cursor = 0, dynamic_fields = true } = opts.input;
      const data = await selectVisitorsByEventUuid(opts.input.event_uuid, limit, cursor, dynamic_fields, opts.input.search);
      return { ...data, event: opts.ctx.event || null };
    }),
});
