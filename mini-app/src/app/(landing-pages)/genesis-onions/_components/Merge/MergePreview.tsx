"use client";

import React from "react";
import Image from "next/image";
import { COLORS, getImageUrl } from "./constants";

interface MergePreviewProps {
  isSending: boolean;
}

export const MergePreview: React.FC<MergePreviewProps> = ({ isSending }) => (
  <div className="flex w-full items-center gap-2">
    {COLORS.map((color, idx) => (
      <React.Fragment key={color}>
        <div className="flex-1 border-2 border-dashed border-[#8E8E93] p-2 flex flex-wrap ms-center rounded-2lg bg-white/10 backdrop-blur-md items-center gap-2">
          <Image
            width={40}
            height={40}
            src={getImageUrl(color)}
            alt={color}
            className="rounded-2lg aspect-square mx-auto"
          />
          <p className="text-xs font-semibold leading-[18px] mx-auto flex flex-col text-center">
            <span className="capitalize">{color}</span>
            {isSending && <span className="capitalize font-normal text-[8px] leading-3">sending...</span>}
          </p>
        </div>
        {idx < COLORS.length - 1 && <span className="text-white text-2xl font-semibold">+</span>}
      </React.Fragment>
    ))}
  </div>
);

