import Typography from "@/components/Typography";
import useWebApp from "@/hooks/useWebApp";
import { cn } from "@/lib/utils";
import { Sheet } from "konsta/react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IoCloseCircleOutline } from "react-icons/io5";

interface ReusableSheetProps {
  title: React.ReactNode;
  opened: boolean;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  defaultPadding?: boolean;
  hideClose?: boolean;
  centerTitle?: boolean;
  hideTitle?: boolean;
}

const CustomSheet: React.FC<ReusableSheetProps> = ({
  title,
  opened,
  children,
  className,
  defaultPadding = true,
  hideClose = false,
  hideTitle = false,
  centerTitle = false,
  onClose,
}) => {
  const webApp = useWebApp();
  const [firstState, setsFirstState] = useState<null | boolean>(null);

  useEffect(() => {
    if (opened && firstState === null && webApp?.MainButton.isVisible !== undefined) {
      setsFirstState(webApp.MainButton.isVisible);
    }

    if (opened && firstState) {
      webApp?.MainButton.hide();
    }

    return () => {
      if (firstState) {
        webApp?.MainButton.show();
      }
    };
  }, [opened, firstState, webApp?.MainButton]);

  return createPortal(
    <Sheet
      opened={opened}
      className={cn("w-full rounded-t-2xl max-h-screen pb-[calc(var(--tg-safe-area-inset-bottom))]", className)}
      onBackdropClick={onClose}
    >
      <div
        className={cn("flex !mt-5 mx-4 justify-between items-center", {
          "justify-center": centerTitle,
          hidden: hideTitle && hideClose,
        })}
      >
        {!hideTitle && (
          <Typography
            variant="title3"
            weight="normal"
          >
            {title}
          </Typography>
        )}

        {!hideClose && (
          <button onClick={onClose}>
            <IoCloseCircleOutline className="text-2xl" />
          </button>
        )}
      </div>
      <div
        className={cn({
          "p-4": defaultPadding,
        })}
      >
        {children}
      </div>
    </Sheet>,
    document.getElementById("modals-sheet")!
  );
};
export default CustomSheet;
