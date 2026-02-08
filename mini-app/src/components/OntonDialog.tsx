import Typography from "@/components/Typography";
import { cn } from "@/utils";
import { ReactNode, useRef } from "react";

export default function OntonDialog({
  open,
  onClose,
  title,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        if (innerRef.current?.contains(e.target as any)) return;
        onClose();
      }}
      className={cn(
        "fixed z-0 inset-0 bg-[#0008] duration-300 transition-ease-out opacity-0 invisible",
        open && " visible opacity-100 z-30 "
      )}
    >
      <div
        ref={innerRef}
        className={cn(
          "left-1/2 top-1/2 transform -translate-x-1/2 z-40 max-h-full overflow-hidden duration-300 fixed rounded-xl max-w-full w-[80%] bg-white dark:bg-neutral-800 p-4",
          open && "-translate-y-1/2"
        )}
      >
        <Typography
          variant="title3"
          className="text-center mb-8 font-normal"
        >
          {title}
        </Typography>
        {children}
      </div>
    </div>
  );
}
