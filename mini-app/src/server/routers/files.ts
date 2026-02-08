import { UPLOAD_IMAGE_RATE_LIMIT } from "@/constants";
import { checkRateLimit } from "@/lib/checkRateLimit";
import { scanFileWithClamAV } from "@/lib/scanFileWithClamAV";
import { validateMimeType } from "@/lib/validateMimeType";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import FormData from "form-data";
import sizeOf from "image-size";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { adminOrganizerCoOrganizerProtectedProcedure, eventManagementProtectedProcedure, router } from "../trpc";
import { logger } from "../utils/logger";
import couponSchema from "@/zodSchema/couponSchema";
import { db } from "@/db/db";
import eventDB from "@/db/modules/events.db";
import { coupon_items } from "@/db/schema";
import { couponDefinitionsDB } from "@/db/modules/couponDefinitions.db";

import { randomBytes } from "crypto";
import { parse as csvParse } from "csv-parse/sync";
const API_BASE_URL = (process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000") + "/api/";

// JWT secret from env
const JWT_SECRET = process.env.ONTON_API_SECRET ?? "fallback-secret";
const genCode = () => randomBytes(10).toString("hex").toUpperCase();
export const fieldsRouter = router({
  uploadImage: adminOrganizerCoOrganizerProtectedProcedure
    .input(
      z.object({
        image: z
          .string()
          .refine(
            (file) => {
              // Remove base64 header and get the image size
              const base64Data = file.replace(/^data:image\/\w+;base64,/, "");
              const image = sizeOf(Buffer.from(base64Data, "base64"));
              if (!image || !image?.width || !image?.height) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Invalid image data",
                });
              }
              // Check if the image is square
              if (image.width !== image.height) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Only square images are allowed",
                });
              }
              if (image.width < 400 || image.height < 400) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Image is too small. Minimum size is 400x400.",
                });
              }
              // Limit the size of the file (10 MB)
              const MAX_BASE64_SIZE = 10 * 1024 * 1024;
              if (base64Data.length > MAX_BASE64_SIZE) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "File is too large",
                });
              }
              return true;
            },
            { message: "Invalid image data" }
          )
          .transform(async (data) => {
            if (!data) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid base64 data",
              });
            }

            const mimeTypeMatch = data.match(/^data:(.*?);base64,/);
            if (!mimeTypeMatch || !mimeTypeMatch[1]) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid base64 image data format",
              });
            }

            const mimeType = mimeTypeMatch[1];
            const base64Data = data.replace(/^data:image\/\w+;base64,/, "");

            if (!validateMimeType(mimeType)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid file type",
              });
            }

            // Convert base64 -> Buffer -> scan for malware
            const buffer = Buffer.from(base64Data, "base64");
            const isClean = await scanFileWithClamAV(buffer);
            if (!isClean) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Malicious file detected",
              });
            }
            return { buffer, mimeType };
          }),
        subfolder: z.enum(["event", "sbt", "channels"]),
      })
    )
    .mutation(async (opts) => {
      // 1. Rate-limit check
      const userId = opts.ctx.user.user_id;
      const { allowed, remaining } = await checkRateLimit(
        String(userId),
        "uploadImage",
        UPLOAD_IMAGE_RATE_LIMIT.max,
        UPLOAD_IMAGE_RATE_LIMIT.window
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Please wait a minute.",
        });
      }

      // 2. Build the endpoint + form data
      const uploadEndpoint = `${API_BASE_URL}/files/upload`;
      const { buffer, mimeType } = opts.input.image;
      const subfolder = opts.input.subfolder;
      const extension = mimeType.split("/")[1] || "png";
      const fullFilename = `event_image.${extension}`;

      const formData = new FormData();
      formData.append("image", buffer, {
        filename: fullFilename,
        contentType: mimeType,
      });
      formData.append("subfolder", subfolder);

      // 3. Generate JWT
      const token = jwt.sign({ scope: "uploadImage" }, JWT_SECRET, { expiresIn: "1h" });

      // 4. Make the request
      try {
        const res = await axios.post(uploadEndpoint, formData, {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.data || !res.data.imageUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File upload failed (no imageUrl in response)",
          });
        }

        // 5. Return result + remaining limit
        return { imageUrl: res.data.imageUrl, remainingRateLimit: remaining };
      } catch (error) {
        logger.error("Error during image upload:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred during image upload",
          cause: error,
        });
      }
    }),
});
