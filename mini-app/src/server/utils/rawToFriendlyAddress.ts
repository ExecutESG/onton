import { Address } from "@ton/core";

// Suppose you have a global or environment flag for isMainnet:
import { is_mainnet } from "@/services/tonCenter";
import { logger } from "@/server/utils/logger";
export function rawToFriendlyAddress(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const addressObj = Address.parse(raw);
    // bounceable & testOnly can be toggled based on environment
    const friendly = addressObj.toString({
      bounceable: true,
      testOnly: !is_mainnet,
    });
    return friendly;
  } catch (err) {
    // If parse fails (invalid raw address), fallback
    logger.error("Error parsing address:", err);
    return "";
  }
}
