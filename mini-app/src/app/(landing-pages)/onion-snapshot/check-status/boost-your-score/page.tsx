"use client";

import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import OntonIcon from "@/app/_components/icons/onton-icon";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import useWebApp from "@/hooks/useWebApp";
import { telegramShareLink } from "@/utils";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const BoostYourScorePage = () => {
  const totalPointsQuery = trpc.usersScore.getTotalScoreByUserId.useQuery();
  const ontonJoinAffiliateDataQuery = trpc.task.getOntonJoinAffiliateData.useQuery();

  const webapp = useWebApp();

  return (
    <div className="bg-[#EFEFF4] min-h-screen flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center pt-4">
        <Typography
          variant="title1"
          weight="bold"
        >
          Boost Your Score
        </Typography>
        <Typography
          variant="footnote"
          className="text-center px-4"
        >
          Earn more ONIONs by growing your ONTON points
        </Typography>
      </div>

      {/* Points card */}
      <div className="flex items-center justify-between bg-white py-3 px-8 gap-2">
        <div className="flex items-center gap-6 bg-white rounded-lg">
          <div className="flex items-center gap-2">
            <OntonIcon />
            <div className="flex flex-col">
              <Typography variant="headline">
                {totalPointsQuery.isLoading
                  ? "Loading..."
                  : totalPointsQuery.error
                    ? "Error loading points"
                    : Number(totalPointsQuery.data ?? 0)}
              </Typography>
              <Typography variant="caption1">ONTON points</Typography>
            </div>
          </div>
        </div>
        <Link
          href="/my/points"
          className="text-primary  hover:underline font-medium"
        >
          <Typography
            variant="subheadline1"
            weight="medium"
            className="flex items-center"
          >
            <span>View Details</span>
            <ChevronRightIcon
              strokeWidth={3}
              className="w-4 h-4"
            />
          </Typography>
        </Link>
      </div>
      <div className=" p-4 flex flex-col gap-4">
        {/* Join Events Card */}
        <CustomCard
          defaultPadding
          title="Join Events"
          description="Attend online or offline events to collect SBTs and earn points"
          className="flex flex-col gap-4"
        >
          <Link href="/">
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-[#007AFF] text-white"
            >
              Explore Events
            </Button>
          </Link>
        </CustomCard>

        {/* Organize Events Card */}
        <CustomCard
          defaultPadding
          className="flex flex-col gap-4"
          title="Organize Events"
          description="Get extra points when others claim your event's SBT."
        >
          <Link href="/my">
            <Button
              variant="primary"
              size="lg"
              className="w-full bg-[#007AFF] text-white"
            >
              Create an Event
            </Button>
          </Link>
        </CustomCard>

        {/* Invite Friends Card */}
        <CustomCard
          defaultPadding
          className="flex flex-col gap-4"
          title="Invite Friends"
          description="Earn +0.2 points for every friend you invite who starts ONTON."
        >
          {/* Referral link box */}
          <div className="w-full bg-[#EEEEF0] rounded-lg">
            <div className="flex justify-between items-center p-4">
              <Typography
                variant="body"
                weight="normal"
                className="opacity-40"
              >
                {ontonJoinAffiliateDataQuery.isLoading ? (
                  "Loading..."
                ) : ontonJoinAffiliateDataQuery.error ? (
                  <span className="text-red-500">Error: {ontonJoinAffiliateDataQuery.error.message}</span>
                ) : (
                  ontonJoinAffiliateDataQuery.data?.linkHash
                )}
              </Typography>
            </div>
          </div>

          {/* Button group */}
          <div className="flex gap-2 w-full xs:flex-wrap">
            <Button
              variant="primary"
              size="lg"
              className="flex-1 bg-[#007AFF] text-white tracking-tighter"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (ontonJoinAffiliateDataQuery.data?.linkHash) {
                  await navigator.clipboard.writeText(ontonJoinAffiliateDataQuery.data?.linkHash);
                  toast.success("Link copied to clipboard");
                } else {
                  toast.error("No link hash found");
                }
              }}
              disabled={!ontonJoinAffiliateDataQuery.data?.linkHash}
            >
              Copy Link
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1 bg-[#007AFF] text-white tracking-tighter"
              disabled={!ontonJoinAffiliateDataQuery.data?.linkHash}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (ontonJoinAffiliateDataQuery.data?.linkHash) {
                  webapp?.openTelegramLink(
                    telegramShareLink(
                      ontonJoinAffiliateDataQuery.data?.linkHash,
                      `
Join ONTON Affiliate

Check out this exclusive ONTON referral link for special tasks and bonuses:

Good luck and see you in the ONTON world! 🏆`
                    )
                  );
                } else {
                  toast.error("No link hash found");
                }
              }}
            >
              Share to Telegram
            </Button>
          </div>
        </CustomCard>
        <p className="text-center">Points are counted until May 30, 2025. Earn as many as you can before the snapshot!</p>
      </div>
    </div>
  );
};

export default BoostYourScorePage;
