"use client";

import { Dialog, DialogButton } from "konsta/react";

interface ConfirmDialogProps {
  opened: boolean;
  isSubmitting?: boolean;
  onBackdropClick: () => void;
  onConfirm: () => void; // Called when user clicks "Save Changes"
  onBack: () => void; // Called when user clicks "Back to Editing"
}

export default function ConfirmDialog({
  opened,
  isSubmitting = false,
  onBackdropClick,
  onConfirm,
  onBack,
}: ConfirmDialogProps) {
  return (
    <Dialog
      opened={opened}
      onBackdropClick={onBackdropClick}
      title="Changing Active Time"
      content={
        <p className="text-center text-sm text-gray-700 mb-4">
          You are changing the time of activation... Users can only use codes between the start and end dates.
        </p>
      }
      buttons={
        <div className="flex justify-end w-full bg-white">
          <DialogButton
            className="w-1/2 text-sm"
            disabled={isSubmitting}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            Save Changes
          </DialogButton>
          <DialogButton
            className="w-1/2 text-sm"
            disabled={isSubmitting}
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
          >
            Back to Editing
          </DialogButton>
        </div>
      }
    />
  );
}
