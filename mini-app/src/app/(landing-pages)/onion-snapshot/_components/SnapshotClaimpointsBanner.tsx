import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { useConfigDate } from "@/hooks/useConfigDate";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

const TimeUnit = ({ value, label, hideOnXsm }: { value?: number; label: string; hideOnXsm?: boolean }) => (
  <div
    className={cn(
      "flex flex-col items-center bg-onion-extraLight/15 backdrop-blur-xl rounded-md px-2 py-1 min-w-[40px]",
      hideOnXsm && "hidden xsm:flex"
    )}
  >
    <Typography
      variant="title1"
      weight="bold"
      className="text-[20px] leading-[25px] text-info-[#1C1C1C]"
    >
      {value}
    </Typography>
    <Typography
      variant="caption2"
      className="text-onion-dark font-[276] text-[8px] leading-[13px] tracking-[0.1em]"
    >
      {label}
    </Typography>
  </div>
);

const SnapshotClaimPointsBanner = () => {
  const claimPointsTimeLeft = useConfigDate("snapshot_claim_end_date");
  const disabled = useConfigDate("snapshot_claim_disabled");

  const timeUnits = [
    { value: claimPointsTimeLeft?.days, label: "D" },
    { value: claimPointsTimeLeft?.hours, label: "H" },
    { value: claimPointsTimeLeft?.minutes, label: "M" },
    { value: claimPointsTimeLeft?.seconds, label: "S", hideOnXsm: true },
  ];

  if (!claimPointsTimeLeft || claimPointsTimeLeft?.isEnded || disabled) return null;

  return (
    <CustomCard
      defaultPadding={false}
      className="relative flex justify-center gap-3 rounded-xl p-3 bg-cover bg-center isolate border border-onion-extraLight flex-1 max-h-[128px]"
    >
      <div className="flex flex-col gap-2 flex-1 items-stretch justify-between w-full z-10">
        <div className="flex flex-col w-max">
          <div className="flex items-center gap-2">
            <Typography
              variant="title1"
              weight="bold"
              className="text-[28px] leading-[24px] tracking-normal"
            >
              ONION Drop
            </Typography>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Typography
              variant="title3"
              weight="semibold"
            >
              Live
            </Typography>
            <Typography
              variant="footnote"
              className=" text-balance text-[#1C1C1C] font-[276]"
            >
              Claim ONION until:
            </Typography>
          </div>
        </div>
        {/* Countdown */}
        <div className="flex items-center gap-1 w-full justify-center">
          {timeUnits.map((unit, index) => (
            <>
              <TimeUnit
                key={`${unit.label}-${index}`}
                value={unit.value}
                label={unit.label}
              />
              {index < timeUnits.length - 1 && (
                <Typography
                  variant="title2"
                  className={`text-[#F36A00] ${index === 2 ? "hidden xsm:block" : ""}`}
                >
                  :
                </Typography>
              )}
            </>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 w-full justify-center mt-auto z-10">
        <Image
          src="https://storage.onton.live/ontonimage/onion_points_claim-min_cm.png"
          alt="Banner BG"
          width={114}
          height={95}
          className="absolute top-0 right-0 -translate-y-1/4"
        />
        <Link
          href="/onion-snapshot"
          className="w-full"
        >
          <Button
            variant="outline-onion"
            className="px-3 py-2 rounded-md w-full backdrop-blur-xl border-[#FF8F37] border-2 text-black font-medium"
          >
            Claim Now
          </Button>
        </Link>
      </div>
    </CustomCard>
  );
};

export default SnapshotClaimPointsBanner;
