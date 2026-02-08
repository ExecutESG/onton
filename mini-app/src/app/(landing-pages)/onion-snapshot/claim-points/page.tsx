"use client";

import { AlertGeneric } from "@/components/ui/alert";
import { useTonWallet } from "@tonconnect/ui-react";
import { ConnectNewWalletCard, OnionStockBanner, SnapshotResultCard } from "./_components";
import { OnionFollowUsCard } from "./_components/OnionFollowUsCard";

export default function ClaimPointsPage() {
  const wallet = useTonWallet();
  return (
    <div className="flex flex-col gap-4 py-6 px-4">
      <OnionStockBanner />
      <SnapshotResultCard />
      {wallet?.account.address ? (
        <OnionFollowUsCard />
      ) : (
        <>
          <AlertGeneric variant="info-light">
            Seeing a “missing proof” error when connecting your wallet? Make one small transaction (even 0.002 TON, to any
            address or to yourself) to activate the wallet, then try again.
          </AlertGeneric>
          <ConnectNewWalletCard buttonText="Connect Wallet" />
        </>
      )}
    </div>
  );
}
