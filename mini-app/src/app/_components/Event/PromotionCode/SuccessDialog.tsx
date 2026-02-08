"use client";

import { Dialog, DialogButton } from "konsta/react";

interface SuccessDialogProps {
  opened: boolean;
  onBackdropClick: () => void;
  onDone: () => void; // Called when user clicks "Done"
}

export default function SuccessDialog({ opened, onBackdropClick, onDone }: SuccessDialogProps) {
  return (
    <Dialog
      opened={opened}
      onBackdropClick={onBackdropClick}
      title="Promotion Created"
      content={<p className="text-center text-sm text-gray-700 mb-4">Your coupons have been successfully created!</p>}
      buttons={
        <div className="flex justify-end w-full bg-white">
          <DialogButton
            className="w-full text-sm"
            onClick={(e) => {
              e.preventDefault();
              onDone();
            }}
          >
            Done
          </DialogButton>
        </div>
      }
    />
  );
}
