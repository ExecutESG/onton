import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/context/ConfigContext";
import { useConfigDate } from "@/hooks/useConfigDate";
import Image from "next/image";
import Link from "next/link";
import SnapShotWaitForClaimBanner from "./SnapshotWaitForClaimBanner ";

const SnapShotBanner = () => {
  const timeLeft = useConfigDate("snapshot_date");
  const config = useConfig();
  const disable = config["disable_snapshot_banner"];

  if (!timeLeft || timeLeft?.isEnded || disable) return <SnapShotWaitForClaimBanner />;

  return (
    <CustomCard
      defaultPadding={false}
      className="relative overflow-hidden flex flex-col items-center justify-center gap-3 rounded-xl p-4 bg-cover bg-center isolate"
    >
      <Image
        src="https://storage.onton.live/ontonimage/onion_airdrop_cm.jpg"
        alt="Banner BG"
        width={600}
        height={200}
        className="absolute inset-0 w-full h-full object-cover -z-10"
      />
      {/* another overlay only color background: #00000052; */}
      <div className="absolute inset-0 w-full h-full bg-black/40" />
      <div className="flex gap-4 items-center w-full z-10">
        <div className="flex flex-col w-full">
          <div className="flex items-center gap-2">
            <Typography
              variant="title3"
              weight="semibold"
              className="text-white"
            >
              Genesis
            </Typography>
            <Typography
              variant="subheadline2"
              className="text-white/80 text-balance"
            >
              comes to an end in:
            </Typography>
          </div>
          <Typography
            variant="title1"
            weight="bold"
            className="text-white"
          >
            Season
          </Typography>
        </div>
        <div className="flex items-center gap-1 w-full justify-center">
          {/* Days */}
          <div className="flex flex-col items-center bg-white/5 backdrop-blur-xl rounded-md px-2 py-1 min-w-[40px]">
            <Typography
              variant="title2"
              weight="bold"
              className="text-white"
            >
              {timeLeft?.days}
            </Typography>
            <Typography
              variant="caption2"
              className="text-white/80"
            >
              D
            </Typography>
          </div>
          <Typography
            variant="title2"
            className="text-[#F36A00]"
          >
            :
          </Typography>
          {/* Hours */}
          <div className="flex flex-col items-center bg-white/5 backdrop-blur-xl rounded-md px-2 py-1 min-w-[40px]">
            <Typography
              variant="title2"
              weight="bold"
              className="text-white"
            >
              {timeLeft?.hours}
            </Typography>
            <Typography
              variant="caption2"
              className="text-white/80"
            >
              H
            </Typography>
          </div>
          <Typography
            variant="title2"
            className="text-[#F36A00]"
          >
            :
          </Typography>
          {/* Minutes */}
          <div className="flex flex-col items-center bg-white/5 backdrop-blur-xl rounded-md px-2 py-1 min-w-[40px]">
            <Typography
              variant="title2"
              weight="bold"
              className="text-white"
            >
              {timeLeft?.minutes}
            </Typography>
            <Typography
              variant="caption2"
              className="text-white/80"
            >
              M
            </Typography>
          </div>
          <Typography
            variant="title2"
            className="text-[#F36A00] hidden xsm:block"
          >
            :
          </Typography>
          {/* Seconds */}
          <div className="flex-col items-center bg-white/5 backdrop-blur-xl rounded-md px-2 py-1 min-w-[40px] hidden xsm:flex">
            <Typography
              variant="title2"
              weight="bold"
              className="text-white"
            >
              {timeLeft?.seconds}
            </Typography>
            <Typography
              variant="caption2"
              className="text-white/80"
            >
              S
            </Typography>
          </div>
        </div>
      </div>
      <div className="flex w-full justify-center mt-auto z-10">
        <Link
          href="/onion-snapshot"
          className="w-full"
        >
          <Button
            variant="outline-onion"
            className="text-white px-3 py-2 rounded-md w-full bg-white/5 backdrop-blur-xl border-[#FF8F37] border-2"
          >
            Secure Your Airdrop
          </Button>
        </Link>
      </div>
    </CustomCard>
  );
};

export default SnapShotBanner;
