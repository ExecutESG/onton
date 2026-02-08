import { db } from "@/db/db";
import { TRPCError, initTRPC } from "@trpc/server";
import { z } from "zod";
import { createContext } from "./context";
import { accessRolesPathConfig } from "./accessRolesPathConfig";
import { userRolesDB } from "@/db/modules/userRoles.db";
import { accessRoleEnumType, accessRoleItemType } from "@/db/schema/userRoles";
import { walletFromHeader } from "./auth";

export const trpcApiInstance = initTRPC.context<typeof createContext>().create();

export const router = trpcApiInstance.router;

export const publicProcedure = trpcApiInstance.procedure;

// protected using initData
export const initDataProtectedProcedure = trpcApiInstance.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No auth header found",
    });
  }

  if (opts.ctx.user.role === "ban") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "user is banned",
    });
  }

  return opts.next({
    ctx: {
      user: opts.ctx.user,
    },
  });
});

export const adminOrganizerProtectedProcedure = initDataProtectedProcedure.use((opts) => {
  if (opts.ctx.user.role !== "admin" && opts.ctx.user.role !== "organizer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Unauthorized access, invalid Admin role",
    });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      userRole: opts.ctx.user.role as "admin" | "organizer" | "user",
    },
  });
});

export const adminOrganizerCoOrganizerProtectedProcedure = initDataProtectedProcedure.use(async (opts) => {
  if (opts.ctx.user.role !== "admin" && opts.ctx.user.role !== "organizer") {
    const userAdminAccessRolesToEvent = await userRolesDB.checkHasAnyAccessToItemType(
      opts.ctx.user.user_id,
      ["admin"] as accessRoleEnumType[],
      "event" as accessRoleItemType
    );
    const coOrganizerHasAdminAccess =
      userAdminAccessRolesToEvent.length > 0 && opts.path && accessRolesPathConfig.admin.includes(opts.path);
    if (coOrganizerHasAdminAccess) {
      return opts.next({
        ctx: {
          ...opts.ctx,
          userRole: opts.ctx.user.role as "admin" | "organizer" | "user",
        },
      });
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Unauthorized access, invalid Admin role",
    });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      userRole: opts.ctx.user.role as "admin" | "organizer" | "user",
    },
  });
});

export const eventManagementProtectedProcedure = initDataProtectedProcedure
  .input(z.object({ event_uuid: z.string().uuid() }))
  .use(async (opts) => {
    const event = await db.query.events.findFirst({
      where: (fields, { eq }) => {
        return eq(fields.event_uuid, opts.input.event_uuid);
      },
    });
    if (!event) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "event not found",
      });
    }

    const userAdminAccessRolesToEvent = await userRolesDB.checkAccess(
      opts.ctx.user.user_id,
      ["admin"] as accessRoleEnumType[],
      "event" as accessRoleItemType,
      event.event_id
    );
    const userAccessRolesToEventToPath = await userRolesDB.checkAccess(
      opts.ctx.user.user_id,
      ["checkin_officer"] as accessRoleEnumType[],
      "event" as accessRoleItemType,
      event.event_id
    );

    const userHasAccessToPath =
      userAccessRolesToEventToPath.length > 0 && accessRolesPathConfig.checkin_officer.includes(opts.path);

    if (
      opts.ctx.user.role !== "admin" &&
      opts.ctx.user.role !== "organizer" &&
      userAdminAccessRolesToEvent.length === 0 &&
      !userHasAccessToPath
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Unauthorized access, invalid event Management role",
      });
    }

    if (
      opts.ctx.user.role === "organizer" &&
      event.owner !== opts.ctx.user.user_id &&
      userAdminAccessRolesToEvent.length === 0 &&
      !userHasAccessToPath
    ) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Unauthorized access, you don't have access to this event",
      });
    }

    return opts.next({
      ctx: {
        ...opts.ctx,
        event,
      },
    });
  });

export const walletJWTProtectedProcedure = initDataProtectedProcedure.use(async (opts) => {
  // 1. Verify & decode the JWT from headers
  const jwt = await walletFromHeader(opts.ctx.req.headers as Headers);

  // 2. Make it available downstream
  return opts.next({
    ctx: {
      ...opts.ctx,
      jwt, // { address, network }
    },
  });
});
