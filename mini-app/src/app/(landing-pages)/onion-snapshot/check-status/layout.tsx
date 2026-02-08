"use client";

import Typography from "@/components/Typography";
import { useConfigDate } from "@/hooks/useConfigDate";
import Image from "next/image";
import { SnapshotConnectWallet } from "../_components/SnapshotConnectWallet";
import WalletNotConnected from "../_components/WalletNotConnected";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const snapshotTimeLeft = useConfigDate("snapshot_date");
  const claimPointsTimeLeft = useConfigDate("snapshot_claim_points_date");

  const claimAndSnapshotEnded = claimPointsTimeLeft?.isEnded && snapshotTimeLeft?.isEnded;
  return (
    <WalletNotConnected>
      <div className="bg-brand-bg min-h-screen">
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
            {!claimAndSnapshotEnded && <Typography variant="subheadline2">Your share ?</Typography>}
          </div>

          {/* Wallet Button */}
          <SnapshotConnectWallet />
        </div>
        {children}
      </div>
    </WalletNotConnected>
  );
};

export default Layout;
