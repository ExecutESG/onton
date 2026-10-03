import { z } from "zod";

const urlSchema = z.preprocess(
  (val) => {
    if (typeof val !== "string") return val;
    let str = val.trim();
    if (!str) return str;
    // Auto-fix missing leading 'h' if user pasted 'ttps://' or 'ttp://'
    if (/^ttps?:\/\//i.test(str)) {
      str = "h" + str;
    } else if (!/^https?:\/\//i.test(str)) {
      // Auto-prepend https:// if user entered domain directly (e.g. meet.google.com/xyz)
      str = "https://" + str;
    }
    return str;
  },
  z
    .string()
    .min(1, "URL is required")
    .refine((url) => {
      try {
        const parsedUrl = new URL(url);
        // Check for valid protocol
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return false;
        }
        // Check domain has at least one dot and valid TLD
        const domainParts = parsedUrl.hostname.split(".");
        if (domainParts.length < 2) {
          return false;
        }
        // Ensure each domain part is valid
        return domainParts.every(
          (part) => part.length > 0 && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(part)
        );
      } catch {
        return false;
      }
    }, "Invalid URL format")
);

export const dataValidationSchema = {
  urlSchema,
};
