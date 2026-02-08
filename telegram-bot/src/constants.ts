import "dotenv/config";

export const BOT_TOKEN = process.env.BOT_TOKEN || "";
export const JWT_SECRET = process.env.ONTON_API_SECRET || ""; // for signing upload auth
export const API_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "";
// 5 requests/second => 200 ms per request for update profiles
export const REQUESTS_PER_SECOND = 10;
export const MS_PER_REQUEST = 1000 / REQUESTS_PER_SECOND;

// Define rate limit options
export const RATE_LIMIT_OPTIONS = {
  windowSec: 60, // 1 minute
  max: REQUESTS_PER_SECOND, // limit each IP to 5 requests per windowMs
  message: "❌ You have exceeded the maximum 10 commands per minute. Please wait and try again.",
};

export const additionalRecipients = [
  748891997, // samyar_kd
  185027333, // sid_hazrati
  23932283, // Mfarimani
  7013087032, // Ontonadmin
  91896720, //elbabix
  548648769, // Radiophp
];

/**
 * Regex to detect invite placeholders: {invite:-100XXXX}
 * capturing -?\d+ as group #1
 */
export const INVITE_PLACEHOLDER_REGEX = /\{invite:(-?\d+)\}/g;

/** Existing affiliate placeholders: {onion1-campaign}, etc. */
export const AFFILIATE_PLACEHOLDERS = [
  "{onion1-special-affiliations}",
  "{onion1-campaign}",
    "{fairlaunch-partnership}",
];

export const TBOOK_FAIRLAUNCH_MINIAPP_URL =
    "https://engage.tbook.com/fair-launch/onion";
