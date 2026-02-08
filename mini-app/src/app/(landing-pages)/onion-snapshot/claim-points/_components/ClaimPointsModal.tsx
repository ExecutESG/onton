import CustomSheet from "@/app/_components/Sheet/CustomSheet";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { WalletSummary } from "@/db/modules/claimOnion.db";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useState } from "react";
import { toast } from "sonner";
import { useWalletNotConnectedProofContext } from "../../_components/WalletNotConnected";
import OnionBenefitsCard from "./OnionBenefitsCard";

export default function ClaimPointsModal({ wallet }: { wallet: WalletSummary }) {
  const [isOpen, setIsOpen] = useState(false);
  const trpcUtils = trpc.useUtils();
  const walletCtx = useWalletNotConnectedProofContext();

  const claimPoints = trpc.campaign.claimOnion.useMutation({
    onSuccess: () => {
      setIsOpen(true);
    },
    onError: () => {
      toast.error("Failed to claim ONIONs");
    },
  });

  const handleClaimPoints = () => {
    claimPoints.mutate({
      walletAddress: wallet.walletAddress,
      tonProof: walletCtx.proof!,
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      trpcUtils.campaign.getClaimOverview.invalidate();
    }, 50);
  };

  return (
    <div>
      <Button
        variant="primary"
        size="default"
        className="w-full"
        onClick={(e) => {
          e.preventDefault();
          handleClaimPoints();
        }}
        isLoading={claimPoints.isLoading}
      >
        Stabilize ONIONS
      </Button>
      <CustomSheet
        opened={isOpen}
        title={
          <div className="relative w-[184px] h-[184px] -mb-20 -mt-18">
            <DotLottieReact
              autoplay
              src={"https://storage.onton.live/ontonimage/confetti_lottie.json"}
              className="absolute top-3/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[184px] h-[184px]"
              width={568}
              height={568}
            />
            <DotLottieReact
              loop
              autoplay
              src={"https://storage.onton.live/ontonimage/coin_lottie.json"}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              width={184}
              height={184}
            />
          </div>
        }
        centerTitle
        hideClose
        onClose={handleClose}
      >
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col gap-1 text-center">
            <Typography
              variant="body"
              weight="normal"
            >
              🎉Congrats!
            </Typography>
            <Typography
              variant="body"
              weight="normal"
            >
              You’ve successfully claimed your ONIONs.
            </Typography>
          </div>

          <OnionBenefitsCard />
          <Button
            variant="primary"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              handleClose();
            }}
          >
            Close
          </Button>
        </div>
      </CustomSheet>
    </div>
  );
}
