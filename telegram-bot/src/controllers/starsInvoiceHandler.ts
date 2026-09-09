import { Bot } from "grammy";
import { Request, Response } from "express";
import { logger } from "../utils/logger";

export const createStarsInvoiceHandler = async (
  req: Request & { bot: Bot },
  res: Response
): Promise<Response> => {
  const { title, description, payload, starsAmount } = req.body;

  if (!title || !description || !payload || !starsAmount) {
    return res.status(400).json({ success: false, error: "Missing required invoice fields" });
  }

  try {
    const link = await req.bot.api.createInvoiceLink(
      title.slice(0, 32),
      description.slice(0, 255),
      String(payload),
      "", // provider_token must be empty string for Stars
      "XTR",
      [{ label: title.slice(0, 30), amount: Math.max(1, Math.round(Number(starsAmount))) }]
    );

    logger.log(`Created Stars invoice link for payload=${payload}, stars=${starsAmount}`);
    return res.status(200).json({ success: true, link });
  } catch (error: any) {
    logger.error("Error creating Stars invoice link:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
