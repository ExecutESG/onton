import Typography from "@/components/Typography";
import { cn } from "@/utils";
import { X } from "lucide-react";
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

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        if (innerRef.current?.contains(e.target as any)) return;
        onClose();
      }}
      className={cn(
        "fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm transition-opacity duration-300 flex items-center justify-center p-4",
        open ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"
      )}
    >
      <div
        ref={innerRef}
        className={cn(
          "relative z-[1200] max-h-[90vh] overflow-y-auto duration-200 rounded-2xl max-w-sm w-full bg-white dark:bg-neutral-900 shadow-2xl p-6 border border-gray-100 dark:border-gray-800"
        )}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-4 top-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-neutral-800 transition"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <Typography
          variant="title3"
          bold
          className="text-center mb-4 text-gray-900 dark:text-white"
        >
          {title}
        </Typography>
        {children}
      </div>
    </div>
  );
}
