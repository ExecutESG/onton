import { NextRequest } from "next/server";
import { apiKeyAuthentication, getAuthenticatedUser } from "@/server/auth";
import { getTournamentDetails } from "@/lib/elympicsApi";
import { db } from "@/db/db"; // Drizzle main instance for transactions
import { gamesDB } from "@/db/modules/games.db";
import { tournamentsDB } from "@/db/modules/tournaments.db";
import { logger } from "@/server/utils/logger";
import sizeOf from "image-size";
import { scanFileWithClamAV } from "@/lib/scanFileWithClamAV";
import axios from "axios";
import FormData from "form-data";
import { File as FormidableFile } from "formidable";
import jwt from "jsonwebtoken";
import fs from "fs";
import { parseMultipartForm } from "@/lib/parseMultipartForm";
import { z } from "zod";
import { TonSocietyRegisterActivityT } from "@/types/event.types";

import { PLACEHOLDER_IMAGE, PLACEHOLDER_VIDEO } from "@/constants";
import { fetchSBTRewardCollectionById, SBTRewardCollectionDB } from "@/db/modules/SBTRewardCollection.db";
import { registerActivity } from "@/lib/ton-society-api";

/** Env config / constants **/

const UPLOAD_FILE_ENDPOINT = (process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000") + "/api/files/upload";
const UPLOAD_TOKEN = process.env.ONTON_API_SECRET || "fallback-secret";

export const runtime = "nodejs";

/** Zod schema: If provided, must be a valid URL. */
const linkSchema = z.string().url("invalid_tournament_link").optional();

/**
 * POST /api/tournament/[mode]/[gameId]/[tournamentId]/[userId]
 *
 * Steps:
 *  - If mode === "check": fetch from Elympics, validate gameId, return data
 *  - If mode === "create": parse form (file + tournament_link), validate, upload, fetch Elympics, DB insert
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { mode: string; gameId: string; tournamentId: string; userId: string } }
) {
  // 1) Auth checks
  const [, userError] = getAuthenticatedUser();
  const apiKeyError = apiKeyAuthentication(req);
  if (userError && apiKeyError) {
    return new Response(JSON.stringify({ message: "unauthorized" }), { status: 401 });
  }

  const { mode, gameId, tournamentId, userId } = params;
  if (!mode || !gameId || !tournamentId) {
    return new Response(JSON.stringify({ message: "missing_required_params" }), { status: 400 });
  }

  // 2) If mode === 'check' => fetch & return data
  if (mode === "check") {
    try {
      const details = await getTournamentDetails(tournamentId);
      if (!details) {
        return new Response(JSON.stringify({ message: "tournament_not_found_in_elympics" }), { status: 404 });
      }
      if (details.GameId !== gameId) {
        return new Response(
          JSON.stringify({
            message: "mismatched_game_id",
            expected: gameId,
            actual: details.GameId,
          }),
          { status: 400 }
        );
      }
      // Return the Elympics data
      return new Response(JSON.stringify({ data: details }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      logger.error("Error fetching Elympics tournament (check):", error);
      return new Response(JSON.stringify({ message: "elympics_fetch_error" }), { status: 500 });
    }
  }

  // 3) If mode === 'create' => parse form + link + file => upload => DB insert
  if (mode === "create") {
    // a) parse multipart form => get file + tournament_link
    let fileBuffer: Buffer | null = null;
    let mimeType: string | null = null;
    let tLink: string | null = null;
    let society_hub_id: string | null = null;
    let sbt_collection_id: string | null = null;
    try {
      const { fields, files } = await parseMultipartForm(req);
      if (!files || !files.file) {
        return new Response(JSON.stringify({ message: "file_required" }), { status: 400 });
      }
      if (!fields?.tournament_link) {
        return new Response(JSON.stringify({ message: "tournament_link_required" }), { status: 400 });
      }
      if (!fields?.sbt_collection_id) {
        return new Response(JSON.stringify({ message: "sbt_collection_id_required" }), { status: 400 });
      }
      if (!fields?.society_hub_id) {
        return new Response(JSON.stringify({ message: "society_hub_id_required" }), { status: 400 });
      }
      if (fields.sbt_collection_id) {
        const sbtCollection = await fetchSBTRewardCollectionById(Number(fields.sbt_collection_id));
        if (!sbtCollection) {
          return new Response(JSON.stringify({ message: "sbt_collection_not_found" }), { status: 404 });
        }
      }
      society_hub_id = Array.isArray(fields.society_hub_id) ? fields.society_hub_id[0] : fields.society_hub_id;
      sbt_collection_id = Array.isArray(fields.sbt_collection_id) ? fields.sbt_collection_id[0] : fields.sbt_collection_id;
      // read the file
      const fileData = Array.isArray(files.file) ? files.file[0] : files.file;
      const filePath = (fileData as FormidableFile).filepath;
      fileBuffer = fs.readFileSync(filePath);
      mimeType = (fileData as FormidableFile).mimetype || "image/png";
      const link = Array.isArray(fields.tournament_link) ? fields.tournament_link[0] : fields.tournament_link;

      // parse optional tournament_link from fields
      logger.log("fields?.tournament_link", link);
      // validate link with Zod
      try {
        const parsedLink = linkSchema.parse(link);
        tLink = parsedLink || null; // if not provided => null
      } catch (zerr) {
        logger.error("Zod link error =>", zerr);
        return new Response(JSON.stringify({ message: "invalid_tournament_link" }), { status: 400 });
      }
    } catch (err) {
      logger.error("Error parsing multipart form:", err);
      return new Response(JSON.stringify({ message: "parse_form_error" }), { status: 400 });
    }

    if (!fileBuffer) {
      return new Response(JSON.stringify({ message: "file_buffer_empty" }), { status: 400 });
    }

    // b) Validate image size/dimensions (≥400x400, we won't enforce square if you want keep it consistent)
    try {
      const dimensions = sizeOf(fileBuffer);
      if (!dimensions.width || !dimensions.height) {
        return new Response(JSON.stringify({ message: "invalid_image_dimensions" }), { status: 400 });
      }
      if (dimensions.width < 400 || dimensions.height < 400) {
        return new Response(JSON.stringify({ message: "Image too small. Min 400x400." }), { status: 400 });
      }

      if (dimensions.width !== dimensions.height) {
        return new Response(JSON.stringify({ message: "image_must_be_square" }), { status: 400 });
      }
    } catch (err) {
      logger.error("Error reading image dimensions:", err);
      return new Response(JSON.stringify({ message: "failed_image_dimensions" }), { status: 400 });
    }

    // c) ClamAV scanning
    let isClean = false;
    try {
      isClean = await scanFileWithClamAV(fileBuffer);
    } catch (err) {
      logger.error("Error scanning file with ClamAV:", err);
      return new Response(JSON.stringify({ message: "clamav_scan_error" }), { status: 400 });
    }
    if (!isClean) {
      return new Response(JSON.stringify({ message: "malicious_file_detected" }), { status: 400 });
    }

    // d) Upload image
    let uploadedImageUrl = "";
    try {
      const formData = new FormData();
      const ext = mimeType.split("/")[1] || "png";
      formData.append("image", fileBuffer, {
        filename: `tournament_image_${tournamentId}_user_${userId}.${ext}`,
        contentType: mimeType,
      });
      formData.append("subfolder", "event");

      const token = jwt.sign({ scope: "uploadImage" }, UPLOAD_TOKEN, { expiresIn: "1h" });
      const res = await axios.post(UPLOAD_FILE_ENDPOINT, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.data?.imageUrl) {
        return new Response(JSON.stringify({ message: "upload_failed_no_imageUrl" }), { status: 500 });
      }
      uploadedImageUrl = res.data.imageUrl;
    } catch (err) {
      logger.error("Error uploading image to /files/upload:", err);
      return new Response(JSON.stringify({ message: "file_upload_error" }), { status: 500 });
    }

    // e) Fetch Elympics => validate
    let details;
    try {
      details = await getTournamentDetails(tournamentId);
      if (!details) {
        return new Response(JSON.stringify({ message: "tournament_not_found_in_elympics" }), { status: 404 });
      }
      if (details.GameId !== gameId) {
        return new Response(
          JSON.stringify({
            message: "mismatched_game_id",
            expected: gameId,
            actual: details.GameId,
          }),
          { status: 400 }
        );
      }
    } catch (error) {
      logger.error("Error fetching Elympics tournament (create):", error);
      return new Response(JSON.stringify({ message: "elympics_fetch_error" }), { status: 500 });
    }

    // f) Insert into local DB with a transaction (game + tournament)
    try {
      const sbtCollection = await SBTRewardCollectionDB.fetchSBTRewardCollectionById(Number(sbt_collection_id));
      if (!sbtCollection) {
        return new Response(JSON.stringify({ message: "sbt_collection_not_found" }), { status: 404 });
      }
      const numericUserId = parseInt(userId, 10) || 0;
      const result = await db.transaction(async (trx) => {
        // 1) If you only want to create a new game if not found, do something like:
        let gameRow = await gamesDB.getGameById(gameId);
        if (!gameRow) {
          gameRow = await gamesDB.insertGameTx(trx, {
            hostGameId: gameId,
            userId: numericUserId,
            name: details.Name ?? "",
            imageUrl: "",
            rawGameJson: details as any,
          });
        }
        if (!gameRow) {
          logger.error("Failed to insert game:", gameId);
          throw new Error("Failed to insert game");
        }
        // 2) Insert tournament (store 'uploadedImageUrl' + optional tournament_link)
        const insertedTournament = await tournamentsDB.insertTournamentTx(trx, {
          hostTournamentId: details.Id,
          hostTournamentGuid: details.TournamentGuid,
          gameId: gameRow?.id ?? 1,
          createdByUserId: numericUserId,
          owner: numericUserId,
          name: details.Name,
          imageUrl: uploadedImageUrl,
          state: details.State === "Active" ? "Active" : "Concluded",
          createDate: details.CreateDate ? new Date(details.CreateDate) : null,
          startDate: details.StartDate ? new Date(details.StartDate) : null,
          endDate: details.EndDate ? new Date(details.EndDate) : null,
          playersCount: details.PlayersCount,
          entryFee: details.EntryFee,
          tonEntryType: details.TonDetails?.EntryType === "Tickets" ? "Tickets" : "Pass",
          tonTournamentAddress: details.TonDetails?.TournamentAddress,
          prizePoolStatus: "Undefined",
          prizeType: details.PrizeType === "Coin" ? "Coin" : "None",
          currentPrizePool: details.CurrentPrizePool,
          activityId: null,
          tsRewardImage: sbtCollection.imageLink ?? null,
          tsRewardVideo: sbtCollection.videoLink ?? null,
          hidden: false,
          rawHostJson: details as any,
          tournamentLink: tLink, // Insert the validated link here
          rewardLink: null,
        });

        if (!insertedTournament) {
          logger.error("Failed to insert tournament:", details.Id);
          throw new Error("Failed to insert tournament");
        }

        const tournamentDraft: TonSocietyRegisterActivityT = {
          title: details.Name,
          subtitle: gameRow.name ?? "",
          description: `${details.Name} - ${gameRow.name}`,
          hub_id: parseInt(society_hub_id),
          start_date: details.StartDate,
          end_date: details.EndDate,
          additional_info: "Online",
          cta_button: {
            link: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=tournaments_${insertedTournament.id}`,
            label: "Enter Tournament",
          },

          rewards: {
            mint_type: "manual",
            collection: {
              title: details.Name,
              description: `${details.Name} - ${gameRow.name}`,
              image: {
                url: process.env.ENV !== "local" ? (insertedTournament.tsRewardImage ?? undefined) : PLACEHOLDER_IMAGE,
              },
              cover: {
                url: process.env.ENV !== "local" ? (insertedTournament.tsRewardImage ?? undefined) : PLACEHOLDER_IMAGE,
              },
              item_title: details.Name,
              item_description: "Reward for participation",
              item_image: {
                url: process.env.ENV !== "local" ? (insertedTournament.tsRewardImage ?? undefined) : PLACEHOLDER_IMAGE,
              },
              ...(insertedTournament.tsRewardVideo
                ? {
                    item_video: {
                      url:
                        process.env.ENV !== "local"
                          ? new URL(insertedTournament.tsRewardVideo).origin +
                            new URL(insertedTournament.tsRewardVideo).pathname
                          : PLACEHOLDER_VIDEO,
                    },
                  }
                : {}),
              item_metadata: {
                activity_type: "event",
                place: {
                  type: "Online",
                },
              },
            },
          },
        };
        const ton_society_result = await registerActivity(tournamentDraft);
        if (!ton_society_result.data.activity_id) {
          throw new Error("Failed to create activity in Ton Society");
        }
        logger.log(
          `Created activity in Ton Society with ID: ${ton_society_result.data.activity_id} for tournament ID: ${insertedTournament.id}`
        );
        // Update the tournament with the activity ID
        await tournamentsDB.updateActivityIdTrx(trx, ton_society_result.data.activity_id, insertedTournament.id);

        return { insertedTournament, activity_id: ton_society_result.data.activity_id };
      });
      return new Response(JSON.stringify({ message: "success", tournament: result.insertedTournament }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      logger.error("Error creating game/tournament in DB (transaction):", err);
      return new Response(JSON.stringify({ message: "db_insert_error" }), { status: 500 });
    }
  }

  // If mode is neither "check" nor "create", return an error
  return new Response(JSON.stringify({ message: "invalid_mode" }), { status: 400 });
}
