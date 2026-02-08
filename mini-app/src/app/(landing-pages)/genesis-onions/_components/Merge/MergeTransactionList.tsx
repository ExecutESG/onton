"use client";

import { useUserMergeTransactionsPoll } from "@/app/(navigation)/sample/useUserMergeTransactionsPoll";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useTonWallet } from "@tonconnect/ui-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import Confetti from "react-confetti";
import { FaCheckCircle } from "react-icons/fa";
import { COLORS, getImageUrl, mergeTransactionPendingStatuses } from "./constants";

/**
 * Renders the list of merge transactions.
 * - Pending/processing: shows “sending…” overlay.
 * - Success: overlays green check, centers badges, fades down, then removes.
 * - No merges: falls back to just rendering the color badges.
 */
export function MergeTransactionsList(props: { setHasPendingTrx: (pending: boolean | null) => void }) {
  const [openDialog, setOpenDialog] = useState(false);

  const queryClient = useQueryClient();
  const walletAddress = useTonWallet();
  const { merges } = useUserMergeTransactionsPoll(walletAddress?.account.address as string);

  // store previous statuses
  const prevStatuses = useRef<Record<string, string | null>>({});

  // run on every merges update
  useEffect(() => {
    merges.forEach((m) => {
      const prev = prevStatuses.current[m.id];
      if (prev && prev !== m.status) {
        onMergeStatusChange(m.id, prev, m.status);
      }
      prevStatuses.current[m.id] = m.status;
    });

    const hasPending = merges.some((v) => mergeTransactionPendingStatuses.includes(v.status));

    queryClient.invalidateQueries({
      queryKey: ["campaign.getWalletInfo", { walletAddress: walletAddress?.account.address as string }],
    });
    props.setHasPendingTrx(hasPending);
  }, [merges]);

  const onMergeStatusChange = (id: number, oldStatus: string, newStatus: string | null) => {
    console.log(`merge ${id}: ${oldStatus} → ${newStatus}`);

    if (newStatus === "completed") {
      setOpenDialog(true);
    }
  };

  const processingCount = merges.filter((v) => mergeTransactionPendingStatuses.includes(v.status)).length;

  // If there are active merges, render them
  if (processingCount > 0) {
    return (
      <>
        <Dialog
          open={openDialog}
          onOpenChange={setOpenDialog}
        >
          <DialogContent
            hideClose
            className="border-none outline-none text-white p-10 flex-col flex gap-5"
          >
            <Confetti
              width={window.innerWidth - 20}
              numberOfPieces={100}
              className="place-self-center z-[1000] absolute top-0"
            />
            <div className="mx-auto text-center">
              <Typography variant="title2">🎉 Congratulations!</Typography>
              <Typography
                variant="subheadline1"
                weight="medium"
              >
                You created a Platinum from scratch!
              </Typography>
            </div>
            <Image
              src={getImageUrl("Platinum")}
              width={324}
              height={324}
              alt="square"
              className="mx-auto"
            />
            <Button
              type="button"
              size="lg"
              className="w-full btn-gradient btn-shine md:w-96 px-8 py-3 rounded-lg text-white font-semibold text-lg transition-all transform focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 hover:bg-orange hover:animate-none after:bottom-0 before:top-0 relative overflow-hidden isolate"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenDialog(false);
              }}
            >
              <Typography
                variant="headline"
                weight="semibold"
              >
                Keep Merging
              </Typography>
            </Button>
          </DialogContent>
        </Dialog>
        {processingCount ? (
          <div className="flex flex-col gap-4">
            {merges
              .filter((v) => ["processing", "pending"].includes(v.status ?? ""))
              .map((m) => (
                <div
                  key={m.id}
                  className={cn("flex items-center justify-center gap-2 transition-all")}
                >
                  {COLORS.map((color, idx) => (
                    <React.Fragment key={color}>
                      <div
                        key={color}
                        className="flex-1 border-2 border-dashed border-[#8E8E93] p-2 flex justify-center items-center bg-white/10 rounded-2lg relative gap-1"
                      >
                        <Image
                          src={getImageUrl(color)}
                          width={32}
                          height={32}
                          alt={`${color} NFT`}
                          className="rounded-2lg aspect-square"
                        />
                        {/* success overlay */}
                        {m.status === "completed" && <FaCheckCircle className="absolute top-0 right-0 text-green-320" />}
                        {/* sending overlay */}
                        {(m.status === "pending" || m.status === "processing") && (
                          <div className="flex flex-col items-center justify-cente rrounded-2lg">
                            <p className="text-xs font-semibold leading-[18px] text-center capitalize">{color}</p>
                            <span className="text-[8px] text-white">sending...</span>
                          </div>
                        )}
                      </div>
                      {idx < COLORS.length - 1 && <span className="text-white text-2xl font-semibold">+</span>}
                    </React.Fragment>
                  ))}
                </div>
              ))}
          </div>
        ) : null}
      </>
    );
  }

  // Fallback: no active merges — just render the color badges
  return (
    <div className="flex w-full items-center gap-2">
      <Dialog
        open={openDialog}
        onOpenChange={setOpenDialog}
      >
        <DialogContent
          hideClose
          className="border-none outline-none text-white p-10 flex-col flex gap-5"
        >
          <Confetti
            width={window.innerWidth - 20}
            numberOfPieces={100}
            className="place-self-center z-[1000] absolute top-0"
          />
          <div className="mx-auto text-center">
            <Typography variant="title2">🎉 Congratulations!</Typography>
            <Typography
              variant="subheadline1"
              weight="medium"
            >
              You created a Platinum from scratch!
            </Typography>
          </div>
          <Image
            src={getImageUrl("Platinum")}
            width={324}
            height={324}
            alt="square"
            className="mx-auto"
          />
          <Button
            type="button"
            size="lg"
            className="w-full btn-gradient btn-shine md:w-96 px-8 py-3 rounded-lg text-white font-semibold text-lg transition-all transform focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 hover:bg-orange hover:animate-none after:bottom-0 before:top-0 relative overflow-hidden isolate"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpenDialog(false);
            }}
          >
            <Typography
              variant="headline"
              weight="semibold"
            >
              Keep Merging
            </Typography>
          </Button>
        </DialogContent>
      </Dialog>
      {COLORS.map((color, idx) => (
        <React.Fragment key={color}>
          <div className="flex-1 border-2 border-dashed border-[#8E8E93] p-2 flex justify-center items-center bg-white/10 rounded-2lg gap-1">
            <Image
              width={32}
              height={32}
              src={getImageUrl(color)}
              alt={color}
              className="rounded-2lg aspect-square"
            />
            <p className="text-xs font-semibold leading-[18px] text-center capitalize">{color}</p>
          </div>
          {idx < COLORS.length - 1 && <span className="text-white text-2xl font-semibold">+</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
