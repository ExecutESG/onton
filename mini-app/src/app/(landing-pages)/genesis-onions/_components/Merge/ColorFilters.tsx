"use client";

import Typography from "@/components/Typography";
import useWebApp from "@/hooks/useWebApp";
import Image from "next/image";
import React from "react";
import { FaChevronRight } from "react-icons/fa6";
import { COLORS, getFilterUrl, getImageUrl } from "./constants";

export const ColorFilters: React.FC = () => {
  const webapp = useWebApp();

  return (
    <div className="flex gap-4">
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={(e) => {
            e.preventDefault();
            webapp?.openLink(getFilterUrl(color));
          }}
          className="border border-white p-2 flex flex-col gap-0.5 justify-center items-center bg-white/10 rounded-md backdrop-blur-lg w-full"
        >
          <Image
            width={40}
            height={40}
            src={getImageUrl(color)}
            alt={`${color} NFT`}
            className="rounded-md aspect-square"
          />
          <Typography
            variant="body"
            weight="medium"
            className="flex items-center gap-2 justify-center"
          >
            {color} <FaChevronRight size={12} />
          </Typography>
        </button>
      ))}
    </div>
  );
};
