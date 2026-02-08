"use client";

import Typography from "@/components/Typography";
import { useConfigDate } from "@/hooks/useConfigDate";
import DateCard from "./DateCard";

const ImportantDates = () => {
  const snapshotTimeLeft = useConfigDate("snapshot_date");

  return (
    <div className="bg-brand-bg p-4 flex flex-col gap-4 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col items-center gap-2 text-center w-full">
        <Typography
          weight="bold"
          variant="title1"
        >
          Important Dates
        </Typography>
        <Typography
          className="font-normal"
          variant="callout"
        >
          Don&apos;t miss your ONION Rewards
        </Typography>
      </div>

      {/* Snapshot Date Card */}
      {!snapshotTimeLeft?.isEnded && (
        <DateCard
          iconSrc="/images/snapshot.svg"
          title="Snapshot Date"
          endDateKey="snapshot_date"
          link="/onion-snapshot/check-status"
          linkText="Check Status"
          showCountdown={true}
        />
      )}

      {/* Claim Portal Opens Card */}
      <DateCard
        iconSrc="/images/gift-icon.svg"
        title="Claim Portal Opens"
        link="https://onion.tg/docs/"
        description="Use / Claim ONIONs to receive your ONION tokens and be a part of the governance power of TON Ecosystem."
        date="June 10, 2025"
      />

      <DateCard
        iconSrc="https://storage.onton.live/ontonimage/airdrop-calendar.svg"
        title="Token Generation Event"
        link="https://onion.tg/docs/"
        date="June 20, 2025"
      />

      <DateCard
        iconSrc="https://storage.onton.live/ontonimage/airdrop-checklist.svg"
        title="DEX Listing Date"
        link="https://onion.tg/docs/"
        date="June 20, 2025"
      />

      <DateCard
        iconSrc="https://storage.onton.live/ontonimage/airdrop-lock-open.svg"
        title="Genesis Airdrop Unlock"
        link="https://onion.tg/docs/"
        date="June 20, 2025"
      />

      <DateCard
        iconSrc="https://storage.onton.live/ontonimage/airdrop-mountain.svg"
        title="Genesis Airdrop Cliff"
        link="https://onion.tg/docs/"
        date="September 20, 2025"
      />
    </div>
  );
};

export default ImportantDates;
