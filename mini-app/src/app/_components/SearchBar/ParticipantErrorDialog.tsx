"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import React from "react";

interface ParticipantErrorDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ParticipantErrorDialog: React.FC<ParticipantErrorDialogProps> = ({ open, onClose, onConfirm }) => {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onClose}
    >
      <AlertDialogContent className="w-[80%] max-w-none border-none">
        <AlertDialogHeader>
          <AlertDialogTitle>Error</AlertDialogTitle>
          <AlertDialogDescription>
            You must select at least one participation type.
            <br />
            It will be set to default values.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/*<AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>*/}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirm();
            }}
          >
            Ok
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ParticipantErrorDialog;
