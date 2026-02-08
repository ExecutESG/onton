"use client";

import Typography from "@/components/Typography";
import { cn } from "@/utils";
import Image from "next/image";
import { usePlay2Win } from "./Play2WinContext";

export default function NFTDisplay() {
  const { reachedMaxScore, setShowNFTDialog } = usePlay2Win();

  return (
    <div className="flex flex-col gap-4">
      {/* NFT  */}
      <div
        className="play-2-win-reward-button-border rounded-2lg backdrop-blur-md p-[9px] py-2 flex items-center gap-2 w-fit mx-auto cursor-pointer"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          if (reachedMaxScore) setShowNFTDialog(true);
        }}
        onKeyDown={(e) => {
          if (reachedMaxScore && (e.key === "Enter" || e.key === " ")) setShowNFTDialog(true);
        }}
      >
        <Image
          alt="Play2Win NFT Image"
          width={44}
          height={44}
          src="https://storage.onton.live/ontonimage/p2w-badge-cm.jpg"
          className={cn("rounded-lg w-11 h-11 filter", !reachedMaxScore && "grayscale")}
        />
        <Typography
          variant="caption2"
          className="flex text-[10px] leading-4 flex-col text-brand-divider-dark w-[50px] text-center"
        >
          {reachedMaxScore ? "Play2win NFT" : "Unclaimed"}
        </Typography>
      </div>
      {/* Description */}
      <p className="text-white max-w-[282px] text-center text-xs mx-auto">
        {reachedMaxScore
          ? "You’re a part of elite league now!"
          : "Claim Your Play2Win NFT by passing the points required for NFT, join the elite league of players."}
      </p>
    </div>
  );
}
