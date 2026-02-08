"use client";

import ontonWhite from "@/components/icons/onton-white.svg";
import Image from "next/image";

interface TotalPointsBoxProps {
  totalPoints: number;
}

export default function TotalPointsBox({ totalPoints }: TotalPointsBoxProps) {
  return (
    <>
      {/* Full-width black container */}
      <div className="w-full bg-black text-white py-4 flex justify-center rounded-md">
        {/* Centered content inside the black container */}
        <div className="flex items-center">
          <Image
            src={ontonWhite}
            alt="ONTON"
            width={48}
            height={48}
          />
          <div className="flex flex-col ml-3">
            <span className="text-xl font-bold leading-tight">{Number(totalPoints)}</span>
            <span className="text-sm leading-tight">ONTON points</span>
          </div>
        </div>
      </div>
    </>
  );
}
