"use client";

import React from "react";
import Image from "next/image";
import Typography from "@/components/Typography";
import { useTonWallet } from "@tonconnect/ui-react";
import { cn } from "@/lib/utils";
import { getImageUrl } from "./constants";

interface NFTCardProps {
  color: string;
  nftList: unknown[];
  isLoading: boolean;
}

export const NFTCard: React.FC<NFTCardProps> = ({ color, nftList, isLoading }) => {
  const wallet = useTonWallet();

  return (
    <div
      className={cn(
        "border-b border-white p-2 gap-2 flex items-center bg-white/10 backdrop-blur-lg rounded-2lg flex-wrap flex-1",
        !isLoading && wallet && (nftList.length ? "border-green-500" : "border-red-500")
      )}
    >
      <Image
        width={46}
        height={46}
        src={getImageUrl(color)}
        alt={`${color} NFT`}
        className={cn("rounded-md aspect-square mx-auto", !nftList.length && "grayscale")}
      />
      <div className="flex flex-col text-center mx-auto">
        <Typography
          variant="headline"
          weight="semibold"
          className="mt-2"
        >
          x{!isLoading && wallet ? nftList.length : "?"}
        </Typography>
        <Typography
          variant="body"
          weight="medium"
          className={`text-${color.toLowerCase()} !text-[8px] capitalize`}
        >
          {isLoading ? "loading..." : color}
        </Typography>
      </div>
    </div>
  );
};
