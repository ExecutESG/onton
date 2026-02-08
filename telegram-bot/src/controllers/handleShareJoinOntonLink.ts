// handleShareAffiliateLink.ts or a new file
import { Bot } from "grammy";
import { Request, Response } from "express";
import { logger } from "../utils/logger";

export async function handleShareJoinOntonLink(req: Request & { bot: Bot }, res: Response) {
    const { requesting_user, link_hash, share_link, fallback_url, affiliate_data } = req.body;

    if (!requesting_user || !link_hash || !affiliate_data) {
        return res.status(400).json({ message: "Missing data" });
    }

    try {
        const { imageUrl } = affiliate_data;
        // Build your message text
        const caption = `
<b>Join ONTON Affiliate</b>

Check out this exclusive ONTON referral link for special tasks and bonuses:
${share_link}
Good luck and see you in the ONTON world! 🏆
`;

        const inline_keyboard = [
            [
                {
                    text: "Open Link",
                    web_app: { url: fallback_url },
                },
            ],
        ];

        // If you want to send an image, you'd do:
        // But for simplicity, let's just send text. If you want an image, see your onion example
        await req.bot.api.sendMessage(Number(requesting_user), caption, {
            parse_mode: "HTML",
            // reply_markup: { inline_keyboard }, // do not uncomment this , it will fail affiliate link counter
        });

        return res.json({ success: true });
    } catch (error) {
        logger.error("Error handleShareJoinOntonLink:", error);
        return res.status(500).json({ message: "Failed to share join-onton link" });
    }
}
