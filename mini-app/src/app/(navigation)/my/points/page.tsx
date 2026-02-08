// app/my/points/page.tsx  (rename path as needed)
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/app/_trpc/client";
import { useUserStore } from "@/context/store/user.store";

import TotalPointsBox from "./TotalPointsBox";
import EventPointsGroup from "./EventPointsGroup";
import EventPointsCard from "./EventPointsCard";
import ChevronDownIconAccord from "./ChevronDownIcon";

/* tiny helper */
const pts = (n: number | null | undefined) => (n ? `${n} Point${n === 1 ? "" : "s"}` : "Points");

export default function MyPointsPage() {
  const { user } = useUserStore();
  const [open, setOpen] = useState(true);

  /* ── queries that stay on the Points page ────────────────────────── */
  const totalPoints = trpc.usersScore.getTotalScoreByUserId.useQuery();
  const paidOnline = trpc.usersScore.getTotalScoreByActivityTypesAndUserId.useQuery({
    activityTypes: ["paid_online_event"],
    itemType: "event",
  });
  const freeOnline = trpc.usersScore.getTotalScoreByActivityTypesAndUserId.useQuery({
    activityTypes: ["free_online_event"],
    itemType: "event",
  });
  const paidOffline = trpc.usersScore.getTotalScoreByActivityTypesAndUserId.useQuery({
    activityTypes: ["paid_offline_event"],
    itemType: "event",
  });
  const freeOffline = trpc.usersScore.getTotalScoreByActivityTypesAndUserId.useQuery({
    activityTypes: ["free_offline_event"],
    itemType: "event",
  });

  const freeP2W = trpc.usersScore.getTotalScoreByActivityTypesAndUserId.useQuery({
    activityTypes: ["free_play2win"],
    itemType: "game",
  });
  const paidP2W = trpc.usersScore.getTotalScoreByActivityTypesAndUserId.useQuery({
    activityTypes: ["paid_play2win"],
    itemType: "game",
  });

  const organise = trpc.usersScore.getTotalScoreByActivityTypesAndUserId.useQuery({
    activityTypes: ["paid_online_event", "paid_offline_event", "free_online_event", "free_offline_event"],
    itemType: "organize_event",
  });

  const loading = [totalPoints, paidOnline, freeOnline, paidOffline, freeOffline, freeP2W, paidP2W, organise].some(
    (q) => q.isLoading
  );

  if (!user || loading) return null;

  return (
    <div className="flex flex-col gap-4 ">
      <TotalPointsBox totalPoints={totalPoints.data ?? 0} />

      <div className="rounded-md bg-white p-4">
        {/* header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Event Participation &amp; Games</h1>
          <button
            className="ml-2 text-gray-700"
            onClick={() => setOpen((p) => !p)}
          >
            <ChevronDownIconAccord isOpen={open} />
          </button>
        </div>
        <p className="mb-2 text-xs text-gray-500">Your point‑earning history</p>

        <div
          className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${open ? "max-h-[1200px]" : "max-h-0"}`}
        >
          {/* Online */}
          <EventPointsGroup title="Online Events">
            <Link
              href="/my/points/paid_online_event/details"
              className="w-full"
            >
              <EventPointsCard
                eventTitle="Attend paid online events"
                tasksCount={paidOnline.data?.count ?? 0}
                description={pts(10)}
                totalPoints={Number(paidOnline.data?.total ?? 0)}
                type="paid_online_event"
              />
            </Link>
            <Link
              href="/my/points/free_online_event/details"
              className="w-full"
            >
              <EventPointsCard
                eventTitle="Attend free online events"
                tasksCount={freeOnline.data?.count ?? 0}
                description={pts(1)}
                totalPoints={Number(freeOnline.data?.total ?? 0)}
                type="free_online_event"
              />
            </Link>
          </EventPointsGroup>

          {/* In‑person */}
          <EventPointsGroup title="In‑Person Events">
            <Link
              href="/my/points/paid_offline_event/details"
              className="w-full"
            >
              <EventPointsCard
                eventTitle="Attend paid in‑person events"
                tasksCount={paidOffline.data?.count ?? 0}
                description={pts(20)}
                totalPoints={Number(paidOffline.data?.total ?? 0)}
                type="paid_offline_event"
              />
            </Link>
            <Link
              href="/my/points/free_offline_event/details"
              className="w-full"
            >
              <EventPointsCard
                eventTitle="Attend free in‑person events"
                tasksCount={freeOffline.data?.count ?? 0}
                description={pts(10)}
                totalPoints={Number(freeOffline.data?.total ?? 0)}
                type="free_offline_event"
              />
            </Link>
          </EventPointsGroup>

          {/* Play‑to‑Win */}
          <EventPointsGroup title="Play‑to‑Win Games">
            <EventPointsCard
              eventTitle="Paid play‑to‑win games"
              tasksCount={paidP2W.data?.count ?? 0}
              description={pts(10)}
              totalPoints={Number(paidP2W.data?.total ?? 0)}
            />
            <EventPointsCard
              eventTitle="Free play‑to‑win games"
              tasksCount={freeP2W.data?.count ?? 0}
              description={pts(1)}
              totalPoints={Number(freeP2W.data?.total ?? 0)}
            />
          </EventPointsGroup>

          {/* Organise */}
          <EventPointsGroup title="Organise Events">
            <EventPointsCard
              eventTitle="Organise events"
              tasksCount={organise.data?.count ?? 0}
              description="0.2 × participation points × participant count"
              totalPoints={Number(organise.data?.total ?? 0)}
            />
          </EventPointsGroup>
        </div>
      </div>
    </div>
  );
}
