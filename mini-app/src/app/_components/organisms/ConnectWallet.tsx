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
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import CustomCard from "../atoms/cards/CustomCard";

export function ConnectWalletCard() {
  const [isOpen, setOpen] = useState(false);

  const [tonconnect] = useTonConnectUI();
  const walletModal = useTonConnectModal();
  const tonWallet = useTonWallet();
  const hasWallet = Boolean(tonWallet?.account.address);

  const pathanmem = usePathname();

  const trpcUtils = trpc.useUtils();
  const unlinkWalletMutation = trpc.users.unlinkIdentity.useMutation({
    onSuccess: () => {
      trpcUtils.users.getWallet.invalidate();
      trpcUtils.users.syncUser.invalidate();
      trpcUtils.users.getLinkedIdentities.invalidate();
    },
  });

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
          <div className="flex gap-2 items-center">
            <div className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 font-mono text-sm text-gray-800 dark:text-gray-200 truncate">
              {formatWalletAddress(tonWallet?.account.address!)}
            </div>
            <CustomButton
              variant="outline"
              size="md"
              buttonClassName="!w-auto px-4 border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  await tonconnect.disconnect();
                } catch (err) {
                  console.error("TonConnect disconnect error:", err);
                }
                unlinkWalletMutation.mutate({ provider: "ton_wallet" });
                toast.success("Wallet disconnected");
              }}
            >
              Disconnect
            </CustomButton>
          </div>
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

  const prevWalletRef = useRef(tonWalletAddress);

  useEffect(() => {
    if (!user?.user_id) return;

    if (tonWalletAddress) {
      onClose();
    }

    // Only auto-link if the wallet address JUST became available (e.g. user just scanned QR),
    // preventing auto-linking on page load if local storage has a stale session.
    if (!user?.wallet_address && tonWalletAddress && prevWalletRef.current !== tonWalletAddress) {
      toast.success("Your wallet is now connected");
      addWalletMutation.mutate({
        wallet: tonWalletAddress,
      });
    }
    prevWalletRef.current = tonWalletAddress;
  }, [addWalletMutation, onClose, tonWalletAddress, user?.user_id, user?.wallet_address]);

  const isTonModalOpen = walletModal.state?.status === "opened";

  return (
    <OntonDialog
      open={open}
      onClose={onClose}
      title="Connect your wallet"
      className={isTonModalOpen ? "opacity-0 pointer-events-none" : undefined}
    >
      <Typography
        variant="body"
        className="text-center mb-6 font-normal"
      >
        <b>Connect your TON wallet</b>
        <br />
        Optional: connect a wallet for crypto ticket payouts, crypto purchases, or on-chain credentials. Creating events, attending, and door check-ins never require a wallet.
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
