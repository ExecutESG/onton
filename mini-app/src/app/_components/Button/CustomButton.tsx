import Typography, { TypographyProps } from "@/components/Typography";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils";
import { cva, VariantProps } from "class-variance-authority";
import { Preloader } from "konsta/react";
import React, { ReactNode } from "react";

interface CustomButtonProps {
  children: ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: "lg" | "md";
  isLoading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  fontSize?: TypographyProps["variant"];
  fontWeight?: TypographyProps["weight"];
  onClick?: (_e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  buttonClassName?: string;
}

const customButtonVariants = cva("p-4 w-full min-w-20 disabled:opacity-70", {
  variants: {
    size: {
      lg: "h-12 rounded-2lg",
      md: "h-9 rounded-2lg",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

const CustomButton: React.FC<CustomButtonProps> = ({
  children,
  icon,
  fontWeight = "medium",
  fontSize = "body",
  variant = "primary",
  size,
  isLoading = false,
  disabled = false,
  className,
  onClick,
  buttonClassName,
}) => (
  <Button
    itemType="button"
    disabled={isLoading || disabled}
    onClick={(e) => {
      onClick?.(e);
    }}
    className={cn(customButtonVariants({ size }), buttonClassName)}
    type="button"
    variant={variant}
  >
    <Typography
      variant={fontSize}
      weight={fontWeight}
      className={cn("capitalize flex gap-2 items-center", className)}
    >
      {isLoading ? (
        <Preloader size="w-4 h-4" />
      ) : (
        <>
          {icon && <span>{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </Typography>
  </Button>
);

export default CustomButton;
