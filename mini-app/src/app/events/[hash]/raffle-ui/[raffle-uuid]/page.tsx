/* RaffleUiPage.tsx – spin-button now appears in both waiting_funding & funded */
"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { SplitFlap, Presets } from "react-split-flap";
import { useTonAddress, useTonConnectModal, useTonConnectUI } from "@tonconnect/ui-react";
import { Address } from "@ton/core";
import { Block, BlockTitle, List, ListItem, ListInput, Preloader } from "konsta/react";
import Image from "next/image";
import { FiUser } from "react-icons/fi";
import { toast } from "sonner";

import Images from "@/app/_components/atoms/images";
import Typography from "@/components/Typography";
import Divider from "@/components/Divider";
import MainButton from "@/app/_components/atoms/buttons/web-app/MainButton";
import CustomButton from "@/app/_components/Button/CustomButton";
import { trpc } from "@/app/_trpc/client";
import { Trophy, Gift } from "lucide-react";

/* ───────── helpers ───────── */
const formatAmount = (value?: string | bigint | null, decimals = 9, digits = 3) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(num)) return "—";
  const factor = 10 ** decimals;
  return (num / factor).toFixed(digits);
};
const random6 = () =>
  Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
const truncate = (s: string, m = 18) => (s.length <= m ? s : `${s.slice(0, m - 1)}…`);
const bestName = (u: { username: string | null; first_name: string | null; last_name: string | null; user_id: number }) =>
  u.username ?? ([u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.user_id);
const toBounce = (raw: string) => Address.parse(raw).toString({ bounceable: true, urlSafe: true });
const isTestnet = !(/*NOT*/ ["production", "stage", "staging"].includes(process.env.NEXT_PUBLIC_ENV || "development"));
const txUrl = (h?: string | null) => (h ? `https://${isTestnet ? "testnet." : ""}tonviewer.com/transaction/${h}` : null);

/* ───────── small memo bits ───────── */
const EventImage = memo(({ url }: { url: string }) => (
  <Images.Event
    width={300}
    height={300}
    url={url}
  />
));

const EventTitle = memo(({ t }: { t: string }) => (
  <Typography
    variant="title2"
    weight="bold"
  >
    {t}
  </Typography>
));

/* fixed-height split-flap wrapper */
const ScoreDisplay = memo(({ value }: { value: string }) => {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (inner.current && h === null) setH(inner.current.getBoundingClientRect().height);
  }, [h]);

  return (
    <div style={{ height: h ?? "auto", overflow: "hidden", display: "flex", justifyContent: "center" }}>
      <div ref={inner}>
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

/* Telegram main-button wrapper */
const TGButton = memo(
  ({
    visible,
    label,
    busy,
    disabled,
    onClick,
  }: {
    visible: boolean;
    label: string;
    busy: boolean;
    disabled?: boolean;
    onClick: () => void;
  }) =>
    visible ? (
      <MainButton
        text={label}
        progress={busy}
        color={disabled ? "secondary" : "primary"}
        disabled={disabled}
        onClick={onClick}
      />
    ) : null
);
TGButton.displayName = "TGButton";

/* ───────── page component ───────── */
export default function RaffleUiPage() {
  /* params */
  const { hash: eventUuid, "raffle-uuid": raffleUuid } = useParams<{ hash: string; "raffle-uuid": string }>();
  if (!eventUuid || !raffleUuid) return <p className="text-center mt-10 text-red-500">Bad URL</p>;

  /* queries */
  const eventQ = trpc.events.getEvent.useQuery({ event_uuid: eventUuid });
  const viewQ = trpc.raffle.view.useQuery({ raffle_uuid: raffleUuid }, { refetchOnWindowFocus: false });
  const spinMut = trpc.raffle.spinTon.useMutation();

  /* wallet */
  const wallet = useTonAddress();
  const hasWallet = !!wallet;
  const modal = useTonConnectModal();
  const [tonConnectUI] = useTonConnectUI();

  /* split-flap state */
  const [score, setScore] = useState("000000");
  const [rolling, setRoll] = useState(false);
  const finalScore = useRef("000000");

  /* random loop */
  useEffect(() => {
    const id = setInterval(() => rolling && setScore(random6()), 100);
    return () => clearInterval(id);
  }, [rolling]);

  /* show stored score if user already spun */
  useEffect(() => {
    if (viewQ.data?.my?.score !== undefined) {
      finalScore.current = viewQ.data.my.score.toString().padStart(6, "0");
      setScore(finalScore.current);
    }
  }, [viewQ.data?.my?.score]);

  /* aliases */
  const raffle = viewQ.data?.raffle;
  const my = viewQ.data?.my;
  const winners = viewQ.data?.winners ?? [];
  const token = viewQ.data?.token;
  const tokenSymbol = token?.symbol ?? "TON";
  const tokenDecimals = token?.decimals ?? 9;

  /* wallet display */
  const rawAddr = my?.wallet_address || (hasWallet ? Address.parse(wallet).toRawString() : undefined);
  const walletB = rawAddr ? toBounce(rawAddr) : null;

  /* prize maths */
  const pool = BigInt(raffle?.prize_pool_nanoton ?? 0);
  const perPrize = BigInt(raffle?.top_n ?? 1) > BigInt(0) ? pool / BigInt(raffle?.top_n ?? 1) : BigInt(0);

  /* spin handler */
  const spin = useCallback(() => {
    if (!hasWallet) {
      modal.open();
      return;
    }

    setRoll(true); // start eye-candy immediately

    spinMut
      .mutateAsync({ raffle_uuid: raffleUuid, wallet_address: wallet })
      .then((res) => {
        finalScore.current = res.score.toString().padStart(6, "0");
        const p = [150, 200, 300, 450, 700];
        let i = 0;
        const tick = () => {
          setScore(random6());
          if (i < p.length) setTimeout(tick, p[i++]);
          else {
            setRoll(false);
            setScore(finalScore.current);
            viewQ.refetch();
          }
        };
        tick();
      })
      .catch(() => {
        setRoll(false);
        setScore("000000");
      });
  }, [hasWallet, modal, spinMut, raffleUuid, wallet, viewQ]);

  /* WHEN to show the button?
     – user hasn’t spun yet       ( !my )
     – raffle is either waiting_funding OR funded
     – request not in-flight      ( !spinMut.isLoading )
  */
  const canSpin = raffle && !my && ["waiting_funding", "funded"].includes(raffle.status);
  const btnVisible = canSpin && !spinMut.isLoading;
  const showMain = hasWallet && btnVisible; // Only show TG main button when wallet connected and can spin

  /* loading states */
  if (eventQ.isLoading || viewQ.isLoading)
    return (
      <div className="flex justify-center pt-20">
        <Preloader />
      </div>
    );
  if (eventQ.error) return <p>{eventQ.error.message}</p>;
  if (viewQ.error) {
    const code = (viewQ.error as any)?.data?.code;
    const isForbidden = code === "FORBIDDEN";
    if (isForbidden) {
      return (
        <div className="min-h-screen bg-[#EFEFF4] pb-24 px-4">
          <Block strong className="bg-gray-50 border border-gray-200 text-gray-800 p-4 rounded-lg mt-6">
            <p className="font-semibold">Registration required</p>
            <p className="text-sm mt-1 text-gray-600">
              This raffle is available only to approved registrants. Please register for the event and wait for approval.
            </p>
          </Block>
        </div>
      );
    }
    return <p>{viewQ.error.message}</p>;
  }

  const event = eventQ.data!;
  const eventNotStarted = event?.start_date ? Date.now() < Number(event.start_date) * 1000 : false;

  /* ───────── render ───────── */
  return (
    <>
      <TGButton visible={showMain ?? false} label="Spin" busy={spinMut.isLoading} disabled={eventNotStarted} onClick={spin} />

      <div className="min-h-screen bg-[#EFEFF4] pb-24 px-4">
        <EventImage url={event.image_url ?? ""} />
        {eventNotStarted && (
          <Block strong className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg mb-4">
            You can spin after the event starts.
          </Block>
        )}

        <Block strong className="bg-white p-4 rounded-lg space-y-4">
          <EventTitle t={event.title ?? ""} />
          <Divider margin="small" />
          <div className="flex justify-center">
            <ScoreDisplay value={score} />
          </div>

          {/* wallet text moved to bottom section */}

          {/* pool + reward info */}
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Typography variant="caption2" weight="semibold" className="uppercase tracking-wide text-gray-500 flex items-center gap-1 mb-1.5">
                <Trophy size={14} className="text-amber-600" /> Total pool
              </Typography>
              <Typography variant="headline" weight="bold" className="mt-1.5">
                {`${formatAmount(pool, tokenDecimals, 4)} ${tokenSymbol}`}
              </Typography>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Typography variant="caption2" weight="semibold" className="uppercase tracking-wide text-gray-500 flex items-center gap-1 mb-1.5">
                <Gift size={14} className="text-emerald-600" /> Top {raffle?.top_n}
              </Typography>
              <Typography variant="headline" weight="bold" className="mt-1.5">
                {`${formatAmount(perPrize, tokenDecimals, 4)} ${tokenSymbol} each`}
              </Typography>
            </div>
          </div>

          {my?.reward_nanoton && (
            <p className="text-green-600 font-semibold text-center">
              🎉 You received {`${formatAmount(my.reward_nanoton, tokenDecimals, 4)} ${tokenSymbol}`}!
            </p>
          )}

          {/* winners inside the same section */}
          {raffle?.status === "completed" && winners.length > 0 && (
            <>
              <BlockTitle className="mt-2">Winners</BlockTitle>
              <List inset>
                {winners.map((w: any) => (
                  <ListItem
                    key={w.rank}
                    className="py-1"
                    media={
                      w.photo_url ? (
                        <Image
                          src={w.photo_url}
                          width={32}
                          height={32}
                          alt=""
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <FiUser className="w-6 h-6 text-gray-400" />
                      )
                    }
                    title={<span className="font-medium">#{w.rank}</span>}
                    after={
                      <span className="flex items-center gap-2">
                        {w.reward_nanoton ? (
                          <span>{`${formatAmount(w.reward_nanoton, tokenDecimals, 4)} ${tokenSymbol}`}</span>
                        ) : (
                          <span>—</span>
                        )}
                        {w.tx_hash && w.tx_hash !== "toncenter-batch" && (
                          <a
                            href={txUrl(w.tx_hash) ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                            onClick={(e) => {
                              if (!txUrl(w.tx_hash)) e.preventDefault();
                            }}
                          >
                            TX
                          </a>
                        )}
                      </span>
                    }
                    subtitle={
                      w.username ? (
                        <a
                          href={`https://t.me/${w.username}`}
                          target="_blank"
                          className="text-blue-600 underline truncate max-w-[160px]"
                        >
                          @{truncate(w.username)}
                        </a>
                      ) : (
                        <span className="truncate max-w-[160px]">{truncate(bestName(w).toString())}</span>
                      )
                    }
                  />
                ))}
              </List>
            </>
          )}

          {/* wallet controls + address inside the same section */}
          <div className="space-y-2">
            {hasWallet && (
              <List inset className="!mx-0 !px-0 !mt-0 !mb-0">
                <ListInput
                  outline
                  readOnly
                  label="Wallet Address"
                  value={walletB ?? ""}
                  className="!mx-0"
                />
              </List>
            )}
            {!hasWallet && (
              <CustomButton className="justify-center" buttonClassName="w-full" onClick={() => modal.open()}>
                Connect wallet
              </CustomButton>
            )}
            {hasWallet && !my && (
              <CustomButton
                variant="secondary"
                className="justify-center"
                buttonClassName="w-full"
                onClick={() => tonConnectUI.disconnect()}
              >
                Disconnect wallet
              </CustomButton>
            )}
          </div>
        </Block>
      </div>
    </>
  );
}
