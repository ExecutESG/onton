import Typography from "@/components/Typography";
import { cn } from "@/lib/utils";
import React, { MouseEventHandler, ReactNode } from "react";

interface CustomCardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  /**
   * By default it's false
   */
  defaultPadding?: boolean;
  className?: string;
  /**
   * Callbacks
   */
  onClick?: MouseEventHandler<HTMLElement>;
}

const CustomCard: React.FC<CustomCardProps> = ({
  title,
  description,
  children,
  defaultPadding = false,
  className,
  onClick,
}) => {
  return (
    <div
      onClick={(e) => {
        onClick?.(e);
      }}
      className={cn("h-full bg-white rounded-2lg", defaultPadding && "p-4", className)}
    >
      {title || description ? (
        <div className={cn("p-4", defaultPadding && "p-0")}>
          {title && <Typography variant="title3">{title}</Typography>}
          {description && (
            <Typography
              variant="body"
              weight="normal"
              className="mt-2"
            >
              {description}
            </Typography>
          )}
        </div>
      ) : undefined}
      {children}
    </div>
  );
};

export default CustomCard;
