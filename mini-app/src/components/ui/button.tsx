"use client";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Button as KButton } from "konsta/react";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-cn-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cn-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-2lg disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-cn-primary-foreground hover:bg-cn-primary/30",
        primary: "bg-cn-primary text-cn-primary-foreground",
        destructive: "bg-cn-destructive text-cn-destructive-foreground",
        outline: "border-2 border-cn-primary text-cn-primary hover:border-cn-primary/80",
        secondary: "bg-cn-secondary text-cn-secondary-foreground hover:bg-cn-secondary/30",
        info: "bg-info text-black",
        ghost: "hover:bg-cn-accent hover:text-accent-foreground bg-cn-accent",
        success: "bg-cn-success text-cn-success-foreground",
        "success-outline": "border-2 border-cn-success text-cn-success hover:border-cn-success/80",
        "destructive-outline": "border-2 border-cn-destructive text-cn-destructive hover:border-cn-destructive/80",
        // link success and destructive
        "success-link": "text-cn-success hover:underline",
        "destructive-link": "text-cn-destructive hover:underline",
        link: "text-cn-primary underline-offset-4 text-zinc hover:underline",
        "primary-onion":
          "bg-onion text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 disabled:opacity-100 disabled:bg-[#E8E8E9] disabled:text-[#6D6D72] hover:bg-orange",
        "outline-onion":
          "border border-onion-extraLight text-onion-extraLight hover:bg-onion/10 bg-white/5 backdrop-blur-md rounded-lg",
        "secondary-onion": "bg-white/20 text-white",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "rounded-md px-3 py-2",
        xs: "rounded-md px-2 py-1",
        lg: "min-h-11 rounded-2lg px-8 text-[17px] leading-[22px] tracking-[-0.43] font-semibold",
        icon: "min-h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={props.disabled || isLoading}
        {...props}
      >
        {isLoading ? <Loader2 className="me-2 min-h-4 w-4 animate-spin" /> : props.children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants, KButton };
