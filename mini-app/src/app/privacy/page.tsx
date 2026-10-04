"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import Typography from "@/components/Typography";
import { CURRENT_PRIVACY_POLICY_VERSION } from "@/constants";

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="bg-brand-bg min-h-screen p-4 flex flex-col gap-4 max-w-xl mx-auto pb-24 text-gray-800 dark:text-gray-200">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2">
            <Typography variant="title2" bold>
              Privacy Policy
            </Typography>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              v{CURRENT_PRIVACY_POLICY_VERSION}
            </span>
          </div>
          <Typography variant="subheadline2" className="text-gray-500 dark:text-gray-400 text-xs">
            Effective Date: September 11, 2024 · GDPR Compliant
          </Typography>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-100 dark:border-neutral-800 shadow-sm space-y-4 text-xs leading-relaxed">
        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-500 inline" />
            <span>Introduction</span>
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            This Privacy Policy outlines how ONTON (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses,
            and protects your personal information when you use our platform for event management and verified attendance credentials.
            We are committed to complying with the General Data Protection Regulation (GDPR) and other applicable European Union data protection laws.
          </p>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Information We Collect
          </Typography>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Personal Information:</strong> When you create an ONTON account or register for an event, we may collect your name, email address, Telegram username, and optional wallet address.
            </li>
            <li>
              <strong>Event Information:</strong> Information related to events you create or participate in, such as event details, registration data, and cryptographic attendance records.
            </li>
            <li>
              <strong>Usage Data:</strong> Operational logs such as timestamps and interaction events required to maintain platform reliability.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            How We Use Your Information & Legal Basis
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            We process your personal information under GDPR Article 6(1)(b) (contractual necessity) to deliver event ticketing and check-in services,
            and under GDPR Article 6(1)(a) (explicit consent) for specific optional data uses:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Audience Reach & Discovery:</strong> With your explicit consent, allowing event organizers to recommend relevant upcoming events.
            </li>
            <li>
              <strong>Sponsor Analytics:</strong> With your explicit consent, aggregating attendance metrics in anonymized reports for sponsors.
            </li>
            <li>
              <strong>Attendance Verification API:</strong> With your explicit consent, enabling third-party verification of your attendance credentials.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Your GDPR Rights
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            Under GDPR, you have the right to access, rectify, or erase your data, the right to data portability, the right to restrict or object to processing,
            and the absolute right to revoke any granted consent at any time directly through your profile settings or My Badges page without affecting prior lawful processing.
          </p>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Contact Us
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            For privacy inquiries or to exercise your GDPR rights, contact us at:{" "}
            <a
              href="https://t.me/ONtonsupport"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              https://t.me/ONtonsupport
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
