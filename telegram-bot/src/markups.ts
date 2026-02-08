import { InlineKeyboard } from "grammy";

const startKeyboard = () => {
  return new InlineKeyboard()
    .webApp("Explore Events", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/`).row()

};


const shareKeyboard = (url: string) => {
  const id = url.split("/").pop().replace("event?startapp=", "") || "";

  return new InlineKeyboard()
    .switchInline("Share Event", url).row()
    .webApp("Manage Event", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/events/${id}/manage`).row()
    .webApp("All Events", `${process.env.NEXT_PUBLIC_APP_BASE_URL}/`);
};


const backKeyboard = new InlineKeyboard().text("Back", "back");
const inlineSendKeyboard = () => {
  return new InlineKeyboard().text("Refresh", "refresh");
};

export { backKeyboard, inlineSendKeyboard, shareKeyboard, startKeyboard };
