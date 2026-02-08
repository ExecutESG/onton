"use client";

import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import OntonIcon from "@/app/_components/icons/onton-icon";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import useWebApp from "@/hooks/useWebApp";
import { useTonWallet } from "@tonconnect/ui-react";
import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "../../genesis-onions/_components/Merge/constants";

const CheckStatusPage = () => {
  const webapp = useWebApp();
  const walletAddress = useTonWallet();

  const onionCampaignOnionQuery = trpc.campaign.getWalletInfo.useQuery({
    walletAddress: walletAddress?.account.address ?? "",
  });

  const totalPointsQuery = trpc.usersScore.getTotalScoreByUserId.useQuery();

  const [goldAbleArr, silverAbleArr, bronzeAbleArr] = ["1", "2", "3"].map((type) =>
    (onionCampaignOnionQuery.data?.itemsByType[type] || []).filter((item) => item.offChain.mergeStatus === "able_to_merge")
  );

  return (
    <div>
      {/* Your ONION Snapshot Section */}
      <div className="bg-[#EFEFF4] p-4 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Typography
            variant="title1"
            weight="bold"
          >
            Your ONION Snapshot
          </Typography>
          <Typography
            variant="footnote"
            className="text-center px-4"
          >
            This is not a live estimator - final numbers will be calculated after snapshot at May 30. Claim opens June 10
          </Typography>
        </div>

        {/* Genesis Season Pool Card */}
        <CustomCard defaultPadding>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Typography variant="title3">Genesis Season Pool</Typography>
              <Typography
                variant="footnote"
                weight="medium"
              >
                Earned by joining and organizing events and referring others. More points = More ONION.
              </Typography>
            </div>

            {/* Points Section */}
            <div className="flex items-center justify-center gap-2 border border-[#8E8E93] rounded-lg p-3">
              <OntonIcon />
              <div className="flex flex-col">
                <Typography
                  variant="title3"
                  weight="bold"
                >
                  {totalPointsQuery.isLoading
                    ? "Loading..."
                    : totalPointsQuery.error
                      ? "Error loading points"
                      : Number(totalPointsQuery.data ?? 0)}
                </Typography>
                <Typography variant="footnote">ONTON points</Typography>
              </div>
            </div>

            <Link
              href="/onion-snapshot/check-status/boost-your-score"
              className="w-full"
            >
              <Button
                variant="primary"
                size="lg"
                className="w-full bg-[#007AFF] text-white"
              >
                Boost Your Score
              </Button>
            </Link>
          </div>
        </CustomCard>

        {/* Genesis ONIONs NFTs Card */}
        <CustomCard defaultPadding>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Typography variant="title3">Genesis ONIONs NFTs</Typography>
              <Typography
                variant="footnote"
                weight="medium"
              >
                Get ONIONs to earn airdrop share. Merge NFTs for platinum to boost further!
              </Typography>
              <Typography
                variant="footnote"
                weight="medium"
              >
                Your NFT rarity multiplies your airdrop weight.
              </Typography>
            </div>

            {/* NFT Ownership Section */}
            <div className="flex flex-col gap-2">
              <Typography variant="callout">You Own</Typography>

              <div className="flex w-full">
                <div className="flex flex-col items-center flex-1">
                  <div className="h-14 w-14 rounded-lg bg-[#CBA65E] overflow-hidden">
                    <Image
                      src={getImageUrl("Platinum")}
                      width={56}
                      height={56}
                      alt="Platinum NFT"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-center mt-2">
                    <Typography
                      variant="headline"
                      weight="bold"
                    >
                      {onionCampaignOnionQuery.data?.platinumCount ?? 0}
                    </Typography>
                    <Typography
                      variant="footnote"
                      className="text-[#6D6D72]"
                    >
                      Platinum
                    </Typography>
                  </div>
                </div>
                <div className="border-l border-[#8E8E93] mx-2"></div>
                <div className="flex flex-col items-center flex-1">
                  <div className="h-14 w-14 rounded-lg bg-[#D4AF37] overflow-hidden">
                    <Image
                      src={getImageUrl("Gold")}
                      width={56}
                      height={56}
                      alt="Gold NFT"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-center mt-2">
                    <Typography
                      variant="headline"
                      weight="bold"
                    >
                      {goldAbleArr.length}
                    </Typography>
                    <Typography
                      variant="footnote"
                      className="text-[#6D6D72]"
                    >
                      Gold
                    </Typography>
                  </div>
                </div>
                <div className="border-l border-[#8E8E93] mx-2"></div>
                <div className="flex flex-col items-center flex-1">
                  <div className="h-14 w-14 rounded-lg bg-[#C0C0C0] overflow-hidden">
                    <Image
                      src={getImageUrl("Silver")}
                      width={56}
                      height={56}
                      alt="Silver NFT"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-center mt-2">
                    <Typography
                      variant="headline"
                      weight="bold"
                    >
                      {silverAbleArr.length}
                    </Typography>
                    <Typography
                      variant="footnote"
                      className="text-[#6D6D72]"
                    >
                      Silver
                    </Typography>
                  </div>
                </div>
                <div className="border-l border-[#8E8E93] mx-2"></div>
                <div className="flex flex-col items-center flex-1">
                  <div className="h-14 w-14 rounded-lg bg-[#CD7F32] overflow-hidden">
                    <Image
                      src={getImageUrl("Bronze")}
                      width={56}
                      height={56}
                      alt="Bronze NFT"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-center mt-2">
                    <Typography
                      variant="headline"
                      weight="bold"
                    >
                      {bronzeAbleArr.length}
                    </Typography>
                    <Typography
                      variant="footnote"
                      className="text-[#6D6D72]"
                    >
                      Bronze
                    </Typography>
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full bg-[#007AFF] text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                webapp?.openLink("https://getgems.io/genesisonions");
              }}
            >
              Collect More ONIONs
            </Button>
          </div>
        </CustomCard>

        {/* Partner Allocation Card */}
        <CustomCard defaultPadding>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Typography variant="title3">Partner Allocation</Typography>
              <Typography
                variant="footnote"
                weight="medium"
              >
                Some partner wallets or early supporters may receive additional drops.
              </Typography>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full bg-[#007AFF] text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                webapp?.openLink(
                  "https://docs.google.com/forms/d/e/1FAIpQLSfJQMGN8yBgTA2EdQ2aqwKBXdAvs9pwaa-Mc8-C7bU8RfFxsg/viewform"
                );
              }}
            >
              Request For Partnership
            </Button>
          </div>
        </CustomCard>
      </div>
    </div>
  );
};

export default CheckStatusPage;
