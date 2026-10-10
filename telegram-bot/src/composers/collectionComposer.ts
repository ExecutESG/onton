import { Composer, InlineKeyboard } from "grammy";
import axios from "axios";
import { MyContext } from "../types/MyContext";
import { logger } from "../utils/logger";
import { isUserAdmin } from "../db/users";
import { createCollection, getCollectionsByHubId, updateCollection } from "../db/db";
import { SbtRewardCollection } from "../types/SbtRewardCollection";
import { uploadImageToMinio, uploadVideoToMinio } from "../utils/uploadHelpers";
import { getHubs, Hub } from "../helpers/getHubs";


export const collectionComposer = new Composer<MyContext>();

collectionComposer.command("collections", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // 1) Check admin
  const admin = await isUserAdmin(String(userId));
  if (!admin) {
    await ctx.reply("Sorry, this command is for admins only.");
    return;
  }

  // 2) Fetch hubs
  let hubs: Hub[] = [];
  try {
    hubs = await getHubs();
  } catch (error) {
    logger.error("Error fetching hubs:", error);
    await ctx.reply("Failed to fetch hubs. Please try again later.");
    return;
  }

  if (!hubs.length) {
    await ctx.reply("No hubs found from the endpoint.");
    return;
  }

  // 3) Build an inline keyboard for available hubs
  const kb = new InlineKeyboard();
  hubs.forEach((hub: Hub) => {
    kb.text(hub.name || `Hub ${hub.id}`, `hub_select_${hub.id}`).row();
  });

  // 4) Initialize session flow
  ctx.session.collectionStep = "CHOOSE_HUB";
  ctx.session.collectionData = {
    hubId: undefined,
    hubName: undefined,
    hubs, // store the entire fetched hubs array in session so we can look up names
    collections: [],
    currentIndex: 0,
    selectedCollectionId: undefined,
    imageBuffer: undefined,
    videoBuffer: undefined,
    navigationMessageId: undefined,
  };

  await ctx.reply(`Please select a hub to manage collections. or /cancel`, {
    reply_markup: kb,
  });
});

collectionComposer.callbackQuery(/^hub_select_(\d+)$/, async (ctx) => {
  // Must be in CHOOSE_HUB step
  if (ctx.session.collectionStep !== "CHOOSE_HUB") {
    await ctx.answerCallbackQuery();
    return;
  }

  const hubId = Number(ctx.match[1]);
  await ctx.answerCallbackQuery();

  // 1) Find the selected hub in the stored array
  const storedHubs = ctx.session.collectionData?.hubs ?? [];
  const selectedHub = storedHubs.find((h) => String(h.id) === String(hubId));

  // If for some reason we can't find it, fallback
  if (!selectedHub) {
    await ctx.reply("Selected hub not found in session. Please restart /collections.");
    ctx.session.collectionStep = "DONE";
    return;
  }

  // 2) Store hubId and hubName in session
  ctx.session.collectionData!.hubId = hubId;
  ctx.session.collectionData!.hubName = selectedHub.name || `Hub ${hubId}`;

  // 3) Prompt user for Add or Edit
  ctx.session.collectionStep = "CHOOSE_ACTION";
  const kb = new InlineKeyboard()
    .text("Add new collection", "collection_action_add")
    .text("Edit a collection", "collection_action_edit");

  await ctx.reply(
    `Hub [ID=${hubId}, Name="${ctx.session.collectionData!.hubName}"] selected. ` +
    "What would you like to do?",
    { reply_markup: kb },
  );
});

collectionComposer.callbackQuery(
  ["collection_action_add", "collection_action_edit"],
  async (ctx) => {
    if (ctx.session.collectionStep !== "CHOOSE_ACTION") {
      await ctx.answerCallbackQuery();
      return;
    }

    const action = ctx.callbackQuery.data; // "collection_action_add" or "collection_action_edit"
    await ctx.answerCallbackQuery();

    if (action === "collection_action_add") {
      // Straight to image upload step
      ctx.session.collectionStep = "UPLOAD_IMAGE";
      await ctx.reply("You chose to add a new collection.\nPlease upload the SBT image now. or /cancel");
    } else {
      // "collection_action_edit"
      // 1) Fetch existing collections for this hub from DB
      const hubId = ctx.session.collectionData!.hubId!;
      try {
        const collections = await getCollectionsByHubId(hubId);
        ctx.session.collectionData!.collections = collections;
      } catch (err) {
        logger.error("Error fetching collections:", err);
        ctx.session.collectionStep = "DONE";
        await ctx.reply("Failed to fetch existing collections. Please try again later.");
        return;
      }

      // 2) Check if we have any collections. If none, go back or do something else
      const { collections } = ctx.session.collectionData!;
      if (!collections.length) {
        ctx.session.collectionStep = "DONE";
        await ctx.reply("No existing collections found for this hub. /collections to start over.");
        return;
      }

      // 3) Show the first collection (create a new message for it)
      ctx.session.collectionStep = "NAVIGATE_COLLECTIONS";
      ctx.session.collectionData!.currentIndex = 0;
      const first = collections[0];
      await showOrEditCollectionNavigation(ctx, first, true);
    }
  },
);

/** Show or edit the current collection with Prev/Next navigation and a "Select This" button. */
async function showOrEditCollectionNavigation(
  ctx: MyContext,
  collection: SbtRewardCollection,
  isFirstTime: boolean,
) {
  const kb = new InlineKeyboard()
    .text("<< Prev", "collection_prev_col")
    .text(`ID ${collection.id}`, "collection_noop_col")
    .text("Next >>", "collection_next_col")
    .row()
    .text("Select This", `collection_select_col_${collection.id}`);

  const imageUrl = collection.imageLink || "";

  if (isFirstTime) {
    // First time => create a new message
    if (imageUrl) {
      const msg = await ctx.replyWithPhoto(imageUrl, {
        caption: `Viewing collection ID: ${collection.id}`,
        reply_markup: kb,
      });
      ctx.session.collectionData!.navigationMessageId = msg.message_id;
    } else {
      const msg = await ctx.reply(`Viewing collection ID: ${collection.id}\n(No image)`, {
        reply_markup: kb,
      });
      ctx.session.collectionData!.navigationMessageId = msg.message_id;
    }
  } else {
    // Subsequent times => edit the existing message
    const messageId = ctx.session.collectionData!.navigationMessageId;
    if (!messageId) {
      // If for some reason we lost the messageId, fallback to creating a new message
      return showOrEditCollectionNavigation(ctx, collection, true);
    }

    try {
      if (imageUrl) {
        await ctx.api.editMessageMedia(
          ctx.chat!.id,
          messageId,
          {
            type: "photo",
            media: imageUrl,
            caption: `Viewing collection ID: ${collection.id}`,
          },
          { reply_markup: kb },
        );
      } else {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          messageId,
          `Viewing collection ID: ${collection.id}\n(No image)`,
          { reply_markup: kb },
        );
      }
    } catch (err) {
      logger.error("Error editing navigation message:", err);
      // If there's an error (e.g. message not found), fallback
      await ctx.reply("Sorry, failed to edit the message. We'll show a new one instead.");
      await showOrEditCollectionNavigation(ctx, collection, true);
    }
  }
}

collectionComposer.callbackQuery(
  ["collection_prev_col", "collection_next_col", /^collection_select_col_(\d+)$/, "collection_noop_col"],
  async (ctx) => {
    logger.info("collectionComposer.callbackQuery" + ctx.callbackQuery.data);
    if (ctx.session.collectionStep !== "NAVIGATE_COLLECTIONS") {
      await ctx.answerCallbackQuery();
      return;
    }

    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery.data;
    const flow = ctx.session.collectionData!;
    let index = flow.currentIndex ?? 0;

    if (data === "collection_noop_col") {
      return;
    }

    if (data === "collection_prev_col") {
      index = index - 1 < 0 ? flow.collections!.length - 1 : index - 1;
      flow.currentIndex = index;
      await showOrEditCollectionNavigation(ctx, flow.collections![index], false);
      return;
    }

    if (data === "collection_next_col") {
      index = index + 1 >= flow.collections!.length ? 0 : index + 1;
      flow.currentIndex = index;
      await showOrEditCollectionNavigation(ctx, flow.collections![index], false);
      return;
    }

    // /^collection_select_(\d+)$/
    const match = data.match(/^collection_select_col_(\d+)$/);
    if (!match) return;
    const selectedId = Number(match[1]);
    flow.selectedCollectionId = selectedId;

    ctx.session.collectionStep = "UPLOAD_IMAGE";
    await ctx.reply(
      `Collection #${selectedId} selected.\nPlease upload the SBT **image** now (as a photo).`,
    );
  },
);

// ---------------------- Uploading the IMAGE ----------------------
collectionComposer.on("message:photo", async (ctx, next) => {
  if (ctx.session.collectionStep !== "UPLOAD_IMAGE") return next();

  const { collectionData } = ctx.session;
  if (!collectionData) return;

  // 1) Download from Telegram
  const photos = ctx.message.photo;
  const fileId = photos[photos.length - 1].file_id;
  let imageBuffer: Buffer;
  const mimeType = "image/jpeg"; // Possibly more precise by examining getFile()

  try {
    const fileInfo = await ctx.api.getFile(fileId);
    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;
    const response = await axios.get(downloadUrl, { responseType: "arraybuffer" });
    imageBuffer = Buffer.from(response.data);
  } catch (err) {
    logger.error("Error downloading SBT image:", err);
    await ctx.reply("Failed to download the image. Please try again.");
    return;
  }

  // 2) Attempt to upload to MinIO
  let uploadedImageUrl: string;
  try {
    const originalFilename = `collection_${Date.now()}.jpg`;
    uploadedImageUrl = await uploadImageToMinio(
      imageBuffer,
      mimeType,
      originalFilename,
      "sbt_images", // subfolder
      "onton",      // bucket
      true,         // mustBeSquare
    );
  } catch (err: any) {
    logger.error("Error uploading image to MinIO:", err.message);
    await ctx.reply(`Image upload failed: ${err.message}`);
    return;
  }

  // 3) Store in session
  collectionData.imageLink = uploadedImageUrl;

  // Move on to next step
  ctx.session.collectionStep = "UPLOAD_VIDEO";
  await ctx.reply("Image received and stored! Now please upload the **video** file.");
});

// ---------------------- Uploading the VIDEO ----------------------
collectionComposer.on(["message:video", "message:document"], async (ctx, next) => {
  if (ctx.session.collectionStep !== "UPLOAD_VIDEO") return next();

  const { collectionData } = ctx.session;
  if (!collectionData) return;

  const fileId = ctx.message.video?.file_id || ctx.message.document?.file_id;
  if (!fileId) {
    await ctx.reply("No valid video file found. Please try again.");
    return;
  }

  let videoBuffer: Buffer;
  const mimeType = "video/mp4";
  try {
    const fileInfo = await ctx.api.getFile(fileId);
    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;
    const response = await axios.get(downloadUrl, { responseType: "arraybuffer" });
    videoBuffer = Buffer.from(response.data);
  } catch (err) {
    logger.error("Error downloading SBT video:", err);
    await ctx.reply("Failed to download the video. Please try again.");
    return;
  }

  // 2) Upload to MinIO
  let uploadedVideoUrl: string;
  try {
    const originalFilename = `collection_${Date.now()}.mp4`;
    uploadedVideoUrl = await uploadVideoToMinio(
      videoBuffer,
      mimeType,
      originalFilename,
      "sbt_videos", // subfolder
      "ontonvideo", // bucket
    );
  } catch (err: any) {
    logger.error("Error uploading SBT video to Minio:", err.message);
    await ctx.reply(`Video upload failed: ${err.message}`);
    return;
  }

  // 3) Insert or Update in DB
  const selectedCollectionId = collectionData.selectedCollectionId;
  const hubId = collectionData.hubId ?? 0;
  const hubName = collectionData.hubName ?? ""; // we stored it earlier
  const imageLink = collectionData.imageLink ?? "";
  const videoLink = uploadedVideoUrl;

  try {
    if (selectedCollectionId) {
      // Update existing
      await updateCollection(selectedCollectionId, {
        hubID: hubId,
        hubName,         // now we also store the hubName
        imageLink,
        videoLink,
      });
      await ctx.reply(`Collection #${selectedCollectionId} updated successfully!`);
    } else {
      // Insert new
      const newId = await createCollection({
        hubID: hubId,
        hubName,         // store the hubName for new
        imageLink,
        videoLink,
      });
      await ctx.reply(
        `New collection created with ID: ${newId} for Hub [ID=${hubId}, Name="${hubName}"]` +
        `\nImage: ${imageLink}\nVideo: ${videoLink}`,
      );
    }
  } catch (dbErr) {
    logger.error("DB insert/update error:", dbErr);
    await ctx.reply("An error occurred saving collection data. Please try again later.");
  }

  // 4) Done
  ctx.session.collectionStep = "DONE";
  ctx.session.collectionData = undefined;
  await ctx.reply("Video received and collection process complete! Thank you.");
});