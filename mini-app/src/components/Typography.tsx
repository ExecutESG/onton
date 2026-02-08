import { cn } from "@/utils";
import { cva, VariantProps } from "class-variance-authority";
import { ReactNode } from "react";

export const typographyVariants = cva("break-words", {
  variants: {
    variant: {
      title1: "text-[28px] font-normal leading-[34px] tracking-[0.38px]",
      title2: "text-[22px] font-bold leading-[28px]",
      title3: "text-[20px] font-bold leading-[24px] tracking-[-0.45px]",
      headline: "text-lg font-semibold leading-[22px]",
      body: "!text-base font-normal leading-[22px] tracking-[-0.43px]",
      callout: "text-base font-semibold leading-[22px]",
      subheadline1: "text-sm font-extralight leading-5",
      subheadline2: "text-sm font-normal leading-[18px]",
      caption1: "text-xs font-light leading-[16px]",
      caption2: "text-[11px] font-normal leading-[13px]",
      footnote: "text-[13px] font-normal leading-[18px] tracking-[-0.08px]",
    },
    weight: {
      thin: "font-thin", // font-weight: 100
      extralight: "font-extralight", // font-weight: 200
      light: "font-light", // font-weight: 300
      normal: "font-normal", // font-weight: 400
      medium: "font-medium", // font-weight: 510
      semibold: "font-semibold", // font-weight: 590
      bold: "font-bold", // font-weight: 700
      extrabold: "font-extrabold", // font-weight: 800
      black: "font-black", // font-weight: 900
    },
    truncate: {
      false: null,
      true: "truncate",
    },
    bold: {
      false: null,
      true: "font-bold",
    },
  },
  defaultVariants: {
    variant: "body",
    truncate: false,
    bold: false,
  },
});

export interface TypographyProps extends VariantProps<typeof typographyVariants> {
  children: ReactNode;
  className?: string;
}

export default function Typography({ children, className, ...props }: TypographyProps) {
  return <div className={cn(typographyVariants(props), className)}>{children}</div>;
}
