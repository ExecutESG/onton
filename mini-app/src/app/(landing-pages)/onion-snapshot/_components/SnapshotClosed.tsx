import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import DataStatus from "@/app/_components/molecules/alerts/DataStatus";

export const SnapshotClosed = () => {
  return (
    <CustomCard defaultPadding>
      <DataStatus
        status="search_list"
        size="lg"
        title="Snapshot is closed"
        description={
          <div className="flex flex-col gap-2 font-normal">
            <p>
              We&apos;ve taken a snapshot of your NFTs and points on May 30-23:59, and they&apos;re safely stored with us!
            </p>

            <p>Your ONIONs will be calculated and will be ready for you to claim on June 10.</p>
            <p>We truly appreciate your patience during this process!</p>
          </div>
        }
      />
    </CustomCard>
  );
};
