/* RaffleMerchUiPage – public participant view for merch raffles */
"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { SplitFlap, Presets } from "react-split-flap";
import { Block, BlockTitle, List, ListInput, ListItem, Preloader } from "konsta/react";
import Image from "next/image";
import { FiUser } from "react-icons/fi";
import { toast } from "sonner";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { trpc } from "@/app/_trpc/client";
import Images from "@/app/_components/atoms/images";
import Typography from "@/components/Typography";
import Divider from "@/components/Divider";
import MainButton from "@/app/_components/atoms/buttons/web-app/MainButton";
import ListLayout from "@/app/_components/atoms/cards/ListLayout";

/* ╭──────────────── helpers ─────────────────╮ */
const random6 = () =>
  Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
const truncate = (s = "", m = 18) => (s.length <= m ? s : `${s.slice(0, m - 1)}…`);
const nameOf = (u: any) => u.username ?? ([u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.user_id);

/* ╭──────────────── memo bits ─────────────────╮ */
const EventImage = memo(({ url }: { url: string }) => (
  <Images.Event
    width={300}
    height={300}
    url={url}
  />
));
const EventTitle = memo(({ title }: { title: string }) => (
  <Typography
    variant="title2"
    weight="bold"
  >
    {title}
  </Typography>
));
const ScoreDisplay = memo(({ value }: { value: string }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number>();
  useLayoutEffect(() => {
    if (!h && wrap.current) setH(wrap.current.getBoundingClientRect().height);
  }, [h]);
  return (
    <div style={{ height: h, overflow: "hidden", display: "flex", justifyContent: "center" }}>
      <div ref={wrap}>
        <SplitFlap
          value={value}
          length={6}
          chars={Presets.NUM}
          size="large"
          hinge
        />
      </div>
    </div>
  );
});
ScoreDisplay.displayName = "ScoreDisplay";

const SpinBtn = ({ show, busy, onClick }: { show: boolean; busy: boolean; onClick: () => void }) =>
  show ? (
    <MainButton
      text="Spin"
      progress={busy}
      onClick={onClick}
    />
  ) : null;

/* ╭──────────────── shipping schema ─────────────────╮ */
const shipSchema = z.object({
  full_name: z.string().min(3, "Required"),
  shipping_address: z.string().min(10, "Required"),
  zip_code: z.string().min(3, "Required").max(16, "Too long"),
  phone: z.string().min(6, "Required"),
});
type ShipVals = z.infer<typeof shipSchema>;

/* ╭──────────────── ShippingForm component ─────────────────╮ */
/* ───────── ShippingForm component ───────── */
function ShippingForm({
  defaultVals,
  prizeId,
  mutate,
  isLoading,
}: {
  defaultVals: Partial<ShipVals>;
  prizeId: number;
  mutate: (data: ShipVals & { merch_prize_id: number }) => Promise<any>;
  isLoading: boolean;
}) {
  /* form ref so we can trigger native submit */
  const formRef = useRef<HTMLFormElement>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset, // ← to reset after success if you want
  } = useForm<ShipVals>({
    resolver: zodResolver(shipSchema),
    shouldFocusError: false,
    defaultValues: {
      full_name: defaultVals.full_name ?? "",
      shipping_address: defaultVals.shipping_address ?? "",
      zip_code: (defaultVals as any).zip_code ?? "",
      phone: defaultVals.phone ?? "",
    },
  });

  const btnLabel =
    defaultVals.full_name || defaultVals.shipping_address || defaultVals.phone ? "Update details" : "Send details";

  return (
    <form
      ref={formRef}
      className="pt-2"
      onSubmit={handleSubmit((vals) =>
        toast.promise(
          mutate({ merch_prize_id: prizeId, ...vals }).then(() => {
            /* optional: keep what user typed or clear the form */
            // reset(vals);          // keep
            // reset();             // clear
          }),
          { loading: "Saving…", success: "Submitted!", error: (e) => e?.message ?? "Error" }
        )
      )}
    >
      <BlockTitle className="!mt-0">Shipping details</BlockTitle>
      <List>
        <Controller
          control={control}
          name="full_name"
          render={({ field }) => (
            <ListInput
              {...field}
              label="Full name"
              outline
              autoComplete="name"
              autoCapitalize="words"
              error={errors.full_name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="shipping_address"
          render={({ field }) => (
            <ListInput
              {...field}
              type="textarea"
              label="Address"
              outline
              inputClassName="min-h-24"
              autoComplete="street-address"
              error={errors.shipping_address?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="zip_code"
          render={({ field }) => (
            <ListInput
              {...field}
              label="ZIP / Postal code"
              outline
              autoComplete="postal-code"
              error={errors.zip_code?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <ListInput
              {...field}
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              outline
              error={errors.phone?.message}
            />
          )}
        />
      </List>

      {/* 🔑  call `requestSubmit()` so <form onSubmit> is triggered */}
      <MainButton
        text={btnLabel}
        progress={isLoading}
        onClick={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}

/* ╭──────────────── Page ─────────────────╮ */
export default function RaffleMerchUiPage() {
  /* params */
  const { hash: eventUuid, "merch-raffle-uuid": merchUuid } = useParams<{ hash: string; "merch-raffle-uuid": string }>();
  if (!eventUuid || !merchUuid) return <p className="mt-10 text-center text-red-500">Bad URL</p>;

  /* queries & mutations */
  const eventQ = trpc.events.getEvent.useQuery({ event_uuid: eventUuid });
  const merchQ = trpc.raffle.listMerchPrizes.useQuery({ merch_raffle_uuid: merchUuid });
  const spinMut = trpc.raffle.spinMerch.useMutation();
  const shipMut = trpc.raffle.submitShippingInfo.useMutation({
    onSuccess: () => merchQ.refetch(),
  });

  /* split-flap state */
  const [score, setScore] = useState("000000");
  const [rolling, setRolling] = useState(false);
  const finalScore = useRef("000000");

  /* tick */
  useEffect(() => {
    const id = setInterval(() => rolling && setScore(random6()), 100);
    return () => clearInterval(id);
  }, [rolling]);

  /* restore score */
  useEffect(() => {
    const s = merchQ.data?.prizes.find((p) => p?.my)?.my?.score;
    if (s !== undefined) {
      finalScore.current = s.toString().padStart(6, "0");
      setScore(finalScore.current);
    }
  }, [merchQ.data]);

  /* derive */
  const prizes = (merchQ.data?.prizes ?? []) as {
    prize: { status: string; merch_prize_id: number; item_name: string; top_n: number; fulfil_method: "ship" | "pickup" };
    winners: any[];
    my?: {
      rank: number | null;
      score: number;
      status: string | null;
      full_name?: string | null;
      shipping_address?: string | null;
      zip_code?: string | null;
      phone?: string | null;
    };
  }[];

  const alreadySpun = prizes.some((p) => p.my);
  const openExists = prizes.some((p) => p.prize.status !== "completed");
  const showSpinBtn = !alreadySpun && openExists && !spinMut.isLoading;

  /* spin */
  const spin = useCallback(() => {
    setRolling(true);
    toast.promise(spinMut.mutateAsync({ merch_raffle_uuid: merchUuid }), {
      loading: "Spinning…",
      success: ({ score }) => {
        finalScore.current = score.toString().padStart(6, "0");
        const delays = [120, 170, 260, 400, 650];
        let i = 0;
        const slow = () => {
          setScore(random6());
          if (i < delays.length) setTimeout(slow, delays[i++]);
          else {
            setRolling(false);
            setScore(finalScore.current);
            merchQ.refetch();
          }
        };
        slow();
        return `Your score: ${score}`;
      },
      error: (e) => {
        setRolling(false);
        return e?.message ?? "Spin failed";
      },
    });
  }, [merchUuid, spinMut, merchQ]);

  /* loading guards */
  if (eventQ.isLoading || merchQ.isLoading)
    return (
      <div className="flex justify-center pt-20">
        <Preloader />
      </div>
    );
  if (eventQ.error) return <p>{eventQ.error.message}</p>;
  if (merchQ.error) {
    const code = (merchQ.error as any)?.data?.code;
    const isForbidden = code === "FORBIDDEN";
    if (isForbidden) {
      return (
        <div className="bg-[#EFEFF4] min-h-screen px-4 pb-24">
          <Block strong className="bg-gray-50 border border-gray-200 text-gray-800 p-4 rounded-lg mt-6">
            <p className="font-semibold">Registration required</p>
            <p className="text-sm mt-1 text-gray-600">
              This raffle is available only to approved registrants. Please register for the event and wait for approval.
            </p>
          </Block>
        </div>
      );
    }
    return <p>{merchQ.error.message}</p>;
  }

  const event = eventQ.data;

  /* render */
  return (
    <>
      <SpinBtn
        show={showSpinBtn}
        busy={spinMut.isLoading}
        onClick={spin}
      />

      <div className="bg-[#EFEFF4] min-h-screen px-4 pb-24">
        <EventImage url={event.image_url ?? ""} />
        <EventTitle title={event.title ?? ""} />
        <Divider margin="medium" />

        {/* score */}
        <Block
          strong
          className="bg-white rounded-lg p-4 mb-8 space-y-4"
        >
          <div className="flex justify-center">
            <ScoreDisplay value={score} />
          </div>
          <p className="text-center font-semibold text-lg">
            🎁 Merch raffle • one spin counts for <b>all</b> rewards
          </p>
        </Block>

        {/* prizes */}
        {prizes.map(({ prize, winners = [], my }) => {
          const isWinner = my && my.rank && my.rank <= prize.top_n;
          const needShip =
            isWinner && prize.fulfil_method === "ship" && (my?.status === "pending" || my?.status === "awaiting_address");

          return (
            <Block
              key={prize.merch_prize_id}
              strong
              className="bg-white rounded-lg p-4 mb-6 space-y-2"
            >
              {/* header */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{prize.item_name}</p>
                  <p className="text-xs text-gray-500">
                    Top&nbsp;{prize.top_n} · {prize.fulfil_method}
                  </p>
                </div>
                {my && (
                  <span className="bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg px-2 py-0.5">
                    {isWinner ? "WINNER" : my.rank ? `#${my.rank}` : "—"}
                  </span>
                )}
              </div>

              {/* winners list */}
              {prize.status === "completed" && winners.length > 0 && (
                <>
                  <BlockTitle className="mt-2">Winners</BlockTitle>
                  <List inset>
                    {winners.map((w) => (
                      <ListItem
                        key={w.rank ?? w.user_id}
                        className="py-1"
                        title={<span className="font-medium">#{w.rank}</span>}
                        after={w.status}
                        subtitle={
                          w.username ? (
                            <a
                              href={`https://t.me/${w.username}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-blue-600 truncate max-w-[150px]"
                            >
                              @{truncate(w.username)}
                            </a>
                          ) : (
                            <span className="truncate max-w-[150px]">{truncate(nameOf(w))}</span>
                          )
                        }
                        media={
                          w.photo_url ? (
                            <Image
                              src={w.photo_url}
                              width={28}
                              height={28}
                              alt=""
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <FiUser className="h-5 w-5 text-gray-400" />
                          )
                        }
                      />
                    ))}
                  </List>
                </>
              )}

              {/* shipping form */}
              {needShip && (
                <ShippingForm
                  prizeId={prize.merch_prize_id}
                  defaultVals={{
                    full_name: my?.full_name ?? "",
                    shipping_address: my?.shipping_address ?? "",
                    zip_code: my?.zip_code ?? "",
                    phone: my?.phone ?? "",
                  }}
                  mutate={(data) => shipMut.mutateAsync(data)}
                  isLoading={shipMut.isLoading}
                />
              )}
            </Block>
          );
        })}
      </div>
    </>
  );
}
