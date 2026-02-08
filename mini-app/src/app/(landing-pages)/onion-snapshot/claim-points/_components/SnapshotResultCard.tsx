import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { AlertGeneric } from "@/components/ui/alert";
import { useClaimPointsContext } from "../ClaimPointsContext";
import WalletSummaryCard from "./WalletSummaryCard";

export default function SnapshotResultCard() {
  const pointWallets = useClaimPointsContext();

  return (
    <CustomCard
      className="flex flex-col gap-4 p-5 rounded-[10px]"
      defaultPadding={false}
    >
      <Typography
        variant="title3"
        className="text-center text-black"
      >
        Snapshot Result
      </Typography>

      <div className="h-[1px] bg-brand-bg w-full" />
      {!pointWallets.wallets?.length && (
        <>
          <p className="text-center text-black">
            You can easily Claim the ONIONs you've earned during the snapshot phase. It's a great way to see what you've
            accumulated!
          </p>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-col items-center gap-2 p-4 rounded-[10px] bg-[#EFEFF4]/50 flex-1">
              <img
                src="https://storage.onton.live/ontonimage/gem_nft_onions_icon.svg"
                alt="ONION NFTs icon"
                className="w-[60px] h-[60px]"
              />
              <Typography
                variant="subheadline1"
                className="text-center text-[#575757]"
              >
                ONION NFTs
              </Typography>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-[10px] bg-[#EFEFF4]/50 flex-1">
              <img
                src="https://storage.onton.live/ontonimage/ticket_onions_icon.svg"
                alt="Event Attendance icon"
                className="w-[60px] h-[60px]"
              />
              <Typography
                variant="subheadline1"
                className="text-center text-[#575757]"
              >
                Event Attendance
              </Typography>
            </div>
          </div>
        </>
      )}

      {pointWallets.wallets?.map((wallet) => (
        <WalletSummaryCard
          key={wallet.walletAddress}
          wallet={wallet}
        />
      ))}

      {/* {pointWallets.wallets?.length && pointWallets.wallets.every((wallet) => wallet.claimStatus === "claimed") && (
        <ConnectNewWalletCard />
      )} */}

      {pointWallets.wallets?.length && pointWallets.wallets.every((wallet) => wallet.claimStatus === "claimed") && (
        <AlertGeneric variant="info-light">
          If you own NFTs in different wallets, you need to disconnect the current wallet and connect your other wallet.
        </AlertGeneric>
      )}
    </CustomCard>
  );
}
