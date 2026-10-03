"use client";

import React, { useState } from "react";
import OntonDialog from "@/components/OntonDialog";
import Typography from "@/components/Typography";
import { trpc } from "@/app/_trpc/client";
import { Flag, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ReportEventButtonProps {
  eventUuid: string;
  eventTitle: string;
}

type ReportReason = "phishing" | "impersonation" | "inappropriate" | "spam" | "other";

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: "phishing",
    label: "Phishing / Scam / Malicious Link",
    description: "Fake token airdrops, seed phrase drainers, or malicious sites",
  },
  {
    value: "impersonation",
    label: "Impersonation / Fake Event",
    description: "Pretending to be a brand, speaker, or recognized organizer",
  },
  {
    value: "inappropriate",
    label: "Inappropriate / Harassment",
    description: "Hate speech, illicit material, or community guideline violation",
  },
  {
    value: "spam",
    label: "Spam / Duplicate",
    description: "Automated junk, repeated event listings, or unsolicited ads",
  },
  {
    value: "other",
    label: "Other Safety Concern",
    description: "Other trust & safety violation requiring moderator review",
  },
];

export const ReportEventButton: React.FC<ReportEventButtonProps> = ({ eventUuid, eventTitle }) => {
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason>("phishing");
  const [notes, setNotes] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const reportMutation = trpc.events.reportEvent.useMutation({
    onSuccess: () => {
      setIsSuccess(true);
      setErrorMessage("");
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to submit report. Please try again.");
    },
  });

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSuccess(false);
    setErrorMessage("");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setNotes("");
    setIsSuccess(false);
    setErrorMessage("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    reportMutation.mutate({
      event_uuid: eventUuid,
      reason: selectedReason,
      notes: notes.trim(),
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        type="button"
        aria-label="Report event"
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 transition-colors py-1 px-2 rounded-lg hover:bg-red-50/50 dark:hover:bg-red-950/20"
      >
        <Flag className="w-3.5 h-3.5" />
        <span>Report Event</span>
      </button>

      <OntonDialog open={open} onClose={handleClose} title="Report Event">
        {isSuccess ? (
          <div className="flex flex-col items-center text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <Typography variant="body" weight="medium" className="text-gray-900 dark:text-gray-100">
              Report Submitted
            </Typography>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
              Thank you for protecting the community. Our trust & safety team has received your report and is reviewing this event.
            </p>
            <button
              onClick={handleClose}
              type="button"
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium text-sm hover:opacity-90 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Flagging: <span className="font-semibold text-gray-700 dark:text-gray-200">"{eventTitle}"</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all ${
                    selectedReason === r.value
                      ? "border-red-500 bg-red-50/40 dark:bg-red-950/30 dark:border-red-500/80"
                      : "border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="reportReason"
                      value={r.value}
                      checked={selectedReason === r.value}
                      onChange={() => setSelectedReason(r.value)}
                      className="text-red-500 focus:ring-red-400 h-3.5 w-3.5"
                    />
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {r.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 ml-5">
                    {r.description}
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <label htmlFor="report-notes" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Additional Notes (Optional)
              </label>
              <textarea
                id="report-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                placeholder="Describe why this event violates platform guidelines..."
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-red-500"
              />
            </div>

            {errorMessage && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-1/2 py-2.5 px-3 rounded-xl border border-gray-200 dark:border-neutral-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportMutation.isLoading}
                className="w-1/2 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition disabled:opacity-50"
              >
                {reportMutation.isLoading ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </OntonDialog>
    </>
  );
};

export default ReportEventButton;
