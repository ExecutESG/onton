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
            This Privacy Policy outlines how ONton (&quot;we&quot;, &quot;us&quot;,
            or &quot;our&quot;) collects, uses, and protects your personal
            information when you use our Telegram Mini App for event management on
            the TON ecosystem. We are committed to complying with the General Data
            Protection Regulation (GDPR) and other applicable European Union data
            protection laws.
          </p>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Information We Collect
          </Typography>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Personal Information:</strong> When you create an ONton
              account or register for an event, we may collect your name, email
              address, Telegram username, and TON wallet address.
            </li>
            <li>
              <strong>Event Information:</strong> We collect information related to
              events you create or participate in, such as event details,
              registration data, and attendance records.
            </li>
            <li>
              <strong>Usage Data:</strong> We collect information about how you
              interact with ONton, including your IP address, device information,
              and usage patterns.
            </li>
            <li>
              <strong>Cookies and Similar Technologies:</strong> We use cookies and
              similar technologies to enhance your experience and collect usage
              data.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            How We Use Your Information
          </Typography>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Provide and Improve Services:</strong> We use your information
              to create and manage events, process registrations and payments, send
              notifications, and improve our services.
            </li>
            <li>
              <strong>Communication:</strong> We may send you emails or Telegram
              messages related to events you&#39;ve created or registered for, or to
              provide updates about ONton.
            </li>
            <li>
              <strong>Analytics:</strong> We use data to analyze usage patterns,
              understand user behavior, and improve our platform.
            </li>
            <li>
              <strong>Legal Compliance:</strong> We may process your data to comply
              with legal obligations or respond to lawful requests.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Sharing Your Information
          </Typography>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Event Organizers:</strong> We share your information with
              event organizers when you register for their events. This may include
              your name, email address, and Telegram username.
            </li>
            <li>
              <strong>TON Society:</strong> We share your TON wallet address with
              TON Society for the purpose of minting SBTs (Soulbound Tokens) as
              proof of attendance at events.
            </li>
            <li>
              <strong>Third-Party Service Providers:</strong> We may share your
              information with third-party service providers who assist us in
              providing our services, such as payment processors or email marketing
              platforms.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose your information
              if required by law or to protect our rights or the rights of others.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Your Rights
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            Under the GDPR, you have the following rights:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-300">
            <li>
              <strong>Access:</strong> You have the right to request access to your
              personal data.
            </li>
            <li>
              <strong>Rectification:</strong> You have the right to request
              correction of inaccurate personal data.
            </li>
            <li>
              <strong>Erasure:</strong> You have the right to request erasure of
              your personal data under certain circumstances.
            </li>
            <li>
              <strong>Restriction of Processing:</strong> You have the right to
              request restriction of processing of your personal data under certain
              circumstances.
            </li>
            <li>
              <strong>Data Portability:</strong> You have the right to receive your
              personal data in a structured, commonly used, and machine-readable
              format.
            </li>
            <li>
              <strong>Object:</strong> You have the right to object to the
              processing of your personal data under certain circumstances.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Data Security
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            We implement appropriate technical and organizational measures to
            protect your personal data from unauthorized access, alteration,
            disclosure, or destruction.
          </p>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Data Retention
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            We retain your personal data for as long as necessary to fulfill the
            purposes outlined in this Privacy Policy, unless a longer retention
            period is required or permitted by law.
          </p>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Changes to this Privacy Policy
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            We may update this Privacy Policy from time to time. We will notify you
            of any changes by posting the new Privacy Policy on the ONton platform.
          </p>
        </section>

        <section className="space-y-1.5">
          <Typography variant="title3" bold className="text-gray-900 dark:text-gray-100">
            Contact Us
          </Typography>
          <p className="text-gray-600 dark:text-gray-300">
            If you have any questions or concerns about this Privacy Policy or our
            data practices, please contact us at{" "}
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
