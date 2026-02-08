"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";
import { useSheetStackStore } from "@/zustand/sheet-stack.store";
import { Button, Sheet } from "konsta/react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

const Drawer = ({ shouldScaleBackground = false, ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    showCloseButton?: boolean; // New prop to control the display of the close button
  }
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-3xl bg-cn-background p-4",
        className
      )}
      {...props}
    >
      {/* Conditionally render the DrawerClose button */}
      {showCloseButton && (
        <DrawerClose asChild>
          <button className="ms-auto mr-2 flex items-center justify-center h-6 w-6 rounded-full bg-cn-muted">
            <X className="h-4 w-4" />
          </button>
        </DrawerClose>
      )}
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 pt-0 text-white text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-2 pt-6 pb-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-xl font-bold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-cn-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

interface KSheeProps {
  children?: React.ReactNode | ((_: boolean, __: (_: boolean) => void) => React.ReactNode);
  trigger?: React.ReactNode | ((_: boolean, __: (_: boolean) => void) => React.ReactNode);
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (_: boolean) => void;
  dontHandleMainButton?: boolean;
}

export const KSheet = (props: KSheeProps) => {
  const [open, setOpenState] = React.useState(false);
  // this state is used to check if we have made the main button hidden after showing the sheet
  const { openedOneSheet, closedOneSheet } = useSheetStackStore();

  const setOpen = (state: boolean) => {
    if (state && !open) {
      openedOneSheet();
      setOpenState(true);
    } else if (open) {
      closedOneSheet();
      setOpenState(false);
    }
  };

  React.useEffect(() => {
    typeof props.open === "boolean" && setOpen(props.open);
  }, [props.open]);

  React.useEffect(() => {
    return () => {
      closedOneSheet();
      setOpenState(false);
    };
  }, []);

  return (
    <>
      {!props.hideTrigger &&
        (typeof props.trigger === "function" ? (
          props.trigger(open, setOpen)
        ) : (
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }}
          >
            {props.trigger || "Open"}
          </Button>
        ))}
      {createPortal(
        <Sheet
          onBackdropClick={(e) => {
            e.preventDefault();
            props.onOpenChange?.(false);
            setOpen(false);
          }}
          className="w-full"
          opened={open}
        >
          {typeof props.children === "function" ? props.children(open, setOpen) : props.children}
        </Sheet>,
        document.body
      )}
    </>
  );
};

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
