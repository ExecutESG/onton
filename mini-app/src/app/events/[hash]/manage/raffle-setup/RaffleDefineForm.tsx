/* organiser dashboard – TON giveaway / multi-reward merch raffle */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Block, BlockTitle, List, ListInput, ListItem, Preloader, Radio } from "konsta/react";
import { Button } from "@/components/ui/button";
import { Plus, Share as ShareIcon } from "lucide-react";
import { FiUser, FiCopy } from "react-icons/fi";

import { trpc } from "@/app/_trpc/client";
import CustomButton from "@/app/_components/Button/CustomButton";
import ListLayout from "@/app/_components/atoms/cards/ListLayout";
import DataStatus from "@/app/_components/molecules/alerts/DataStatus";
import type { StatusChipProps } from "@/components/ui/status-chips";

/* ------------------------------------------------------------------ *
 * helpers                                                            *
 * ------------------------------------------------------------------ */
type Kind = "ton" | "merch";

const formatAmount = (value?: string | bigint | null, decimals = 9, digits = 3) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(num)) return "—";
  const factor = 10 ** decimals;
  return (num / factor).toFixed(digits);
};
const toDisplayNumber = (value?: string | null, decimals = 9) => {
  if (!value) return 0;
  return Number(value) / 10 ** decimals;
};
const trunc = (s = "", m = 18) => (s.length <= m ? s : `${s.slice(0, m - 1)}…`);
const bestName = (u: any) => u.username ?? ([u.first_name, u.last_name].filter(Boolean).join(" ") || u.user_id);
const isTestnet = !(/*NOT*/ ["production", "stage", "staging"].includes(process.env.NEXT_PUBLIC_ENV || "development"));
const txUrl = (h?: string | null) => (h ? `https://${isTestnet ? "testnet." : ""}tonviewer.com/transaction/${h}` : null);

const shareLink = async (url: string, text: string) => {
  try {
    window.Telegram?.WebApp?.openTelegramLink?.(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    );
    return;
  } catch {}
  if (navigator.share) {
    try {
      await navigator.share({ url, text });
      return;
    } catch {}
  }
  await navigator.clipboard.writeText(url);
  toast.success("Link copied!");
};

/* ------------------------------------------------------------------ *
 * zod schemas                                                        *
 * ------------------------------------------------------------------ */
const tonSchema = z
  .object({
    event_uuid: z.string().uuid(),
    top_n: z.coerce.number().int().min(1).max(1000),
    prize_pool_amount: z.coerce.number().positive(),
    token_id: z.coerce.number().int().positive(),
  })
  .superRefine((val, ctx) => {
    const perWinner = val.prize_pool_amount / val.top_n;
    if (!(perWinner > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prize_pool_amount"],
        message: "Per-winner amount must be greater than zero.",
      });
    }
  });
type TokenFormValues = z.infer<typeof tonSchema>;

const prizeSchema = z.object({
  item_name: z.string().min(3),
  item_description: z.string().optional(),
  top_n: z.coerce.number().int().min(1).max(1000),
  fulfil_method: z.enum(["ship", "pickup"]),
});
type PrizeVals = z.infer<typeof prizeSchema>;

/* ------------------------------------------------------------------ *
 * small TON components                                               *
 * ------------------------------------------------------------------ */
type TokenOption = {
  token_id: number;
  symbol: string;
  name: string | null;
  decimals: number;
  master_address: string | null;
  is_native: boolean;
  logo_url: string | null;
};

function TokenForm({
  control,
  errors,
  canEdit,
  onSave,
  saving,
  tokens,
  selectedToken,
}: {
  control: any;
  errors: any;
  canEdit: boolean;
  onSave: () => void;
  saving: boolean;
  tokens: TokenOption[];
  selectedToken?: TokenOption | null;
}) {
  return (
    <form onSubmit={onSave}>
      <ListLayout title={`${selectedToken?.symbol ?? "Token"} giveaway`}>
        <Controller
          control={control}
          name="token_id"
          render={({ field }) => (
            <ListItem
              title="Reward token"
              subtitle={selectedToken?.name ?? undefined}
              media={
                selectedToken?.logo_url ? (
                  <img
                    src={selectedToken.logo_url}
                    alt={selectedToken.symbol}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : undefined
              }
              after={
                <div className="flex items-center gap-2">
                  {!selectedToken?.logo_url && (
                    <span className="text-xs font-semibold text-gray-500">
                      {selectedToken?.symbol ?? ""}
                    </span>
                  )}
                  <select
                    className="border rounded-md px-2 py-1 text-sm bg-white"
                    disabled={!canEdit}
                    value={field.value ?? tokens[0]?.token_id ?? 1}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  >
                    {tokens.map((token) => (
                      <option key={token.token_id} value={token.token_id}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              }
            />
          )}
        />
        <Controller
          control={control}
          name="top_n"
          render={({ field }) => (
            <ListInput
              {...field}
              outline
              disabled={!canEdit}
              label="Number of winners"
              type="number"
              min={1}
              max={1000}
              required
              error={errors.top_n?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="prize_pool_amount"
          render={({ field }) => (
            <ListInput
              {...field}
              outline
              disabled={!canEdit}
              label={`Prize pool (${selectedToken?.symbol ?? "token"})`}
              type="number"
              step="0.001"
              required
              error={errors.prize_pool_amount?.message}
            />
          )}
        />
      </ListLayout>
      {canEdit && (
        <div className="px-4 mt-3">
          <CustomButton
            className="w-full justify-center"
            isLoading={saving}
            onClick={(e) => {
              onSave();
              e.preventDefault();
            }}
          >
            Save
          </CustomButton>
        </div>
      )}
    </form>
  );
}

function SummaryToken({ info }: { info: any }) {
  const raffle = info.raffle;
  const token: TokenOption | undefined = info.token;
  const wallet = info.wallet ?? {};
  const funding = info.funding ?? {};

  const decimals = token?.decimals ?? 9;
  const pool = BigInt(raffle.prize_pool_nanoton ?? 0);
  const perWinner = raffle.top_n > 0 ? pool / BigInt(raffle.top_n) : BigInt(0);

  const tonBalance = wallet.tonBalanceNano ? BigInt(wallet.tonBalanceNano) : BigInt(0);
  const tonRequired = funding.tonRequiredNano ? BigInt(funding.tonRequiredNano) : BigInt(0);
  const tokenBalance = wallet.tokenBalanceNano ? BigInt(wallet.tokenBalanceNano) : BigInt(0);
  const tokenRequired = funding.tokenRequiredNano ? BigInt(funding.tokenRequiredNano) : BigInt(0);

  const tonSufficient = Boolean(funding.tonSufficient);
  const tokenSufficient = Boolean(funding.tokenSufficient);

  const statusVariant: StatusChipProps["variant"] =
    raffle.status === "completed"
      ? "success"
      : raffle.status === "waiting_funding"
      ? "warning"
      : raffle.status === "distributing"
      ? "primary"
      : raffle.status === "funded"
      ? "primary"
      : "warning";
  const statusLabel =
    raffle.status === "waiting_funding"
      ? "Waiting funding"
      : raffle.status === "completed"
      ? "Completed"
      : raffle.status === "distributing"
      ? "Distributing"
      : raffle.status === "funded"
      ? "Funded"
      : String(raffle.status ?? "");

  const balanceTag = (ok: boolean) => (
    <span className={ok ? "text-emerald-600" : "text-red-500"}>{ok ? "OK" : "Needs funding"}</span>
  );

  return (
    <>
      <div className="mt-3">
      <ListLayout title="Funding Wallet">
        {!wallet.address && <ListItem title="Wallet address will be created soon" />}
        {wallet.address && (
          <div>
            <div className="text-sm text-gray-700 mb-1">Wallet Address</div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <ListInput outline readOnly value={wallet.address} />
              <Button
                variant="secondary"
                  className="h-10 px-3 mr-2"
                  onClick={() =>
                    navigator.clipboard.writeText(wallet.address).then(() => toast.success("Wallet address copied"))
                  }
                  title="Copy address"
                >
                  <FiCopy size={18} />
                </Button>
              </div>
              {wallet.deployed !== undefined && (
                <p className="text-xs text-gray-500 mt-1">{wallet.deployed ? "Wallet deployed" : "Wallet not deployed yet"}</p>
              )}
            </div>
          )}
          {wallet.tokenWalletAddress && token && !token.is_native && (
            <div className="mt-3">
              <div className="text-sm text-gray-700 mb-1">{token.symbol} wallet</div>
              <ListInput outline readOnly value={wallet.tokenWalletAddress} />
            </div>
          )}
        </ListLayout>
      </div>

      <div className="mt-3">
        <ListLayout title="Raffle summary" label={{ text: statusLabel, variant: statusVariant }}>
          <ListItem
            title="Per-winner amount"
            subtitle={<span className="text-gray-500">If there are fewer winners, the remaining pool will be redistributed.</span>}
            after={<span className="font-medium">{`${formatAmount(perWinner, decimals, 4)} ${token?.symbol ?? "token"}`}</span>}
          />
          <ListItem
            title="Prize pool"
            after={<span className="font-medium">{`${formatAmount(pool, decimals, 4)} ${token?.symbol ?? "token"}`}</span>}
          />
          <ListItem
            title="TON balance"
            subtitle="Must cover deployment and transaction fees"
            after={
              <span className="font-medium">
                {`${formatAmount(tonBalance, 9, 4)} / ${formatAmount(tonRequired, 9, 4)} TON`} &nbsp;
                {balanceTag(tonSufficient)}
              </span>
            }
          />
          <ListItem
            title={`${token?.symbol ?? "Token"} balance`}
            subtitle="Must cover the prize pool"
            after={
              <span className="font-medium">
                {`${formatAmount(tokenBalance, decimals, 4)} / ${formatAmount(tokenRequired, decimals, 4)} ${token?.symbol ?? "token"}`} &nbsp;
                {balanceTag(tokenSufficient)}
              </span>
            }
          />
        </ListLayout>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * prize editor overlay                                               *
 * ------------------------------------------------------------------ */
function PrizeEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<PrizeVals>;
  onSave: (v: PrizeVals) => void;
  onCancel: () => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PrizeVals>({
    resolver: zodResolver(prizeSchema),
    mode: "onBlur",
    shouldFocusError: false,
    defaultValues: { top_n: 1, fulfil_method: "ship", ...initial },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Block className="bg-white rounded-lg w-[90%] max-w-md p-4">
        <form className="space-y-3">
          <BlockTitle>{initial.item_name ? "Edit reward" : "Add reward"}</BlockTitle>
          <List>
            <Controller
              control={control}
              name="item_name"
              render={({ field }) => (
                <ListInput
                  {...field}
                  label="Item"
                  required
                  error={errors.item_name?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="item_description"
              render={({ field }) => (
                <ListInput
                  {...field}
                  type="textarea"
                  label="Description"
                  error={errors.item_description?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="top_n"
              render={({ field }) => (
                <ListInput
                  {...field}
                  label="Winners"
                  type="number"
                  min={1}
                  max={1000}
                  error={errors.top_n?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="fulfil_method"
              render={({ field }) => (
                <Block className="flex gap-6 px-4">
                  {(["ship", "pickup"] as const).map((v) => (
                    <label
                      key={v}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Radio
                        checked={field.value === v}
                        onChange={() => field.onChange(v)}
                      />
                      {v === "ship" ? "Ship" : "Pick-up"}
                    </label>
                  ))}
                </Block>
              )}
            />
          </List>

          <div className="flex gap-3">
            <CustomButton
              className="flex-1 justify-center"
              isLoading={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(onSave)();
              }}
            >
              Save
            </CustomButton>
            <Button
              variant="secondary"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Block>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * tiny modal to view shipping info                                   *
 * ------------------------------------------------------------------ */
// ⭐ NEW
function UserDialog({ user, onClose, onUpdated, eventUuid }: { user: any; onClose: () => void; onUpdated: () => void; eventUuid: string }) {
  if (!user) return null;
  const [tracking, setTracking] = useState("");
  const shipMut = trpc.raffle.updateMerchPrizeShipping.useMutation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Block className="bg-white rounded-lg w-[90%] max-w-md p-4">
        <BlockTitle className="!mt-0 mb-3">Participant details</BlockTitle>

        <div className="space-y-2">

        <p>
          <b>Username / name:</b> {bestName(user)}
        </p>
        {user.full_name && (
          <p>
            <b>Full name:</b> {user.full_name}
          </p>
        )}
        {user.shipping_address && (
          <p className="break-words">
            <b>Address:</b> {user.shipping_address}
          </p>
        )}
        {user.zip_code && (
          <p>
            <b>ZIP:</b> {user.zip_code}
          </p>
        )}
        {user.phone && (
          <p>
            <b>Phone:</b> {user.phone}
          </p>
        )}
        {user.tracking_number && (
          <p>
            <b>Tracking:</b> {user.tracking_number}
          </p>
        )}
        <p>
          <b>Status:</b> {user.status ?? "—"}
        </p>

        {/* Ship action: only when awaiting shipping */}
        {user.status === "awaiting_shipping" && (
          <div className="mt-2 space-y-1">
            <List className="!mx-0 !px-0">
              <ListInput
                className="!mx-0 w-full"
                outline
                label="Tracking number"
                placeholder="e.g. DHL / UPS code"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                inputClassName="w-full"
              />
            </List>
            <div className="text-xs text-gray-500">
              Enter the carrier tracking code to mark this prize as shipped.
            </div>
            <CustomButton
              className="w-full justify-center"
              isLoading={shipMut.isLoading}
              onClick={() =>
                toast.promise(
                  shipMut
                    .mutateAsync({
                      event_uuid: eventUuid,
                      merch_prize_result_id: user.id,
                      action: "ship",
                      tracking_number: tracking.trim(),
                    })
                    .then(() => {
                      onUpdated();
                      onClose();
                    }),
                  { loading: "Marking shipped…", success: "Marked as shipped", error: (e) => e?.message ?? "Error" }
                )
              }
              disabled={!tracking.trim()}
            >
              Mark shipped
            </CustomButton>
          </div>
        )}

        <Button className="w-full mt-4" variant="secondary" onClick={onClose}>
          Close
        </Button>
        </div>
      </Block>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * MAIN COMPONENT                                                     *
 * ------------------------------------------------------------------ */
export default function RaffleDefineForm() {
  const { hash: eventUuid } = useParams<{ hash: string }>();
  const router = useRouter();
  const [viewUser, setViewUser] = useState<any | null>(null);
  /* ─── base event (raffleKind) ─── */
  const eventQ = trpc.events.getEvent.useQuery({ event_uuid: eventUuid });

  /* ─── kind radio ─── */
  const [kind, setKind] = useState<Kind>("ton");
  const [locked, setLocked] = useState<Kind | null>(null);

  /* ─── overlay state ─── */
  const [editing, setEditing] = useState<{
    prizeId?: number;
    initial: Partial<PrizeVals>;
  } | null>(null);

  /* ─── TON queries & mut ─── */
  const tokensQ = trpc.raffle.listTokens.useQuery({ event_uuid: eventUuid });

  const tonForm = useForm<TokenFormValues>({
    resolver: zodResolver(tonSchema),
    shouldFocusError: false,
    defaultValues: { event_uuid: eventUuid, top_n: 10, prize_pool_amount: 1, token_id: 1 },
  });
  const tonQ = trpc.raffle.infoForOrganizer.useQuery({ event_uuid: eventUuid });
  const saveTon = trpc.raffle.defineOrUpdate.useMutation();
  const trigTon = trpc.raffle.trigger.useMutation();

  /* ─── MERCH queries & mut ─── */
  const merchDashQ = trpc.raffle.infoForOrganizerMerch.useQuery({ event_uuid: eventUuid });
  const ensureRaffle = trpc.raffle.ensureMerchRaffle.useMutation();
  const savePrize = trpc.raffle.saveMerchPrize.useMutation();
  const trigPrize = trpc.raffle.triggerMerchPrize.useMutation({
    onSuccess: () => merchDashQ.refetch(), // <= RESPOND IMMEDIATELY AFTER TRIGGER
  });

  /* aliases */
  const tonData = tonQ.data;
  const merchData = merchDashQ.data;
  const tokens = (tokensQ.data ?? []) as TokenOption[];
  const selectedTokenId = tonForm.watch("token_id");
  const selectedToken = tokens.find((t) => t.token_id === selectedTokenId) ?? tokens[0];

  /* ─── reflect raffleKind ─── */
  useEffect(() => {
    const rk = eventQ.data?.raffleKind as Kind | null | undefined;
    if (rk === "ton" || rk === "merch") {
      setKind(rk);
      setLocked(rk);
    }
  }, [eventQ.data?.raffleKind]);

  useEffect(() => {
    if (!tokens.length) return;

    if (!tonData?.raffle) {
      const currentTokenId = tonForm.getValues("token_id");
      if (!currentTokenId) {
        tonForm.setValue("token_id", tokens[0].token_id, { shouldDirty: false });
      }
      return;
    }

    if (tonForm.formState.isDirty) return;

    const tokenId = tonData.token?.token_id ?? tokens[0].token_id;
    const decimals = tonData.token?.decimals ?? tokens.find((t) => t.token_id === tokenId)?.decimals ?? 9;
    const poolNumber = toDisplayNumber(tonData.raffle.prize_pool_nanoton, decimals);

    tonForm.reset({
      event_uuid: eventUuid,
      top_n: tonData.raffle.top_n,
      prize_pool_amount: poolNumber,
      token_id: tokenId,
    });
  }, [tokens, tonData?.raffle, tonData?.token, eventUuid, tonForm]);

  /* ─── TON save ─── */
  const handleSaveTon = tonForm.handleSubmit((vals) => {
    const token = tokens.find((t) => t.token_id === vals.token_id) ?? selectedToken;
    const perWinner = vals.prize_pool_amount / vals.top_n;
    if (token?.is_native && perWinner <= 0.02) {
      toast.error(`Per-winner amount must be greater than 0.02 TON. Current per-winner amount is ${perWinner.toFixed(4)} TON.`);
      return;
    }

    toast.promise(
      saveTon.mutateAsync(vals).then(() => tonQ.refetch()),
      {
        loading: "Saving…",
        success: "Saved",
        error: (e) => e?.message ?? "Error",
      }
    );
  });

  /* ─── merch prize save ─── */
  const handleSavePrize = async (vals: PrizeVals) => {
    const raffleUuid =
      merchDashQ.data?.raffle?.merchRaffleUuid ??
      (await ensureRaffle.mutateAsync({ event_uuid: eventUuid })).merchRaffleUuid;

    await toast.promise(
      savePrize
        .mutateAsync({
          event_uuid: eventUuid,
          merch_raffle_uuid: raffleUuid,
          merch_prize_id: editing?.prizeId,
          ...vals,
        })
        .then(() => merchDashQ.refetch()),
      { loading: "Saving…", success: "Saved", error: (e) => e?.message ?? "Error" }
    );
    setEditing(null);
  };

  /* ─── share URLs ─── */
  const raffleTokenSymbol = tonQ.data?.token?.symbol ?? selectedToken?.symbol ?? "TON";
  const raffleTokenDecimals = tonQ.data?.token?.decimals ?? selectedToken?.decimals ?? 9;

  const tonUrl = useMemo(() => {
    const id = tonQ.data?.raffle?.raffle_uuid;
    return id ? `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}-raffle-${id}` : "";
  }, [tonQ.data, eventUuid]);

  const merchUrl = useMemo(() => {
    const id = merchDashQ.data?.raffle?.merchRaffleUuid;
    return id ? `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}-merch-raffle-${id}` : "";
  }, [merchDashQ.data, eventUuid]);

  /* loading splash */
  if (eventQ.isLoading || tonQ.isLoading || merchDashQ.isLoading || tokensQ.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFEFF4]">
        <Preloader />
      </div>
    );
  if (eventQ.error) return <p>{eventQ.error.message}</p>;
  if (tokensQ.error) return <p>{tokensQ.error.message}</p>;

  /* ------------------------------------------------------------------ *
   * RENDER                                                             *
   * ------------------------------------------------------------------ */
  return (
    <div className="flex min-h-screen flex-col bg-[#EFEFF4] pb-24">
      <h1 className="p-4 text-2xl font-bold">Raffle setup</h1>

      {/* ── raffle kind selector ── */}
      <div className="px-0">
        <ListLayout title="Choose type">
          {(["ton", "merch"] as const).map((v) => (
            <ListItem
              key={v}
              title={v === "ton" ? `${selectedToken?.symbol ?? "Token"} giveaway` : "Merch raffle"}
              className={(locked !== null && locked !== v) ? "opacity-60" : ""}
              after={
                <Radio
                  checked={kind === v}
                  disabled={locked !== null && locked !== v}
                  onChange={() => setKind(v)}
                />
              }
              onClick={() => {
                if (!(locked !== null && locked !== v)) setKind(v);
              }}
            />
          ))}
        </ListLayout>
      </div>

      {/* ================= TOKEN ================= */}
      {kind === "ton" && (
        <>
          <TokenForm
            control={tonForm.control}
            errors={tonForm.formState.errors}
            canEdit={!tonData?.raffle || ["waiting_funding", "funded"].includes(tonData.raffle.status)}
            tokens={tokens}
            selectedToken={selectedToken}
            onSave={handleSaveTon}
            saving={saveTon.isLoading}
          />

          {tonData && (
            <div className="space-y-4 px-0">
              <SummaryToken info={tonData} />

              {tonData.raffle.status === "funded" && (
                <CustomButton
                  buttonClassName="mx-4 w-[calc(100%-2rem)]"
                  className="justify-center"
                  onClick={() =>
                    toast.promise(
                      trigTon
                        .mutateAsync({ raffle_uuid: tonData.raffle.raffle_uuid, event_uuid: eventUuid })
                        .then(() => tonQ.refetch()),
                      { loading: "Distributing…", success: "Started!", error: (e) => e?.message ?? "Error" }
                    )
                  }
                >
                  Start sending {raffleTokenSymbol}
                </CustomButton>
              )}

              <div className="mt-3">
                <ListLayout title="Send to guests">
                  <div className="p-4 flex flex-col gap-2 w-full">
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        variant="secondary"
                        onClick={() => navigator.clipboard.writeText(tonUrl).then(() => toast.success("Link copied!"))}
                      >
                        Copy link
                      </Button>
                      <Button
                        className="aspect-square"
                        onClick={() =>
                          shareLink(
                            tonUrl,
                            `🤞 Join the raffle and win ${raffleTokenSymbol}! Powered by @${process.env.NEXT_PUBLIC_BOT_USERNAME}`
                          )
                        }
                      >
                        <ShareIcon size={20} />
                      </Button>
                    </div>
                  </div>
                </ListLayout>
              </div>

              {/* Single list at page end: Eligible until completion; Winners after completion */}
              {(() => {
                const r = tonData.raffle;
                const participants: any[] = tonData.winners ?? [];
                const withRank = participants.filter((p) => p.rank !== null);

                let list: any[] = [];
                const isCompleted = r.status === "completed";
                if (isCompleted) {
                  list = participants
                    .filter((p) => p.rank !== null)
                    .slice()
                    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
                    .filter((p) => (p.rank ?? 0) <= r.top_n);
                } else if (withRank.length) {
                  list = withRank
                    .slice()
                    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
                    .filter((p) => (p.rank ?? 0) <= r.top_n);
                } else {
                  list = participants
                    .slice()
                    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                    .slice(0, r.top_n);
                }

                if (!list.length) return null;
                return (
                  <div className="mt-3">
                    <BlockTitle className="mt-4">{isCompleted ? "Winners" : `Eligible now (Top ${r.top_n})`}</BlockTitle>
                    <List>
                      {list.map((u: any, idx: number) => (
                        <ListItem
                          key={u.user_id}
                          className="py-1"
                          title={<span className="font-medium text-primary">#{u.rank ?? idx + 1}</span>}
                          after={
                            isCompleted ? (
                              <span className="flex items-center gap-2">
                                {u.reward_nanoton ? (
                                  <span>
                                    {`${formatAmount(u.reward_nanoton, raffleTokenDecimals, 4)} ${raffleTokenSymbol}`}
                                  </span>
                                ) : null}
                                {u.tx_hash && u.tx_hash !== "toncenter-batch" && (
                                  <a
                                    href={txUrl(u.tx_hash) ?? undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 underline"
                                    onClick={(e) => {
                                      if (!txUrl(u.tx_hash)) e.preventDefault();
                                    }}
                                  >
                                    TX
                                  </a>
                                )}
                              </span>
                            ) : undefined
                          }
                          subtitle={
                            u.username ? (
                              <a
                                href={`https://t.me/${u.username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline text-blue-600"
                              >
                                @{trunc(u.username)}
                              </a>
                            ) : (
                              trunc(bestName(u))
                            )
                          }
                          media={
                            u.photo_url ? (
                              <Image
                                src={u.photo_url}
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
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* ================= MERCH ================= */}
      {kind === "merch" && (
        <div className="space-y-4 px-0">
          {merchData?.prizes?.length ? (
            <>
            {merchData.prizes.map((row) => {
              if (!row) return null;

              // ⬇️ provide a default empty array when guests key is absent
              const {
                prize,
                winners = [],
                guests: rawGuests,
              } = row as {
                prize: {
                  merch_prize_id: number;
                  item_name: string;
                  item_description: string | null;
                  top_n: number;
                  fulfil_method: "ship" | "pickup";
                  status: "draft" | "active" | "distributing" | "completed" | "cancelled";
                };
                winners?: any[];
                guests?: any[];
              };

              const guests = rawGuests ?? []; // fallback for TypeScript
              const showWinners = prize.status !== "draft" && winners.length > 0;
              const listToShow = showWinners ? winners : guests;

              return (
                <>
                  {viewUser && (
                    <UserDialog
                      user={viewUser}
                      onClose={() => setViewUser(null)}
                      onUpdated={() => merchDashQ.refetch()}
                      eventUuid={eventUuid}
                    />
                  )}
                  {(() => {
                    const statusVariant: StatusChipProps["variant"] =
                      prize.status === "completed"
                        ? "success"
                        : prize.status === "cancelled"
                        ? "danger"
                        : prize.status === "draft"
                        ? "warning"
                        : "primary";
                    const statusLabel = prize.status.charAt(0).toUpperCase() + prize.status.slice(1);
                    return (
                      <div className="mt-3">
                        <ListLayout
                          key={prize.merch_prize_id}
                          title={prize.item_name}
                          label={{ text: statusLabel, variant: statusVariant }}
                        >
                        
                          <ListItem
                            title={<span className="text-sm text-gray-700">Top&nbsp;{prize.top_n} • {prize.fulfil_method}</span>}
                            after={
                              <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setEditing({
                                  prizeId: prize.merch_prize_id,
                                  initial: {
                                    item_name: prize.item_name,
                                    item_description: prize.item_description ?? "",
                                    top_n: prize.top_n,
                                    fulfil_method: prize.fulfil_method,
                                  },
                                })
                              }
                            >
                              Edit
                            </Button>
                          }
                        />
                    
                          {!!listToShow.length &&
                            listToShow.map((u: any, idx: number) => (
                              <ListItem
                                key={u.user_id}
                                className="py-1"
                                title={
                                  showWinners ? (
                                    <span className="font-medium text-primary">#{u.rank}</span>
                                  ) : (
                                    <span className="font-medium text-gray-400">{idx + 1}</span>
                                  )
                                }
                                subtitle={bestName(u)}
                                after={u.status ?? "—"}
                                onClick={() => setViewUser(u)}
                                media={
                                  u.photo_url ? (
                                    <Image
                                      src={u.photo_url}
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
                        </ListLayout>
                      </div>
                    );
                  })()}
                </>
              );
            })}
            {/* Add reward just under the list */}
            {(merchData?.prizes?.length ?? 0) > 0 && (
              <div className="px-4 mt-2">
                <Button
                  variant="outline"
                  className="w-full flex justify-center gap-2"
                  onClick={() => setEditing({ prizeId: undefined, initial: {} })}
                >
                  <Plus size={16} />
                  Add reward
                </Button>
              </div>
            )}
            </>
          ) : (
            <div className="mt-3">
              <ListLayout title="Merch rewards" inset>
                <div className="my-6">
                  <DataStatus
                    status="not_found"
                    title="No rewards yet"
                    description="Add your first reward below."
                    actionButton={
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4"
                        onClick={() => setEditing({ prizeId: undefined, initial: {} })}
                      >
                        <Plus size={14} className="mr-1" /> Add reward
                      </Button>
                    }
                  />
                </div>
              </ListLayout>
            </div>
          )}

          {/* pick winners – only when at least one prize still in draft */}
          {merchData?.prizes?.some((p) => p && p.prize.status === "draft") && (
            <div className="px-4">
              <CustomButton
                className="w-full justify-center"
                isLoading={trigPrize.isLoading}
                onClick={() => {
                  if (!merchData) return;
                  const draftIds = merchData.prizes
                    .filter((p) => p && p.prize.status === "draft")
                    .map((p) => p!.prize.merch_prize_id);
                  if (!draftIds.length) return;

                  toast.promise(
                    Promise.all(draftIds.map((id) => trigPrize.mutateAsync({ merch_prize_id: id, event_uuid: eventUuid }))),
                    {
                      loading: "Picking winners…",
                      success: "Winners selected!",
                      error: (e) => e?.message ?? "Error",
                    }
                  );
                }}
              >
                Pick winners for all rewards
              </CustomButton>
            </div>
          )}

          {merchData?.raffle && (
            <div className="mt-3">
              <ListLayout title="Send to guests">
                <div className="p-4 flex flex-col gap-2 w-full">
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="secondary"
                      onClick={() => navigator.clipboard.writeText(merchUrl).then(() => toast.success("Link copied!"))}
                    >
                      Copy link
                    </Button>
                    <Button
                      className="aspect-square"
                      onClick={() =>
                        shareLink(merchUrl, `🎁 Join the merch raffle! Powered by @${process.env.NEXT_PUBLIC_BOT_USERNAME}`)
                      }
                    >
                      <ShareIcon size={20} />
                    </Button>
                  </div>
                </div>
              </ListLayout>
            </div>
          )}

        </div>
      )}

      {/* overlay */}
      {editing && (
        <PrizeEditor
          initial={editing.initial}
          onSave={handleSavePrize}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
