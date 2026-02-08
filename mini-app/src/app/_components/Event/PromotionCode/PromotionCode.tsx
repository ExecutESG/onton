"use client";

import { Block } from "konsta/react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Download } from "lucide-react";

import { trpc } from "@/app/_trpc/client";
import { useGetEvent } from "@/hooks/events.hooks";
import { useDownloadCSV } from "@/app/_components/Event/PromotionCode/useDownloadCSV";
import useWebApp from "@/hooks/useWebApp";

import NavigationButtons from "@/components/NavigationButtons";
import MainButton from "../../atoms/buttons/web-app/MainButton";
import ActionCardWithMenu from "./ActionCardWithMenu";
import CreatePromotionForm from "./CreatePromotionForm";
import EditPromotionDatesForm from "./EditPromotionDatesForm";
import promotionCodeNoResult from "./promotion-code-no-result.svg";

/* ------------------------------------------------------------------ */
/* Shape returned from the server (adjust if your API returns strings) */
/* ------------------------------------------------------------------ */
interface Definition {
  id: number;
  count: number;
  value: number;
  used: number;
  start_date: Date;
  end_date: Date;
  cpd_status: "active" | "inactive" | "expired";
}

export default function PromotionCode() {
  /* ────────────────────────────────────────────────
     1) Router & Telegram Web-App hooks
  ──────────────────────────────────────────────── */
  const { hash } = useParams() as { hash?: string };
  const webApp = useWebApp();
  useEffect(() => () => webApp?.BackButton.hide(), [webApp]);

  /* ────────────────────────────────────────────────
     2) Event details (always called)
  ──────────────────────────────────────────────── */
  const { data: eventData, isLoading: eventLoading, isError: eventError } = useGetEvent(hash);
  const eventUuid = eventData?.event_uuid ?? "";

  /* ────────────────────────────────────────────────
     3) Coupon definitions query (always called)
        Network fire is gated via `enabled`
  ──────────────────────────────────────────────── */
  const defsQuery = trpc.coupon.getCouponDefinitions.useQuery({ event_uuid: eventUuid }, { enabled: !!eventUuid });
  const { data, isLoading, isError, error, refetch } = defsQuery;

  /* ────────────────────────────────────────────────
     4) CSV helper hook (always called)
  ──────────────────────────────────────────────── */
  const { isCSVLoading, handleDownloadCSV } = useDownloadCSV();

  /* ────────────────────────────────────────────────
     5) Local UI state (always called)
  ──────────────────────────────────────────────── */
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDef, setEditingDef] = useState<Definition | null>(null);

  /* ────────────────────────────────────────────────
     6) Status-toggle mutation (always called)
  ──────────────────────────────────────────────── */
  const updateStatusMutation = trpc.coupon.updateCouponDefinitionStatus.useMutation({
    onSuccess: () => refetch(),
  });

  /* ────────────────────────────────────────────────
     7) Early-return blocks — AFTER every hook call
  ──────────────────────────────────────────────── */
  if (eventError) return <div>Something went wrong.</div>;
  if (eventLoading || !eventUuid) return <div>Loading…</div>;

  /* Show create form */
  if (showCreateForm)
    return (
      <CreatePromotionForm
        eventUuid={eventUuid}
        onDone={() => {
          setShowCreateForm(false);
          refetch();
        }}
      />
    );

  /* Show edit-dates form */
  if (editingDef)
    return (
      <EditPromotionDatesForm
        id={editingDef.id}
        eventUuid={eventUuid}
        initialCount={editingDef.count}
        initialValue={editingDef.value}
        initialStartDate={editingDef.start_date}
        initialEndDate={editingDef.end_date}
        onDone={() => {
          setEditingDef(null);
          refetch();
        }}
      />
    );

  /* List-level loading / error / empty */
  if (isLoading)
    return (
      <>
        <h1 className="px-4 text-lg font-bold">Create Your Codes</h1>
        <Block className="text-center mt-4">Loading promotion codes…</Block>
      </>
    );

  if (isError)
    return (
      <>
        <h1 className="px-4 text-lg font-bold">Create Your Codes</h1>
        <Block className="text-center mt-4 text-red-600">Failed to load codes: {error.message}</Block>
      </>
    );

  if (!data || data.length === 0)
    return (
      <div>
        <h1 className="px-4 text-lg font-bold">Create Your Codes</h1>
        <Block className="flex flex-col items-center mt-8">
          <Image
            src={promotionCodeNoResult}
            width={48}
            height={48}
            alt=""
            className="mb-4"
          />
          <p className="font-bold text-lg">No discount code generated!</p>
          <p className="text-gray-500 text-sm mt-2 text-center max-w-[300px]">
            You can generate one-time discount codes and share them with your audience so they can benefit from discounts
            when purchasing this event’s tickets.
          </p>
        </Block>

        <NavigationButtons actions={[{ label: "Create Promotion", onClick: () => setShowCreateForm(true) }]} />
      </div>
    );

  /* ────────────────────────────────────────────────
     8) Render list of definitions
  ──────────────────────────────────────────────── */
  return (
    <>
      <div className="space-y-2">
        {data.map((def) => {
          const footerTexts = [
            { count: def.count, value: "codes" },
            { count: def.used, value: "used" },
          ];

          const statusMenuItem =
            def.cpd_status === "active"
              ? {
                  label: updateStatusMutation.isLoading ? "Deactivating…" : "Deactivate",
                  disabled: updateStatusMutation.isLoading,
                  onClick: () =>
                    updateStatusMutation.mutate({
                      id: def.id,
                      event_uuid: eventUuid,
                      status: "inactive",
                    }),
                }
              : def.cpd_status === "inactive"
                ? {
                    label: updateStatusMutation.isLoading ? "Activating…" : "Activate",
                    disabled: updateStatusMutation.isLoading,
                    onClick: () =>
                      updateStatusMutation.mutate({
                        id: def.id,
                        event_uuid: eventUuid,
                        status: "active",
                      }),
                  }
                : null; // expired ➜ no toggle

          const menuItems = [
            {
              label: isCSVLoading ? "Loading CSV file…" : "Get list and statistics",
              icon: <Download className="w-4 h-4" />,
              disabled: isCSVLoading,
              onClick: () => !isCSVLoading && handleDownloadCSV(def.id, eventUuid),
            },
            {
              label: "Edit Dates",
              onClick: () =>
                setEditingDef({
                  ...def,
                  start_date: new Date(def.start_date),
                  end_date: new Date(def.end_date),
                }),
            },
            ...(statusMenuItem ? [statusMenuItem] : []),
            {
              label: "Delete",
              color: "text-red-500",
              onClick: () => {
                /* TODO: delete mutation */
              },
            },
          ];

          return (
            <ActionCardWithMenu
              key={def.id}
              title={`${def.count} codes`}
              subtitle={`%${Number(def.value)} discount • ${def.used} used`}
              footerTexts={footerTexts}
              menuItems={menuItems}
              onCardClick={() => console.log("Card clicked", def.id)}
            />
          );
        })}
      </div>

      {eventData.isNotEnded && (
        <MainButton
          text="Create Promotion"
          onClick={() => setShowCreateForm(true)}
        />
      )}
    </>
  );
}
