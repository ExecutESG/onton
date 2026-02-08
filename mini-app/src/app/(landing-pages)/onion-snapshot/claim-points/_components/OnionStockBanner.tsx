import { useClaimPointsContext } from "../ClaimPointsContext";

export default function OnionStockBanner() {
  const { wallets } = useClaimPointsContext();
  const claimAmount = Number(
    Math.round(
      (wallets?.filter((w) => w.claimStatus === "claimed")?.reduce((pv, cv) => pv + Number(cv.totalOnions), 0) ?? 0) * 100
    ) / 100
  );

  return (
    <div className="rounded-lg bg-gradient-to-br from-[#FFAE6E] to-[#F36A00] opacity-60 border shadow-inner backdrop-blur-sm flex flex-col justify-center items-center gap-4 py-4 w-full">
      <div className="flex flex-col gap-2">
        <div className="font-medium text-[13px] leading-[1.38] text-center text-white tracking-tightest">
          Your Current Token Balance is
        </div>
        <div className="font-bold text-3xl leading-tight text-center text-white tracking-tighter">
          {isNaN(claimAmount) ? "?" : claimAmount} ONIONs
        </div>
      </div>
    </div>
  );
}
