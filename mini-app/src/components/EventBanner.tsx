import useWebApp from "@/hooks/useWebApp";
import { isValidImageUrl } from "@/lib/isValidImageUrl";
import { OntonEvent } from "@/types";
import { Skeleton } from "@mui/material";
import { useRouter } from "next/navigation";
import LoadableImage from "./LoadableImage";

type SkeletonProps = { skeleton: true; event?: null };
type EventProps = {
  skeleton?: false;
  event: OntonEvent;
  className?: string;
};

type Props = (SkeletonProps | EventProps) & {
  className?: string;
};

const defaultImage = "/template-images/default.webp";

const emptyObj = {} as any;
export default function EventBanner({ skeleton, event }: Props) {
  const webApp = useWebApp();
  const router = useRouter();

  const {
    eventUuid,
    title = "No Title",
    imageUrl = "/template-images/default.webp",
    ticketToCheckIn = false,
  } = event || emptyObj;

  const handleEventClick = () => {
    if (ticketToCheckIn) {
      webApp?.openTelegramLink(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}`);
    } else {
      router.push(`/events/${eventUuid}`);
      return false;
    }
  };

  return skeleton ? (
    <Skeleton
      className="rounded-md"
      height={220}
      width={220}
      sx={{ transform: "unset" }}
    />
  ) : (
    <div
      className="relative isolate w-[220px] h-[220px]"
      onClick={(e) => {
        e.preventDefault();
        handleEventClick();
      }}
      key={`detailed-${eventUuid}`}
    >
      <LoadableImage
        // if date now before 5 november 2024 show special image
        src={isValidImageUrl(imageUrl) ? imageUrl : defaultImage}
        alt={title}
        width={220}
        height={220}
        className={`aspect-square w-[220px] rounded-[10px] transition-opacity duration-250`}
        onError={(e) => (e.currentTarget.src = defaultImage)}
      />
    </div>
  );
}
