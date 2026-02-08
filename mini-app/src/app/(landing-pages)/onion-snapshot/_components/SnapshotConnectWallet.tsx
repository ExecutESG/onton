import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/utils";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { UnplugIcon } from "lucide-react";
import { FaAngleDown } from "react-icons/fa";

export const SnapshotConnectWallet = (props: { variant?: "default" | "secandary"; onTryConnect?: () => void }) => {
  const walletAddress = useTonAddress(true);
  const [tonModalUI] = useTonConnectUI();

  const connectWallet = () => {
    if (props.onTryConnect) {
      props.onTryConnect();
    } else {
      void tonModalUI.openModal();
    }
  };

  const disconnectWallet = () => {
    void tonModalUI.disconnect();
  };

  if (!walletAddress) {
    return (
      <Button
        onClick={connectWallet}
        variant={props.variant === "secandary" ? "ghost" : "primary-onion"}
        className={cn(props.variant === "secandary" && "font-normal")}
      >
        {props.variant === "secandary" ? "No Wallet connected" : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex gap-1 font-medium p-2"
        >
          {`${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`}
          <FaAngleDown size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        onClick={(e) => {
          e.preventDefault();
          disconnectWallet();
        }}
        className="cursor-pointer rounded-2lg p-3 flex items-center gap-2 border border-solid border-brand-divider-dark text-black bg-red-500"
      >
        <UnplugIcon />
        <Typography
          variant="body"
          weight="medium"
        >
          Disconnect
        </Typography>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
