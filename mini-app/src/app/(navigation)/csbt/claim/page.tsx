"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/app/_trpc/client";
import { useTonAddress } from "@tonconnect/ui-react";
import Typography from "@/components/Typography";
import CsbtClaimCard from "@/components/csbt/CsbtClaimCard";
import Link from "next/link";

function CsbtClaimContent() {
  const searchParams = useSearchParams();
  const eventUuid = searchParams.get("eventUuid") || "4b287361-a06f-43dd-87c1-2d3a68f99fa7";

  const connectedWallet = useTonAddress();
  const fallbackWallet = "0:17b78ea2a1dc544a491b2ee49454b8880f4426588188b99836c6a32d13222297";
  const recipientWallet = connectedWallet || fallbackWallet;

  const { data: collectionData, isLoading } = trpc.sbt.getEventCollection.useQuery(
    { eventUuid },
    { enabled: Boolean(eventUuid) }
  );

  const collection = collectionData?.collection;

  return (
    <div className="min-h-screen bg-[#0C0D12] text-white p-4 pb-24 max-w-lg mx-auto flex flex-col justify-between">
      {/* Top Header */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Typography variant="title1" className="text-white font-extrabold tracking-tight">
              Claim Credential
            </Typography>
            <p className="text-xs text-gray-400 mt-1">
              Zero-Gas Merkle Soulbound Token (cSBT) Engine
            </p>
          </div>
          <Link
            href="https://dev.onton.live/csbt"
            target="_blank"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20"
          >
            How it works ↗
          </Link>
        </div>

        {/* Claim Card */}
        <CsbtClaimCard
          eventTitle={collection?.name || "MOMIS Memory Tournament #14 (Custom SBT Prize💎)"}
          eventUuid={eventUuid}
          recipientWallet={recipientWallet}
          badgeName="Soulbound Event Attendance & Achievement"
          badgeImageUrl={
            collection?.image || "https://storage.onton.live/onton/event/165823b2af_1762364484900_event_image.png"
          }
          merkleRootHex="a86e808fa028b492de337ebd64a9661d9326fb1781db2677ee7bcd2eb975fdac"
          proofStepsCount={4}
          isVerified={true}
        />
      </div>

      {/* Security & Architecture Explainer */}
      <div className="mt-8 rounded-2xl bg-white/[0.03] p-4 border border-white/5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
          <span>⚡</span>
          <span>Why is this claim zero-gas?</span>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Unlike standard TEP-85 tokens that deploy an independent smart contract for every attendee,
          ONTON State Compression anchors a cryptographic Merkle root on TON. Your credential is verified
          instantaneously via an inclusion proof without charging gas to your wallet.
        </p>
      </div>
    </div>
  );
}

export default function CsbtClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0C0D12] text-white p-6 flex items-center justify-center">Loading credential...</div>}>
      <CsbtClaimContent />
    </Suspense>
  );
}
