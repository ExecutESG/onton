"use client";

import Typography from "@/components/Typography";
import Image from "next/image";
import { SnapshotConnectWallet } from "../_components/SnapshotConnectWallet";
import { ClaimPointsProvider, useClaimPointsContext } from "./ClaimPointsContext";

export default function ClaimPointsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClaimPointsProvider>
      <div className="bg-brand-bg min-h-screen">
        <CampaignNavbar />
        {children}
      </div>
    </ClaimPointsProvider>
  );
}

const CampaignNavbar = () => {
  const { setOpenConnect } = useClaimPointsContext();
  return (
    <div className="flex flex-row justify-between items-center gap-6 p-4 bg-white">
      <div className="flex flex-col min-w-0">
        <div className="flex flex-row items-center min-w-0">
          <Image
            src="/images/onion-icon.png"
            width={22}
            height={22}
            alt="Onion"
            className="h-5.5 w-5.5 object-contain"
          />
          <Typography
            variant="title2"
            weight="bold"
            className="tracking-wider whitespace-nowrap font-bold"
            truncate
          >
            NION Airdrop
          </Typography>
        </div>
      </div>

      {/* Wallet Button */}
      <SnapshotConnectWallet
        onTryConnect={() => {
          setOpenConnect(true);
        }}
        variant="secandary"
      />
    </div>
  );
};
