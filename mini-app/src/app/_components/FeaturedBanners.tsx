import { cn } from "@/utils";
import SnapShotBanner from "../(landing-pages)/onion-snapshot/_components/SnapShotBanner";

const FeaturedBanners = (props: { className?: string }) => {
  return (
    <div className={cn("flex flex-col gap-4", props.className)}>
      <SnapShotBanner />
    </div>
  );
};

export default FeaturedBanners;
