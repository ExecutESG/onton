"use client";

import { trpc } from "@/app/_trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { type WalletSummary } from "@/db/modules/claimOnion.db";
import { useTonWallet } from "@tonconnect/ui-react";
import { createContext, useContext, useState } from "react";
import WalletNotConnected from "../_components/WalletNotConnected";

type ContextType = {
  wallets: null | WalletSummary[];
  /** Controls whether to show wallet provider when wallet is disconnected */
  openConnect: boolean;
  /** Updates the wallet provider visibility state when disconnected */
  setOpenConnect: (open: boolean) => void;
};

export const ClaimPointsContext = createContext<ContextType>({
  wallets: null,
  openConnect: false,
  setOpenConnect: (open) => {},
});

export const useClaimPointsContext = () => {
  return useContext(ClaimPointsContext);
};

export const ClaimPointsProvider = ({ children }: { children: React.ReactNode }) => {
  const [openConnect, setOpenConnect] = useState(false);
  const wallet = useTonWallet();
  const [proof, setProof] = useState<string>();

  const claimOverview = trpc.campaign.getClaimOverview.useQuery(
    {
      walletAddress: wallet?.account.address!,
      //  tonProof: proof!,
    },
    {
      queryKey: ["campaign.getClaimOverview", { walletAddress: wallet?.account.address! /*tonProof: proof!*/ }],
      enabled: !!wallet?.account.address && !!proof,
    }
  );
  console.log("proof", proof);

  if (claimOverview.isInitialLoading) {
    return <Skeleton />;
  }

  return (
    <ClaimPointsContext.Provider value={{ wallets: claimOverview.data ?? null, openConnect, setOpenConnect }}>
      <WalletNotConnected
        openOnDisconnect={openConnect}
        setOpenOnDiconnect={setOpenConnect}
        onProofVerified={(proof) => {
          setProof(proof);
        }}
      >
        {children}
      </WalletNotConnected>
    </ClaimPointsContext.Provider>
  );
};
