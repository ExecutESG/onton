import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import InfoCircleFillIcon from "@/app/_components/icons/info-circle-fill";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

const alertVariants = cva("relative w-full rounded-2lg p-2 items-center flex", {
  variants: {
    variant: {
      default: "bg-disabled-font/10 text-disabled-font",
      info: "bg-info-light text-black items-start gap-2",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const alertGenericVariants = cva("relative w-full rounded-2lg p-2 items-center flex", {
  variants: {
    variant: {
      info: "bg-info-light text-black items-start gap-2",
      "info-light": "bg-info-light text-black items-start gap-2",
      destructive: "bg-destructive-light text-black items-start gap-2",
    },
  },
});

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
);
AlertDescription.displayName = "AlertDescription";

const AlertGeneric = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "info" | "destructive" | "info-light";
  }
>(({ className, ...props }, ref) => (
  <Alert
    ref={ref}
    className={cn("gap-2 text-cn-muted-foreground", className, alertGenericVariants({ variant: props.variant }))}
  >
    {props.variant === "info" && <Info className="min-w-6" />}
    {props.variant === "info-light" && <InfoCircleFillIcon className="min-w-6" />}
    <AlertDescription>{props.children}</AlertDescription>
  </Alert>
));
AlertGeneric.displayName = "AlertGeneric";

export { Alert, AlertDescription, AlertGeneric, AlertTitle };
