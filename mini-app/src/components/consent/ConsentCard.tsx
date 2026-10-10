"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/app/_trpc/client";
import { toast } from "sonner";
import { ShieldCheck, ExternalLink, Users, BarChart3, Key, Loader2 } from "lucide-react";
import Typography from "@/components/Typography";
import { ConsentPurpose } from "@/db/modules/userConsents.db";

interface PurposeConfig {
  purpose: ConsentPurpose;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const PURPOSES: PurposeConfig[] = [
  {
    purpose: "audience_reach",
    title: "Audience Reach & Discovery",
    description:
      "Allow event organizers to include your attendance profile in anonymized community discovery and recommend relevant upcoming events.",
    icon: <Users className="w-4 h-4 text-blue-500" />,
  },
  {
    purpose: "sponsor_stats",
    title: "Sponsor Analytics",
    description:
      "Include your attendance in aggregated, privacy-preserving event statistics shared with verified sponsors and partners.",
    icon: <BarChart3 className="w-4 h-4 text-purple-500" />,
  },
  {
    purpose: "attendance_verification_api",
    title: "Attendance Verification API",
    description:
      "Allow third-party applications to cryptographically verify your event attendance and credentials via public API.",
    icon: <Key className="w-4 h-4 text-emerald-500" />,
  },
];

interface ConsentCardProps {
  className?: string;
}

export default function ConsentCard({ className = "" }: ConsentCardProps) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.consents.getMine.useQuery();
  const [updatingPurpose, setUpdatingPurpose] = useState<string | null>(null);

  const grantMutation = trpc.consents.grant.useMutation({
    onSuccess: () => {
      utils.consents.getMine.invalidate();
    },
  });

  const revokeMutation = trpc.consents.revoke.useMutation({
    onSuccess: () => {
      utils.consents.getMine.invalidate();
    },
  });

  const handleToggle = async (purpose: ConsentPurpose, currentStatus: boolean) => {
    setUpdatingPurpose(purpose);
    try {
      if (currentStatus) {
        // Currently granted -> Revoke
        await revokeMutation.mutateAsync({ purpose });
        toast.success("Consent revoked immediately");
      } else {
        // Currently not granted -> Grant
        await grantMutation.mutateAsync({ purposes: [purpose] });
        toast.success("Consent granted");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update consent preference");
    } finally {
      setUpdatingPurpose(null);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-gray-100 dark:border-neutral-800 shadow-sm flex flex-col gap-3.5 ${className}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
              Data & Privacy Consents
            </Typography>
            <Typography variant="subheadline2" className="text-gray-500 dark:text-gray-400 text-xs">
              GDPR explicit opt-ins · Revocable anytime
            </Typography>
          </div>
        </div>
      </div>

      <Typography variant="subheadline1" className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        Choose how your attendance data may be used. Each purpose is completely optional, unbundled, and never pre-selected.
      </Typography>

      {/* Purpose Toggles List */}
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-neutral-800">
        {PURPOSES.map((p) => {
          const isChecked = Boolean(data?.consents?.[p.purpose]);
          const isPending = updatingPurpose === p.purpose || isLoading;

          return (
            <div key={p.purpose} className="py-3 flex items-start justify-between gap-3 first:pt-1 last:pb-1">
              <div className="flex items-start gap-2.5 flex-1 pr-2">
                <div className="mt-0.5">{p.icon}</div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {p.title}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                    {p.description}
                  </span>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isChecked}
                disabled={isPending}
                onClick={() => handleToggle(p.purpose, isChecked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isChecked ? "bg-blue-600" : "bg-gray-200 dark:bg-neutral-700"
                } ${isPending ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span className="sr-only">{p.title}</span>
                <span
                  className={`pointer-events-none inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isChecked ? "translate-x-5" : "translate-x-0"
                  }`}
                >
                  {isPending && updatingPurpose === p.purpose && (
                    <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer & Policy Link */}
      <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>Policy v{data?.policyVersion || "2024-09-11"}</span>
        <Link
          href="/privacy"
          prefetch={false}
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
        >
          <span>Privacy Policy</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
