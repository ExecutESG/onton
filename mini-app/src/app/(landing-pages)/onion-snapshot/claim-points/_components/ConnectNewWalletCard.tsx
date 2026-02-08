import { useTonConnectUI } from "@tonconnect/ui-react";
import { Button } from "@/components/ui/button";
import { useClaimPointsContext } from "../ClaimPointsContext";

export default function ConnectNewWalletCard({ buttonText }: { buttonText?: string }) {
  const [tonconnectUi] = useTonConnectUI();
  const { setOpenConnect } = useClaimPointsContext();

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={(e) => {
        e.preventDefault();
        if (tonconnectUi.account?.address) {
          void tonconnectUi.disconnect();
        }
        setOpenConnect(true);
      }}
    >
      {buttonText ? buttonText : "Connect a New Wallet"}
    </Button>
  );
}
