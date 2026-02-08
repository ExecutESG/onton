"use client";
import CustomButton from "@/app/_components/Button/CustomButton";
import { trpc } from "@/app/_trpc/client";
import OntonDialog from "@/components/OntonDialog";
import Typography from "@/components/Typography";
import tonIcon from "@/components/icons/ton.svg";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUserStore } from "@/context/store/user.store";
import { formatWalletAddress } from "@/server/utils/wallets-data";
import { useTonAddress, useTonConnectModal, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Button } from "konsta/react";
import { ChevronDownIcon, Wallet } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import CustomCard from "../atoms/cards/CustomCard";
import { NFT_EVENT_PRICE } from "@/constants";

export function ConnectWalletCard() {
  const [isOpen, setOpen] = useState(false);

  const [tonconnect] = useTonConnectUI();
  const walletModal = useTonConnectModal();
  const tonWallet = useTonWallet();
  const hasWallet = Boolean(tonWallet?.account.address);

  const pathanmem = usePathname();

  const handleConnectClick = () => {
    if (pathanmem === "/my") {
      setOpen(true);
    } else {
      walletModal.open();
    }
  };

  return (
    <CustomCard
      title="Your Wallet"
      className="w-full !mx-0"
    >
      {pathanmem === "/my" && (
        <ConfirmConnectDialog
          open={isOpen}
          onClose={() => setOpen(false)}
        />
      )}

      <div className="p-4 pt-0">
        {hasWallet ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <CustomButton
                variant="ghost"
                icon={<ChevronDownIcon />}
                className="w-full flex-row-reverse justify-between"
              >
                {formatWalletAddress(tonWallet?.account.address!)}
              </CustomButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              sideOffset={0}
              border="dark"
              fullWidth
              borderRadius="lg"
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  tonconnect.disconnect();
                  toast.success("Wallet disconnected");
                }}
                className="cursor-pointer !py-3"
              >
                <Wallet
                  className="!text-xl !w-5 !h-5"
                  size={20}
                />
                <Typography
                  variant="body"
                  weight="medium"
                >
                  Disconnect wallet
                </Typography>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <CustomButton
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleConnectClick();
            }}
            icon={
              <Image
                className="mr-1"
                src={tonIcon}
                alt=""
                width={15}
                height={15}
              />
            }
          >
            Connect your Wallet
          </CustomButton>
        )}
      </div>
    </CustomCard>
  );
}

function ConfirmConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const walletModal = useTonConnectModal();
  const tonWalletAddress = useTonAddress();

  const handleConnect = () => {
    walletModal.open();
  };

  const trpcUtils = trpc.useUtils();

  const addWalletMutation = trpc.users.addWallet.useMutation({
    onSuccess: () => {
      // trpcUtils.users.getVisitorReward.invalidate({}, { refetchType: "all" });
      trpcUtils.users.getWallet.invalidate({}, { refetchType: "all" });
      trpcUtils.users.syncUser.invalidate(undefined, { refetchType: "all" });
      onClose();
    },
  });

  const { user } = useUserStore();

  useEffect(() => {
    if (!user?.user_id) return;

    if (tonWalletAddress) {
      onClose();
    }

    if (!user?.wallet_address && tonWalletAddress) {
      toast.success("Your wallet is now connected");
      addWalletMutation.mutate({
        wallet: tonWalletAddress,
      });
    }
  }, [addWalletMutation, onClose, tonWalletAddress, user?.user_id, user?.wallet_address]);

  return (
    <OntonDialog
      open={open}
      onClose={onClose}
      title="Connect your wallet"
    >
      <Typography
        variant="body"
        className="text-center mb-6 font-normal"
      >
        <b>You are becoming an ONTON organizer.</b>
        <br />
        To create a channel and use special event publishing features, you need to pay {NFT_EVENT_PRICE} TON
      </Typography>
      <Button
        className="py-6 rounded-[10px] mb-3"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleConnect();
        }}
      >
        Connect Wallet
      </Button>
      <Button
        className="py-6 rounded-[10px]"
        outline
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      >
        Maybe Later
      </Button>
    </OntonDialog>
  );
}
