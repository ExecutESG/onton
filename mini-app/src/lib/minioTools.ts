import axios from "axios";
import FormData from "form-data";
import { logger } from "@/server/utils/logger";
import jwt from "jsonwebtoken";
import { readRequiredSecret } from "@/server/utils/requiredSecrets";

// We'll read our base URL from NEXT_PUBLIC_APP_BASE_URL (fallback: localhost)
// and ensure we point to /api/files/upload-json
const API_BASE_URL = (process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000") + "/api/";

// Upload JWTs are signed with ONTON_API_SECRET only (no "fallback-secret", #1052).

/**
 * Uploads JSON data to the new Next.js "upload-json" endpoint.
 *
 * @param jsonData  - The JSON object to upload.
 * @param bucketName - The target bucket in MinIO.
 * @param subfolder  - (Optional) subfolder to prepend in the final file path.
 * @returns The public JSON URL returned by the server.
 */
export const uploadJsonToMinio = async (
  jsonData: Record<string, any>,
  bucketName: string,
  subfolder: string = ""
): Promise<string> => {
  // 1. Convert the JSON object into a Buffer
  const buffer = Buffer.from(JSON.stringify(jsonData));
  const fullFilename = subfolder ? `${subfolder}/metadata.json` : "metadata.json";

  // 2. Build FormData
  const formData = new FormData();
  formData.append("json", buffer, {
    filename: fullFilename,
    contentType: "application/json",
  });
  formData.append("bucketName", bucketName);

  // 3. Construct the new Next.js endpoint
  const url = `${API_BASE_URL}files/upload-json`;

  // 4. (Optional) Generate a JWT if your new endpoint requires auth
  const token = jwt.sign({ scope: "uploadJson" }, readRequiredSecret("ONTON_API_SECRET"), {
    expiresIn: "1h",
    algorithm: "HS256",
  });

  try {
    // 5. Post to the new "upload-json" route
    const res = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`,  // If your route enforces JWT
      },
    });

    // 6. Validate the response
    if (!res.data || !res.data.jsonUrl) {
      logger.error("JSON upload failed (no jsonUrl in response)",res);
      throw new Error("JSON upload failed (no jsonUrl in response)");
    }

    // 7. Return the URL
    return res.data.jsonUrl;
  } catch (error) {
    logger.error("Error during JSON upload:", error);
    throw new Error("An error occurred during JSON upload");
  }
};
