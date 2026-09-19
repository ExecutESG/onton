import { sbtDB } from "@/db/modules/sbt.db";
import eventDB from "@/db/modules/events.db";
import { SbtCollectionRow } from "@/db/schema/sbtCollections";
import { SbtItemRow } from "@/db/schema/sbtItems";
import { deploySbtCollection, mintSBT, revokeSBT, calculateSbtItemAddress } from "@/lib/sbt";
import { uploadJsonToMinio } from "@/lib/minioTools";
import { logger } from "@/server/utils/logger";
import { config } from "@/server/config";
import tonCenter from "@/services/tonCenter";
import { Address } from "@ton/core";

export type MintSbtBadgeParams = {
  eventUuid: string;
  userId?: number;
  walletAddress: string;
  badgeTitle?: string;
  badgeDescription?: string;
  badgeImage?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
};

export class SbtService {
  /**
   * Retrieves an existing TEP-85 SBT Collection for an event or deploys a new one on-chain.
   */
  public async getOrCreateEventSbtCollection(eventUuid: string): Promise<SbtCollectionRow> {
    const existing = await sbtDB.findCollectionByEventUuid(eventUuid);
    if (existing) {
      return existing;
    }

    const eventData = await eventDB.fetchEventByUuid(eventUuid);
    if (!eventData) {
      throw new Error(`SbtService: Event not found for UUID ${eventUuid}`);
    }

    const collectionName = `${eventData.title || "ONTON Event"} Soulbound Credentials`;
    const collectionDesc =
      eventData.description ||
      `Official Soulbound Attendance & Participation Credentials for ${eventData.title}. Non-transferable badges issued on TON.`;
    const collectionImg =
      eventData.image_url ||
      eventData.tsRewardImage ||
      "https://onton.app/assets/sbt-badge.png";

    logger.log(`SbtService: Uploading collection metadata to MinIO for event ${eventUuid}...`);

    let metadataUrl: string;
    try {
      metadataUrl = await uploadJsonToMinio(
        {
          name: collectionName,
          description: collectionDesc,
          image: collectionImg,
          cover_image: eventData.image_url || collectionImg,
          social_links: [
            `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || "ontonbot"}?startapp=${eventUuid}`,
          ],
        },
        "sbt-collections",
        `event-${eventUuid}`
      );
    } catch (uploadError) {
      logger.error(`SbtService: Failed to upload collection metadata to MinIO`, uploadError);
      // Fallback relative metadata identifier
      metadataUrl = `https://storage.onton.app/sbt-collections/event-${eventUuid}/metadata.json`;
    }

    logger.log(`SbtService: Deploying TEP-85 SBT Collection on-chain for event ${eventUuid}...`);

    const deployedAddress = await deploySbtCollection(metadataUrl, undefined, {
      expectedMinterAddress: config?.ONTON_MINTER_WALLET ?? undefined,
    });

    if (!deployedAddress) {
      throw new Error(`SbtService: Failed to deploy SBT collection on-chain for event ${eventUuid}`);
    }

    logger.log(`SbtService: Deployed SBT collection at address: ${deployedAddress}`);

    const newCollection = await sbtDB.insertSbtCollection({
      eventUuid,
      collectionAddress: deployedAddress,
      ownerAddress: config?.ONTON_MINTER_WALLET || deployedAddress,
      authorityAddress: config?.ONTON_MINTER_WALLET || deployedAddress,
      name: collectionName,
      description: collectionDesc,
      image: collectionImg,
      metadataUrl,
      commonContentUrl: "",
      nextItemIndex: 0,
      totalMinted: 0,
      status: "active",
    });

    return newCollection;
  }

  /**
   * Mints an individual TEP-85 SBT credential to an attendee's wallet address.
   */
  public async mintSbtBadge(params: MintSbtBadgeParams): Promise<SbtItemRow> {
    const { eventUuid, userId, walletAddress } = params;

    // Validate wallet address
    try {
      Address.parse(walletAddress);
    } catch {
      throw new Error(`SbtService: Invalid recipient wallet address: ${walletAddress}`);
    }

    // 1. Check if user already has an SBT for this event
    if (userId) {
      const existingUserBadge = await sbtDB.findUserSbtForEvent(userId, eventUuid);
      if (existingUserBadge && existingUserBadge.status === "minted") {
        logger.info(
          `SbtService: User ${userId} already has minted SBT ${existingUserBadge.itemAddress} for event ${eventUuid}`
        );
        return existingUserBadge;
      }
    }

    // 2. Fetch or create event SBT collection
    const collection = await this.getOrCreateEventSbtCollection(eventUuid);
    const eventData = await eventDB.fetchEventByUuid(eventUuid);

    const itemIndex = collection.nextItemIndex;
    const badgeTitle = params.badgeTitle || `${eventData?.title || "Event"} Badge #${itemIndex + 1}`;
    const badgeDesc =
      params.badgeDescription ||
      `Official Soulbound Proof of Attendance for ${eventData?.title || "ONTON Event"}. Strictly non-transferable.`;
    const badgeImg = params.badgeImage || collection.image || "https://onton.app/assets/sbt-badge.png";

    const metadataPayload = {
      name: badgeTitle,
      description: badgeDesc,
      image: badgeImg,
      attributes: [
        { trait_type: "Event", value: eventData?.title || "ONTON Event" },
        { trait_type: "Type", value: "Soulbound Attendance Badge" },
        { trait_type: "Issuer", value: "ONTON Native SBT Engine (TEP-85)" },
        ...(params.attributes || []),
      ],
    };

    logger.log(`SbtService: Uploading badge metadata to MinIO for item #${itemIndex}...`);
    let itemMetadataUrl: string;
    try {
      itemMetadataUrl = await uploadJsonToMinio(
        metadataPayload,
        "sbt-collections",
        `event-${eventUuid}/item-${itemIndex}`
      );
    } catch (error) {
      logger.error(`SbtService: Failed to upload item metadata to MinIO`, error);
      itemMetadataUrl = `https://storage.onton.app/sbt-collections/event-${eventUuid}/item-${itemIndex}/metadata.json`;
    }

    // 3. Precompute deterministic address
    const deterministicAddress = calculateSbtItemAddress(collection.collectionAddress, itemIndex).toString();

    // 4. Dispatch on-chain mint transaction
    logger.log(
      `SbtService: Minting TEP-85 SBT #${itemIndex} at ${deterministicAddress} to wallet ${walletAddress}...`
    );

    const mintResult = await mintSBT(
      walletAddress,
      collection.collectionAddress,
      itemIndex,
      itemMetadataUrl,
      collection.authorityAddress,
      {
        expectedMinterAddress: config?.ONTON_MINTER_WALLET ?? undefined,
      }
    );

    if (!mintResult) {
      throw new Error(`SbtService: Failed to mint SBT #${itemIndex} on-chain`);
    }

    // 5. Store record in DB and increment collection index
    const sbtItemRecord = await sbtDB.insertSbtItem({
      sbtCollectionId: collection.id,
      itemIndex,
      itemAddress: deterministicAddress,
      recipientUserId: userId ?? null,
      recipientWalletAddress: walletAddress,
      metadataUrl: itemMetadataUrl,
      status: "minted",
      transactionHash: mintResult.transactionHash ?? null,
      metadata: metadataPayload,
      revokedAt: null,
    });

    await sbtDB.incrementCollectionIndex(collection.id);

    logger.info(
      `SbtService: Successfully minted SBT badge #${itemIndex} (${deterministicAddress}) for user ${userId || "guest"}`
    );

    return sbtItemRecord;
  }

  /**
   * Verifies whether a wallet address holds a valid, unrevoked SBT for an event.
   */
  public async verifySbtOwnership(
    walletAddress: string,
    eventUuid: string
  ): Promise<{ isOwner: boolean; sbtItem: SbtItemRow | null; onChainVerified: boolean }> {
    const collection = await sbtDB.findCollectionByEventUuid(eventUuid);
    if (!collection) {
      return { isOwner: false, sbtItem: null, onChainVerified: false };
    }

    // Check DB record
    const userItems = await sbtDB.findWalletSbtItems(walletAddress);
    const item = userItems.find(
      (it) => it.sbtCollectionId === collection.id && it.status === "minted" && !it.revokedAt
    );

    if (!item) {
      return { isOwner: false, sbtItem: null, onChainVerified: false };
    }

    // Verify on-chain status via TonCenter if item address exists
    let onChainVerified = false;
    try {
      const nftItemData = await tonCenter.fetchNFTItemsWithRetry("", collection.collectionAddress, "", item.itemIndex);
      if (nftItemData?.nft_items?.length) {
        const onChainOwner = nftItemData.nft_items[0]?.owner_address;
        if (onChainOwner && Address.parse(onChainOwner).equals(Address.parse(walletAddress))) {
          onChainVerified = true;
        }
      }
    } catch (e) {
      logger.warn(`SbtService: TonCenter on-chain check skipped or failed`, e);
      // DB check passed, fallback to DB verification
    }

    return {
      isOwner: true,
      sbtItem: item,
      onChainVerified,
    };
  }

  /**
   * Revokes an SBT badge on-chain using the authority wallet.
   */
  public async revokeSbtBadge(sbtItemId: number): Promise<boolean> {
    const item = await sbtDB.findSbtItemByAddress(String(sbtItemId));
    if (!item) {
      throw new Error(`SbtService: SBT item ${sbtItemId} not found`);
    }

    logger.log(`SbtService: Revoking SBT item at address: ${item.itemAddress}`);

    const revokedOnChain = await revokeSBT(item.itemAddress, {
      expectedMinterAddress: config?.ONTON_MINTER_WALLET ?? undefined,
    });

    if (revokedOnChain) {
      await sbtDB.updateSbtItemStatus(item.id, "revoked", undefined, new Date());
      logger.info(`SbtService: Successfully revoked SBT badge ${item.itemAddress}`);
      return true;
    }

    logger.error(`SbtService: Failed to execute on-chain revoke for ${item.itemAddress}`);
    return false;
  }
}

export const sbtService = new SbtService();
export default sbtService;
