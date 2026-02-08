"use client";

import React from "react";
import Image from "next/image";
import Typography from "@/components/Typography";
import { getImageUrl } from "./constants";

interface RequiredNftProps {
  color: string;
}

export const RequiredNft: React.FC<RequiredNftProps> = ({ color }) => (
  <div className="relative">
    <Image
      width={90}
      height={90}
      src={getImageUrl(color)}
      alt={`${color} NFT`}
      className="rounded-md aspect-square"
    />
    <div className="flex items-center justify-center text-center absolute top-1/2 py-1.5 backdrop-blur-md bg-white/10 w-full -translate-y-1/2">
      <Typography variant="subheadline1" weight="medium" className="capitalize">
        1x {color}
      </Typography>
    </div>
  </div>
);