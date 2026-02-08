import Typography from "@/components/Typography";
import { cn } from "@/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { ReactNode } from "react";

export type DataStatusProps = {
  status: keyof typeof DATA_STATUS_ANIMATIONS;
  title?: ReactNode;
  description?: ReactNode;
  size?: keyof typeof ANIMATION_SIZES;
  className?: string;
  canvasWrapperClassName?: string;
  // Action Button
  actionButton?: ReactNode;
};

export const DATA_STATUS_ANIMATIONS = {
  not_found: "https://storage.onton.live/ontonimage/looking_duck.lottie",
  approved: "https://storage.onton.live/ontonimage/approved.lottie",
  rejected: "https://storage.onton.live/ontonimage/rejected.lottie",
  success: "https://storage.onton.live/ontonimage/assertive_duck.lottie",
  danger: "https://storage.onton.live/ontonimage/crying_duck.lottie",
  pending: "https://storage.onton.live/ontonimage/pending_duck.lottie",
  sent: "https://storage.onton.live/ontonimage/send-flying-paper-dart.lottie",
  searching: "https://storage.onton.live/ontonimage/duck-searching.json",
  search_list: "https://storage.onton.live/ontonimage/search_list_duck.json",
  blocked: "https://storage.onton.live/ontonimage/tea_drinking_green_frog.json",
  map_looking: "https://storage.onton.live/ontonimage/duck_looking_at_map.json",
  archive_duck: "https://storage.onton.live/ontonimage/archive_duck.json",
  temp_unavailable: "https://storage.onton.live/ontonimage/constructin.json",
} as const;

export const ANIMATION_SIZES = {
  lg: 188,
  md: 120,
  sm: 60,
} as const;

export default function DataStatus(props: DataStatusProps) {
  return (
    <div className={cn("flex flex-col items-center mx-auto gap-4 max-w-96", props.className)}>
      <DotLottieReact
        loop
        autoplay
        style={{
          // @ts-expect-error
          maxWidth: ANIMATION_SIZES[props.size] || ANIMATION_SIZES.md,
          // @ts-expect-error
          maxHeight: ANIMATION_SIZES[props.size] || ANIMATION_SIZES.md,
        }}
        src={DATA_STATUS_ANIMATIONS[props.status]}
        // @ts-expect-error
        height={ANIMATION_SIZES[props.size] || ANIMATION_SIZES.md}
        // @ts-expect-error
        width={ANIMATION_SIZES[props.size] || ANIMATION_SIZES.md}
        className={cn("mx-auto", props.canvasWrapperClassName)}
      />
      <div className="flex flex-col items-center px-4 flex-1 gap-2 text-center">
        <Typography
          variant="title3"
          bold
          className="text-balance"
        >
          {props.title}
        </Typography>
        <Typography
          variant="subheadline1"
          weight="medium"
        >
          {props.description}
        </Typography>
      </div>
      {/* Action Button */}
      {props.actionButton}
    </div>
  );
}
