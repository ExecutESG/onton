"use client";

import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { useConfigDate } from "@/hooks/useConfigDate";
import Link from "next/link";
import { SnapshotClaimPoints } from "./_components/SnapshotClaimPoints";
import { SnapshotClosed } from "./_components/SnapshotClosed";
import { SnapshotComing } from "./_components/SnapshotComing";

const OnionSnapshotPage = () => {
  const snapshotTimeLeft = useConfigDate("snapshot_date");
  const claimPointsTimeLeft = useConfigDate("snapshot_claim_points_date");

  const claimAndSnapshotEnded = claimPointsTimeLeft?.isEnded && snapshotTimeLeft?.isEnded;

  return (
    <div className="bg-brand-bg p-4 flex flex-col gap-4 min-h-screen">
      {!snapshotTimeLeft?.isEnded ? (
        <SnapshotComing />
      ) : claimPointsTimeLeft?.isEnded ? (
        <SnapshotClaimPoints /> // claim lock has ended
      ) : (
        <SnapshotClosed /> // waiting for claim snapshot is closed
      )}

      {/* Card Section */}
      <CustomCard
        defaultPadding
        className="text-center h-auto"
      >
        <div className="flex flex-col gap-5">
          {/* Check Status */}
          {!snapshotTimeLeft?.isEnded && (
            <>
              <div className="flex flex-col gap-2">
                <Typography variant="callout">Let&apos;s find out how much you&apos;ve earned</Typography>

                <Link
                  href="/onion-snapshot/check-status"
                  className="w-full"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                  >
                    Check My Status
                  </Button>
                </Link>
              </div>

              {/* Boost Your Score */}
              <div className="flex flex-col gap-2">
                <Typography variant="callout">You can also:</Typography>

                <Link
                  href="/onion-snapshot/check-status/boost-your-score"
                  className="w-full"
                >
                  <Button
                    variant="info"
                    size="lg"
                    className="w-full"
                  >
                    Boost Your Score
                  </Button>
                </Link>
              </div>
            </>
          )}

          {/* Claim Points */}
          {claimAndSnapshotEnded && (
            <div className="flex flex-col gap-2">
              <Typography variant="callout">Let’s check the ONIONs you&apos;ve gathered</Typography>

              <Link
                href="/onion-snapshot/claim-points"
                className="w-full"
              >
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Claim ONIONs
                </Button>
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Typography variant="callout">Check:</Typography>

            <Link
              href="/onion-snapshot/important-dates"
              className="w-full"
            >
              <Button
                variant="info"
                size="lg"
                className="w-full"
              >
                Important Dates
              </Button>
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <Typography variant="callout">And know:</Typography>

            <Link
              href="/onion-snapshot/what-is-onion"
              className="w-full"
            >
              <Button
                variant="info"
                size="lg"
                className="w-full"
              >
                What is ONION?
              </Button>
            </Link>
          </div>
        </div>
      </CustomCard>
    </div>
  );
};

export default OnionSnapshotPage;
