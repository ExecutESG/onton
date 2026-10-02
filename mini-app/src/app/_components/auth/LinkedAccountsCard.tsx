"use client";

import React, { useState } from "react";
import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { trpc } from "@/app/_trpc/client";
import { useUserStore } from "@/context/store/user.store";
import { useTonConnectModal, useTonWallet } from "@tonconnect/ui-react";
import { formatWalletAddress } from "@/server/utils/wallets-data";
import { CheckCircle2, Link2, Loader2, ShieldCheck, Unlink } from "lucide-react";
import { toast } from "sonner";
import OntonDialog from "@/components/OntonDialog";

export default function LinkedAccountsCard() {
  const { user } = useUserStore();
  const tonWallet = useTonWallet();
  const walletModal = useTonConnectModal();
  const trpcUtils = trpc.useUtils();
  const [unlinkConfirmProvider, setUnlinkConfirmProvider] = useState<string | null>(null);

  const { data: identities, isLoading } = trpc.users.getLinkedIdentities.useQuery(undefined, {
    enabled: !!user,
  });

  const unlinkMutation = trpc.users.unlinkIdentity.useMutation({
    onSuccess: () => {
      toast.success("Account unlinked successfully");
      trpcUtils.users.getLinkedIdentities.invalidate();
      trpcUtils.users.syncUser.invalidate();
      setUnlinkConfirmProvider(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to unlink account");
      setUnlinkConfirmProvider(null);
    },
  });

  const hasTelegram = Boolean(
    user?.telegram_id || identities?.some((item) => item.provider === "telegram")
  );
  const telegramIdentity = identities?.find((item) => item.provider === "telegram");

  const hasGoogle = Boolean(
    identities?.some((item) => item.provider === "google") || (user?.email && user?.auth_provider === "google")
  );
  const googleIdentity = identities?.find((item) => item.provider === "google");

  const walletAddr = user?.wallet_address || tonWallet?.account.address;
  const hasWallet = Boolean(
    walletAddr || identities?.some((item) => item.provider === "ton_wallet")
  );

  const totalLinked = [hasTelegram, hasGoogle, hasWallet].filter(Boolean).length;

  const handleLinkGoogle = () => {
    window.location.href = `/api/auth/google/web?returnUrl=${encodeURIComponent(window.location.pathname)}`;
  };

  const handleLinkWallet = () => {
    walletModal.open();
  };

  const handleUnlink = (provider: "telegram" | "google" | "ton_wallet" | "email") => {
    if (totalLinked <= 1) {
      toast.error("Cannot unlink your only login method.");
      return;
    }
    setUnlinkConfirmProvider(provider);
  };

  return (
    <CustomCard title="Connected Accounts" className="w-full !mx-0 mt-4">
      <div className="p-4 pt-0 space-y-3">
        <Typography variant="subheadline2" className="text-gray-500 dark:text-gray-400">
          Link multiple providers to access your tickets, rewards, and events from anywhere.
        </Typography>

        {/* Telegram Item */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-700/60 transition">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#229ED9]/15 flex items-center justify-center text-[#229ED9]">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Telegram</span>
                {hasTelegram && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasTelegram
                  ? user?.username
                    ? `@${user.username}`
                    : `ID: ${user?.telegram_id || telegramIdentity?.providerUserId || "Connected"}`
                  : "Not linked"}
              </p>
            </div>
          </div>
          <div>
            {hasTelegram ? (
              totalLinked > 1 && (
                <button
                  onClick={() => handleUnlink("telegram")}
                  disabled={unlinkMutation.isPending}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition"
                  title="Unlink Telegram"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )
            ) : (
              <span className="text-xs text-gray-400">Open via TMA</span>
            )}
          </div>
        </div>

        {/* Google Item */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-700/60 transition">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.85-.94 2.4l3.07 2.38c1.8-1.66 2.92-4.11 2.92-6.63z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.07-2.38c-.9.6-2.03.96-3.23.96-2.48 0-4.58-1.67-5.33-3.92l-3.18 2.46C7.1 21.8 11.24 24 12 24z" />
                <path fill="#FBBC05" d="M6.67 15.75c-.2-.6-.31-1.25-.31-1.92s.11-1.32.31-1.92L3.49 9.45C2.65 11.13 2.18 13.01 2.18 15s.47 3.87 1.31 5.55l3.18-2.46C5.92 17.02 5.92 16.73 6.67 15.75z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.9 0 4.39 2.2 2.18 5.45l3.18 2.46c.75-2.25 2.85-3.92 5.33-3.92z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Google</span>
                {hasGoogle && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasGoogle
                  ? (googleIdentity?.metadata as any)?.email || user?.email || "Connected"
                  : "Not linked"}
              </p>
            </div>
          </div>
          <div>
            {hasGoogle ? (
              totalLinked > 1 && (
                <button
                  onClick={() => handleUnlink("google")}
                  disabled={unlinkMutation.isPending}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition"
                  title="Unlink Google"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )
            ) : (
              <button
                onClick={handleLinkGoogle}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition flex items-center gap-1.5 shadow-sm"
              >
                <Link2 className="w-3 h-3" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>

        {/* TON Wallet Item */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-700/60 transition">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0088CC]/15 flex items-center justify-center text-[#0088CC]">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">TON Wallet</span>
                {hasWallet && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              </div>
              <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                {hasWallet ? formatWalletAddress(walletAddr!) : "Not connected"}
              </p>
            </div>
          </div>
          <div>
            {hasWallet ? (
              totalLinked > 1 && (
                <button
                  onClick={() => handleUnlink("ton_wallet")}
                  disabled={unlinkMutation.isPending}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition"
                  title="Unlink Wallet"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )
            ) : (
              <button
                onClick={handleLinkWallet}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition flex items-center gap-1.5 shadow-sm"
              >
                <Link2 className="w-3 h-3" />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unlink Confirmation Dialog */}
      {unlinkConfirmProvider && (
        <OntonDialog
          open={Boolean(unlinkConfirmProvider)}
          onClose={() => setUnlinkConfirmProvider(null)}
          title="Unlink Account"
        >
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to disconnect this {unlinkConfirmProvider} account? You will no longer be able to log in using it.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setUnlinkConfirmProvider(null)}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => unlinkMutation.mutate({ provider: unlinkConfirmProvider as any })}
                disabled={unlinkMutation.isPending}
                className="px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition flex items-center gap-2"
              >
                {unlinkMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Unlink</span>
              </button>
            </div>
          </div>
        </OntonDialog>
      )}
    </CustomCard>
  );
}
