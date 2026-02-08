"use client";

import { useState } from "react";
import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { InfoIcon, ArrowUp } from "lucide-react";
import { Progressbar } from "konsta/react";
import { InfoBox } from "@/app/(landing-pages)/genesis-onions/_components/InfoBox";
import { customToast } from "@/app/(landing-pages)/genesis-onions/GenesisOnions.utils";
import { usePartnershipAffiliate } from "./usePartnershipAffiliate";
import { KSheet } from "@/components/ui/drawer";
import MainButton from "@/app/_components/atoms/buttons/web-app/MainButton";

/* utils */
const tonViewer = (a: string) => `https://tonviewer.com/${a}`;
const tgLink = (u?: string | null) => (u ? `https://t.me/${u}` : null);

/* milestones */
const TARGETS = [
  { usdt: 200, reward: 12_000 },
  { usdt: 400, reward: 60_000 },
  { usdt: 800, reward: 200_000 },
];
const ARROW_COLORS = ["#16a34a", "#f59e0b", "#ef4444"]; // green, amber, red

export const ShareAndEarnPartnership = () => {
  const { data, isLoading, isError } = trpc.affiliate.getFairlaunchAffiliate.useQuery();
  const { inviteOnTelegram, isSharing } = usePartnershipAffiliate();

  /* drawer control for Telegram MainButton */
  const [drawerOpen, setDrawerOpen] = useState(false);

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      customToast.success("Link copied!");
    } catch {
      customToast.error("Copy failed.");
    }
  };

  if (isLoading) return null;
  if (isError) return <div className="text-center text-red-600">Failed to load affiliate link.</div>;

  /* backend numbers */
  const { onion: myOnion, usdt: myUsdt } = data.currentTotals;
  const { onionSold, totalCap, progressPct } = data.capInfo;
  const pctToMax = Math.min((myUsdt / TARGETS.at(-1)!.usdt) * 100, 100);

  /* links */
  const telegramLink = data.url;
  const webLink = `https://onton.live/onion-fair/?affiliate=${data.linkHash}`;

  return (
    <>
      {/* Telegram MainButton trigger */}
      <MainButton
        text="Get your affiliate link"
        color="primary"
        onClick={() => setDrawerOpen(true)}
        disabled={isSharing}
        progress={false}
      />

      {/* Drawer with link details */}
      <KSheet
        hideTrigger
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      >
        {() => (
          <div className="p-4 space-y-4">
            <Typography
              variant="headline"
              weight="semibold"
              className="text-center mb-2"
            >
              Share your link & earn
            </Typography>

            <LinkBlock
              title="Telegram Mini‑App link"
              link={telegramLink}
              onCopy={copy}
              button={
                <Button
                  size="lg"
                  className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  onClick={() => inviteOnTelegram(telegramLink)}
                  isLoading={isSharing}
                  disabled={isSharing}
                >
                  Invite on Telegram
                </Button>
              }
            />

            <LinkBlock
              title="Web link"
              link={webLink}
              onCopy={copy}
            />
          </div>
        )}
      </KSheet>

      {/* main content */}
      <div className="bg-white px-4 py-6 text-gray-900">
        <InfoBox className="flex flex-col items-center border bg-white rounded-xl shadow-sm w-full">
          {/* header */}
          <header className="flex flex-col gap-1 items-center mb-4">
            <Typography
              variant="headline"
              weight="semibold"
            >
              Onion Affiliate Program
            </Typography>
            <div className="flex gap-1 items-center text-gray-600">
              <InfoIcon size={16} />
              <Typography variant="subheadline2">Invite friends, earn ONIONs.</Typography>
            </div>
          </header>

          {/* stats */}
          <section className="flex gap-3 w-full mb-6">
            <StatCard
              value={myUsdt}
              label="Your USDT sales"
            />
            <StatCard
              value={myOnion}
              label="Your ONION reward"
            />
          </section>

          {/* milestone bar */}
          <MilestoneBar
            current={myUsdt}
            targets={TARGETS.map((t) => t.usdt)}
            pct={pctToMax}
          />

          {/* reward explainer */}
          <InfoBox className="w-full bg-blue-50 rounded-md p-3 mb-4">
            <Typography
              variant="caption2"
              className="text-gray-700"
            >
              Reach a milestone to unlock its reward – rewards are <b>not cumulative</b>; you get <b>only</b> the highest one
              you hit.
            </Typography>
            <ul className="list-disc list-inside text-xs mt-2 space-y-1">
              {TARGETS.map((t) => (
                <li key={t.usdt}>
                  {t.usdt.toLocaleString()} USDT → <b>{t.reward.toLocaleString()} ONION</b>
                </li>
              ))}
            </ul>
          </InfoBox>

          {/* hurry‑up note */}
          <InfoBox className="w-full bg-blue-50 rounded-md p-3 mb-4">
            <Typography
              variant="caption2"
              className="text-gray-700"
            >
              You’ve sold <b>{myUsdt.toFixed(2)} USDT</b>. Community total:&nbsp;
              <b>
                {onionSold.toFixed(2)} / {totalCap} ONION
              </b>
              . Share your link now to grab the remaining rewards!
            </Typography>
          </InfoBox>

          {/* global pool progress */}
          <PoolProgress
            sold={onionSold}
            cap={totalCap}
            progress={progressPct}
          />

          {/* purchases title */}
          <Typography
            variant="subheadline2"
            weight="medium"
            className="w-full mt-6 mb-3"
          >
            Users who bought via your link
          </Typography>

          {/* purchases list */}
          <PurchaseList purchases={data.purchases} />
        </InfoBox>
      </div>
    </>
  );
};

/* ---------- unchanged helpers below ---------- */

const StatCard = ({ value, label }: { value: number; label: string }) => (
  <InfoBox className="flex-1 bg-gray-50 rounded-md py-3 flex flex-col items-center">
    <Typography
      variant="title2"
      weight="bold"
    >
      {value.toFixed(2)}
    </Typography>
    <Typography
      variant="caption2"
      className="text-gray-600"
    >
      {label}
    </Typography>
  </InfoBox>
);

const MilestoneBar = ({ current, targets, pct }: { current: number; targets: number[]; pct: number }) => {
  const last = targets.at(-1)!;
  return (
    <div className="w-full mb-6 relative">
      <div className="h-2 rounded-lg bg-gray-200" />
      <div
        className="absolute top-0 left-0 h-2 bg-blue-600 rounded-lg"
        style={{ width: `${pct}%` }}
      />
      {targets.map((t, i) => (
        <div
          key={t}
          className="absolute flex flex-col items-center  px-4"
          style={{ left: `${(t / last) * 100}%`, transform: "translateX(-50%)" }}
        >
          <ArrowUp
            size={18}
            strokeWidth={3}
            color={ARROW_COLORS[i]}
            className="drop-shadow"
          />
          <span
            className="text-[10px] font-semibold"
            style={{ color: ARROW_COLORS[i] }}
          >
            {t.toLocaleString()}$
          </span>
        </div>
      ))}
      <br />
    </div>
  );
};

const PoolProgress = ({ sold, cap, progress }: { sold: number; cap: number; progress: number }) => {
  const p = progress > 1 ? progress / 100 : progress;
  return (
    <div className="w-full mb-6 px-1">
      <div className="flex justify-between mb-1 text-xs text-gray-500">
        <span>
          {sold.toFixed(2)} / {cap} ONION claimed
        </span>
        <span>{progress.toFixed(1)}%</span>
      </div>
      <Progressbar
        progress={p}
        className="h-2 rounded-lg bg-gray-200 [&_.k-progressbar-bg]:bg-blue-600"
      />
    </div>
  );
};

const LinkBlock = ({
  title,
  link,
  onCopy,
  button,
}: {
  title: string;
  link: string;
  onCopy: (link: string) => void;
  button?: React.ReactNode;
}) => (
  <div className="w-full">
    <Typography
      variant="subheadline2"
      weight="medium"
      className="mb-2"
    >
      {title}
    </Typography>
    <div className="flex items-center bg-gray-100 rounded-lg px-4 h-11 gap-2 mb-3">
      <input
        readOnly
        value={link}
        className="flex-1 bg-transparent outline-none text-gray-900 text-sm text-ellipsis overflow-hidden"
      />
      <button
        onClick={() => onCopy(link)}
        className="text-blue-600 font-medium"
      >
        Copy
      </button>
    </div>
    {button}
  </div>
);

const PurchaseList = ({ purchases }: { purchases: any[] }) =>
  purchases.length ? (
    <div className="w-full flex flex-col gap-3 ">
      {purchases.map((p) => (
        <InfoBox
          key={p.id}
          className="w-full bg-gray-50 rounded-lg p-3 flex flex-col gap-1"
        >
          <div className="flex justify-between items-center">
            <a
              href={tonViewer(p.walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              {p.walletAddress.slice(0, 6)}…{p.walletAddress.slice(-4)}
            </a>
            {p.telegramUserName ? (
              <a
                href={tgLink(p.telegramUserName)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                @{p.telegramUserName}
              </a>
            ) : (
              <Typography
                variant="caption2"
                className="text-gray-500"
              >
                Web User
              </Typography>
            )}
          </div>

          <div className="flex justify-between text-sm">
            <Typography variant="caption2">
              USDT&nbsp;<span className="font-medium">{Number(p.usdtAmount).toFixed(2)}</span>
            </Typography>
            <Typography variant="caption2">
              ONION&nbsp;<span className="font-medium">{Number(p.onionAmount).toFixed(2)}</span>
            </Typography>
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>{new Date(p.timeOfBought).toLocaleString()}</span>
            <span className="capitalize">{p.userEntry}</span>
          </div>

          <div className="text-xs text-gray-500 mt-1">
            {p.usdtAmount > 0 ? (
              <>
                Price: <b>{(p.onionAmount / p.usdtAmount).toFixed(0)} ONION/1 USDT</b>
              </>
            ) : (
              "Price info not available"
            )}
          </div>
        </InfoBox>
      ))}
    </div>
  ) : (
    <Typography
      variant="caption2"
      className="text-gray-500 mb-2"
    >
      No purchases yet.
    </Typography>
  );
