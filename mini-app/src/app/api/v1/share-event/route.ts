import { getAuthenticatedUser } from "@/server/auth";
import axios from "axios";
import { NextRequest } from "next/server";
import "@/lib/gracefullyShutdown";

import { getTelegramBotBaseUrl } from "@/lib/tgBotConfig";

export async function GET(req: NextRequest): Promise<Response> {
  const [, err] = getAuthenticatedUser();
  if (err && process.env.NODE_ENV === "production") {
    return err;
  }

  const event_uuid = req.nextUrl.searchParams.get("event_uuid");
  const user_id = req.nextUrl.searchParams.get("user_id");

  await axios.post(`${getTelegramBotBaseUrl()}/share-event`, {
    user_id,
    id: event_uuid,
    url: `${process.env.NEXT_PUBLIC_APP_BASE_URL}/ptma/event/${event_uuid}`,
    share_link: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${event_uuid}`,
  });

  return Response.json({ message: "share message sent successfully" });
}

export const dynamic = "force-dynamic";
