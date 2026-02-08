import { publicProcedure, router } from "../trpc";
import { z } from "zod";
import { getEventTicketById } from "@/db/modules/eventTickets.db";
import { TRPCError } from "@trpc/server";

export const eventTicketRouter = router({
  getEventTicketById: publicProcedure
    .input(
      z.object({
        ticketId: z.number(), // Expecting a numeric ID for the event ticket
      })
    )
    .query(async (opts) => {
      const eventTicket = await getEventTicketById(opts.input.ticketId);

      if (!eventTicket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Event ticket not found",
        });
      }

      return eventTicket;
    }),

  // Additional routes for event tickets can be added here as needed
});
