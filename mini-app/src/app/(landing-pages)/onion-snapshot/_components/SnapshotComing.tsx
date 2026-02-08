import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import Image from "next/image";

export const SnapshotComing = () => {
  return (
    <CustomCard
      defaultPadding
      className="flex flex-col items-center gap-3 text-center w-full"
    >
      <Typography
        weight="bold"
        variant="title1"
      >
        ONION is Coming!
      </Typography>

      <Image
        src="https://storage.onton.live/ontonimage/onion-image-croped.png"
        width={280}
        height={143}
        alt="ONION"
        className="mx-auto"
      />

      <Typography variant="callout">And You may be eligible for a token airdrop!</Typography>
    </CustomCard>
  );
};
