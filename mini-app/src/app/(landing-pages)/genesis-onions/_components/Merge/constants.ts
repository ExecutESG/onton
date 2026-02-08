import { CampaignMergeTransaction } from "@/types/campaign.types";
import { capitalize } from "lodash";

export const COLORS = ["gold", "silver", "bronze"] as const;
export type Color = (typeof COLORS)[number];

export const getFilterUrl = (color: Color): string =>
  `https://getgems.io/genesisonions?filter=%7B%22attributes%22%3A%7B%22color%22%3A%5B%22${capitalize(color)}%22%5D%7D%7D`;

export const getImageUrl = (color: string): string => `https://storage.onton.live/ontonimage/on_${color.toLowerCase()}.jpg`;

export interface Badge {
  src: string;
  alt: string;
  text: string;
  reverse?: boolean;
}

export const badges: Badge[] = [
  {
    src: "https://storage.onton.live/ontonimage/onion_badge.png",
    alt: "onion",
    text: "The merging process is assured and will consume the three NFTs you provide.",
  },
  {
    src: "https://storage.onton.live/ontonimage/onion_badege_2.png",
    alt: "onion",
    text: "Platinums provide the ultimate benefits within the ONTON and ONION ecosystems.",
    reverse: true,
  },
  {
    src: "https://storage.onton.live/ontonimage/onion_badge_3.png",
    alt: "onion",
    text: "Merging can only be done after minting through the ONTON Mini App.",
  },
];

export const mergeTransactionPendingStatuses: CampaignMergeTransaction["status"][] = ["processing", "pending"];
