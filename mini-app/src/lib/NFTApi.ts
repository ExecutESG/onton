import { z } from "zod";
import { logger } from "@/server/utils/logger";
// For `collectionData`
const collectionDataSchema = z.object({
  name: z.string().nonempty("Name is required"),
  description: z.string().nonempty("Description is required"),
  image: z.string().nonempty("Image is required").url("Image must be a valid URL"),
  cover_image: z.string().url("cover_image must be a valid URL"),
  social_links: z.array(z.string().url("Each link must be a valid URL")),
  royalties: z.number().min(0, "Royalties must be >= 0").max(100, "Royalties must be <= 100").optional().default(0),
});

// For the overall request body
export const createCollectionSchema = z.object({
  walletAddress: z.string().nonempty("walletAddress is required"),
  collectionData: collectionDataSchema,
  userCallbackUrl: z.string().url("userCallbackUrl must be a valid URL").optional(),
});

const nftDataSchema = z.object({
  collectionId: z.string().nonempty("collectionId is required"),
  name: z.string().nonempty("NFT name is required"),
  description: z.string().nonempty("description is required"),
  image: z.string().url("image must be a valid URL"),
  content_url: z.string().url().optional(),
  content_type: z.string().optional(),
  buttons: z
    .array(
      z.object({
        label: z.string().nonempty(),
        uri: z.string().url(),
      })
    )
    .optional(),
  attributes: z
    .array(
      z.object({
        trait_type: z.string().optional(),
        value: z.string().optional(),
      })
    )
    .optional(),
});

// Full schema for the POST /nfts body
export const createNftSchema = z.object({
  walletAddress: z.string().nonempty("walletAddress is required"),
  nftData: nftDataSchema,
  userCallbackUrl: z.string().url().optional(),
});

async function parseCreateCollectionBody(request: Request) {
  const rawBody = await request.json();
  const result = createCollectionSchema.safeParse(rawBody);

  if (!result.success) {
    // Flatten the Zod error
    const errors = result.error.flatten();
    // You can log or reformat as you wish
    logger.error("Zod parse error for createCollection:", errors);

    // Throw or return a structured error
    throw {
      status: 400,
      errorBody: {
        success: false,
        status: "bad_request",
        message: "Invalid request body",
        errors,
      },
    };
  }
  return result.data; // typed as { walletAddress: string, collectionData: {...}, userCallbackUrl?: string }
}

export async function parseCreateNFTBody(request: Request) {
  const rawBody = await request.json();
  const result = createNftSchema.safeParse(rawBody);

  if (!result.success) {
    // Flatten error
    const errors = result.error.flatten();
    throw {
      status: 400,
      errorBody: {
        success: false,
        status: "bad_request",
        message: "Invalid NFT create request body",
        errors,
      },
    };
  }
  return result.data;
}

export const NFTApi = {
  parseCreateCollectionBody,
  parseCreateNFTBody,
};
