import { db } from "@/db/db";
import { users } from "@/db/schema";
import { validate } from "@tma.js/init-data-node";
import { eq } from "drizzle-orm";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import "@/lib/gracefullyShutdown";

const userDataSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

// in seconds
const JWT_COOKIE_EXPIRATION = 86_400; // 1 day

export async function GET(req: NextRequest) {
  try {
    const initData = req.nextUrl.searchParams.get("init_data");

    if (!initData) {
      return Response.json({ error: "no_init_data" }, { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const initDataSearchParams = new URLSearchParams(initData);

    // Check if the request is valid and from Telegram
    try {
      validate(initData, process.env.BOT_TOKEN as string);
    } catch (error) {
      console.error("Authentication Failed in 35 auth/route");
      console.error(error);
      console.error("==========");

      return Response.json(
        { error: "invalid_init_data" },
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userRaw = initDataSearchParams.get("user");

    const userdata = userDataSchema.safeParse(JSON.parse(userRaw as string));

    if (!userdata.success) {
      console.error("Authentication Failed in 50 auth/route");
      console.error(userRaw, userdata.error);
      console.error("==========");
      return Response.json(
        { error: "invalid_init_user_data" },
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user exists in modules
    let user = (await db.select().from(users).where(eq(users.user_id, userdata.data.id)).execute()).pop();

    if (!user) {
      user = (
        await db
          .insert(users)
          .values({
            user_id: userdata.data.id,
            first_name: userdata.data.first_name,
            role: "user",
            language_code: userdata.data.language_code,
            last_name: userdata.data.last_name,
            username: userdata.data.username,
            updatedBy: "system",
          })
          .returning()
          .execute()
      ).pop();
    }

    if (!user) {
      return Response.json(
        { error: "user_data_not_found" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Every time user signs in we generate another jwt token
    const token = jwt.sign(
      {
        id: user?.user_id,
        name: user?.first_name,
        // 6h expiration for jwt token
        exp: Math.floor(Date.now() / 1000) + JWT_COOKIE_EXPIRATION,
      },
      process.env.BOT_TOKEN as string
    );
    cookies().set("token", token, {
      // expiration 7 days
      expires: new Date(Date.now() + 1000 * JWT_COOKIE_EXPIRATION),
      sameSite: "none",
      secure: true,
      partitioned: true,
    });

    return Response.json(
      { token, user, ok: true },
      {
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: "zod_error",
          message: error.message,
        },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("==============================");
    console.error("Error:", error);
    console.error("==============================");

    return Response.json(
      { error: "server_error" },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const dynamic = "force-dynamic";
