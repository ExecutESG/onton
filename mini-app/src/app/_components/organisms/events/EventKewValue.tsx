import Typography from "@/components/Typography";
import useWebApp from "@/hooks/useWebApp";
import { isTelegramUrl } from "@tonconnect/ui-react";
import { cva, VariantProps } from "class-variance-authority";
import { useRouter } from "next/navigation";
import React, { ReactNode, useEffect } from "react";

const eventKeyValueCva = cva("flex-1 text-sm font-medium text-black text-right", {
  variants: {
    variant: {
      base: "",
      link: "text-blue-500 truncate cursor-pointer text-center",
    },
  },
  compoundVariants: [{ variant: "base" }],
  defaultVariants: {
    variant: "base",
  },
});

export interface EventKeyValueProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof eventKeyValueCva> {
  label: string;
  value: ReactNode | string;
  href?: string;
}

const EventKeyValue = (props: EventKeyValueProps) => {
  const webApp = useWebApp();
  const router = useRouter();

  // Prefetch if href is a local link
  useEffect(() => {
    if (props.href?.startsWith("/")) {
      router.prefetch(props.href);
    }
  }, [router, props.href]);

  return (
    <div className="flex items-center justify-between">
      <Typography
        variant="subheadline1"
        weight={"medium"}
        className="flex-1 leading-5"
      >
        <label className="text-left text-sm text-cn-muted-foreground">{props.label}</label>
      </Typography>
      <p
        className={eventKeyValueCva({
          variant: props.variant,
        })}
        onClick={(e) => {
          e.preventDefault();

          if (props.href?.startsWith("/")) {
            router.push(props.href);
          } else {
            if (props.variant === "link" && typeof props.value === "string") {
              if (isTelegramUrl(props.href ?? props.value)) {
                webApp?.openTelegramLink(props.href ?? props.value);
              } else {
                webApp?.openLink(props.href ?? props.value);
              }
            }
          }
        }}
      >
        <Typography
          variant={"body"}
          weight={"medium"}
        >
          {props.variant === "link" && typeof props.value === "string"
            ? props.value.replace(/^https?:\/\//, "")
            : props.value}
        </Typography>
      </p>
    </div>
  );
};

export default EventKeyValue;
