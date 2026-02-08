import { RouterOutput } from "@/server";
import { NFTItem } from "@/services/tonCenter";

export type CampaignNFT = {
  onChain: NFTItem | undefined;
  offChain: {
    itemType: "onion1" | "genesis_season" | "merge_platinum";
    owner: number;
    itemId: number;
    nftAddress: string;
    index: number;
    mergeStatus: "not_allowed_to_merge" | "able_to_merge" | "waiting_for_transaction" | "merging" | "merged" | "burned";
  };
  collectionInfo: {
    address: string | null;
    image: string | null;
    id: number;
    name: string | null;
    campaignType: "onion1" | "genesis_season" | "merge_platinum";
  };
};

export type CampaignMergeTransaction = RouterOutput["campaign"]["getUserMergeTransactions"][number];
