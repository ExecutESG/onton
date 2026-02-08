import eventDB from "@/db/modules/events.db";
import moderationLogDB from "@/db/modules/moderationLogger.db";
import { tgBotModerationMenu } from "@/moderationBot/menu";
import { getNoticeEmoji } from "@/moderationBot/helpers";
import { InputFile } from "grammy";
import { InputMediaPhoto, InputMediaVideo } from "grammy/types";
import axios from "axios";

export const handleUpdateEventData = async (ctx: any, originalCaption: string, eventUuid: string) => {
  // 1) Fetch the latest event data
  const updatedEvent = await eventDB.selectEventByUuid(eventUuid);
  if (!updatedEvent) {
    await ctx.answerCallbackQuery({ text: "Event not found." });
    return;
  }

  // 2) Count total notices for the event owner
  const totalNotices = await moderationLogDB.getNoticeCountForOwner(updatedEvent.owner);

  // 3) Get the circle emoji (⚪ / 🟡 / 🔴) based on total notices
  const circleEmoji = getNoticeEmoji(totalNotices);

  // 4) Build a new caption
  //    You can include whatever updated data you want (e.g., new event fields).
  //    Also include the notice info: e.g. “⚪ This user has 0 notices.”
  const newCaption = `
last message update time : ${new Date().toLocaleString()}
<b>${updatedEvent.title}</b> 

${updatedEvent.subtitle}

<b> ${circleEmoji} Notices:</b> This user has <b>${totalNotices}</b> total notice(s).

Open Event: https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}
`.trim();

  // 5) Update the moderator’s caption
  //    If you also want to update the photo, you could use ctx.api.editMessageMedia,
  //    but here we just edit the caption:
  await ctx.editMessageCaption({
    caption: newCaption,
    parse_mode: "HTML",
    // If the event is still in a "pre-approve" state, use tgBotModerationMenu;
    // if it's already approved, you could show tgBotApprovedMenu instead.
    reply_markup: tgBotModerationMenu(eventUuid),
  });
  const media_group = [
    { type: "photo", url: "https://www.kidsmathgamesonline.com/images/pictures/shapes/square.jpg" },
    {
      type: "video",
      url: "https://videos.pexels.com/video-files/9724311/9724311-hd_1440_1080_30fps.mp4",
    },
  ];

  for (const item of media_group) {
    // 6a) Download the file
    const response = await axios.get(item.url, { responseType: "arraybuffer" });
    const buffer = response.data;

    if (item.type === "photo") {
      await ctx.api.editMessageMedia(
        ctx.update.callback_query.message?.chat.id,
        ctx.update.callback_query.message?.message_id - 1,
        {
          type: "photo",
          media: new InputFile(buffer), // or direct URL if Telegram can handle it
        }
      );
    } else {
      await ctx.api.editMessageMedia(
        ctx.update.callback_query.message?.chat.id,
        ctx.update.callback_query.message?.message_id - 2,
        {
          type: "video",
          media: new InputFile(buffer),
        }
      );
    }
  }

  // 6) Let the moderator know we handled their action
  await ctx.answerCallbackQuery({ text: "Event data updated!" });
};
