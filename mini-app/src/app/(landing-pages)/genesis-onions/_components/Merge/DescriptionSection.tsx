"use client";

import React from "react";
import Image from "next/image";
import Typography from "@/components/Typography";
import { COLORS, getImageUrl, badges } from "./constants";
import { RequiredNft } from "./RequiredNft";

export const DescriptionSection: React.FC = () => (
  <div className="p-4 backdrop-blur-lg bg-white/10 rounded-md flex flex-col gap-3 items-center justify-center">
    <div className="p-4 backdrop-blur-md bg-black/20 rounded-md gap-5 flex flex-col">
      <div className="flex flex-col gap-2">
        <Typography variant="footnote" className="mx-auto w-full text-center" weight="normal">
          Required NFTs
        </Typography>
        <div className="flex justify-center gap-3 items-center">
          {COLORS.map((color) => (
            <RequiredNft key={color} color={color} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 items-center justify-center">
        <Typography className="text-center" variant="footnote" weight="normal">
          Result
        </Typography>
        <div className="relative w-fit mx-auto">
          <Image
            width={200}
            height={200}
            src={getImageUrl("Platinum")}
            alt="Platinum NFT"
            className="rounded-2lg aspect-square"
          />
          <div className="flex items-center justify-center text-center absolute top-1/2 py-1.5 backdrop-blur-md bg-white/10 w-full -translate-y-1/2">
            <Typography variant="callout" weight="semibold">
              💎 Platinum
            </Typography>
          </div>
        </div>
      </div>
      <Typography className="text-center text-balance" variant="subheadline1" weight="medium">
        Platinum NFTs can only be generated through the merging process, which requires one of each Genesis ONION NFT type.
      </Typography>
    </div>
    <div className="flex flex-col gap-2 px-4">
      {badges.map(({ src, alt, text, reverse }, idx) => (
        <div
          key={idx}
          className={`flex justify-center gap-2 items-center${reverse ? " flex-row-reverse" : ""}`}
        >
          <Image src={src} width={80} height={80} alt={alt} />
          <Typography variant="footnote" weight="normal" className="text-balance">
            {text}
          </Typography>
        </div>
      ))}
    </div>
  </div>
);