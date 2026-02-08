"use client";

import { useCallback, useEffect } from "react";
import { trpc } from "@/app/_trpc/client";
import useWebApp from "@/hooks/useWebApp";

function openAuthUrl(url?: string) {
  if (url) window.open(url, "_blank", "noopener");
}

export default function ConnectAccountsPage() {
  /* --------------------------- X queries --------------------------- */
  const { data: linkedX, refetch: refetchX } = trpc.usersX.getLinkedAccount.useQuery();
  const getXAuthUrl = trpc.usersX.getAuthUrl.useQuery(undefined, { enabled: false });
  const saveX = trpc.usersX.saveAccount.useMutation({ onSuccess: () => refetchX() });
  const unlinkX = trpc.usersX.unlink.useMutation({ onSuccess: () => refetchX() });

  /* ------------------------- GitHub queries ------------------------ */
  const { data: linkedGh, refetch: refetchGh } = trpc.usersGithub.getLinkedAccount.useQuery();
  const getGhAuthUrl = trpc.usersGithub.getAuthUrl.useQuery(undefined, { enabled: false });
  const saveGh = trpc.usersGithub.saveAccount.useMutation({ onSuccess: () => refetchGh() });
  const unlinkGh = trpc.usersGithub.unlink.useMutation({ onSuccess: () => refetchGh() });

  /* ----------------------- LinkedIn queries ------------------------ */
  const { data: linkedLi, refetch: refetchLi } = trpc.usersLinkedin.getLinkedAccount.useQuery();
  const getLiAuthUrl = trpc.usersLinkedin.getAuthUrl.useQuery(undefined, { enabled: false });
  const saveLi = trpc.usersLinkedin.saveAccount.useMutation({ onSuccess: () => refetchLi() });
  const unlinkLi = trpc.usersLinkedin.unlink.useMutation({ onSuccess: () => refetchLi() });

  /* ----------------------- Telegram bridge ------------------------- */
  const webApp = useWebApp();

  useEffect(() => {
    function handleMessage(ev: MessageEvent) {
      const { type, payload } = ev.data || {};
      if (type === "x-auth" && payload?.ok) {
        saveX.mutate({
          xUserId: payload.xUserId,
          xUsername: payload.xUsername,
          xDisplayName: payload.xDisplayName,
          xProfileImageUrl: payload.xProfileImageUrl,
        });
      }
      if (type === "gh-auth" && payload?.ok) {
        saveGh.mutate({
          ghUserId: payload.ghUserId,
          ghLogin: payload.ghLogin,
          ghDisplayName: payload.ghDisplayName,
          ghAvatarUrl: payload.ghAvatarUrl,
        });
      }
      if (type === "li-auth" && payload?.ok) {
        saveLi.mutate({
          liUserId: payload.liUserId,
          liFirstName: payload.liFirstName,
          liLastName: payload.liLastName,
          liAvatarUrl: payload.liAvatarUrl,
          liEmail: payload.liEmail,
        });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [saveX, saveGh, saveLi]);

  /* --------------- open consent screens (X / GitHub / LinkedIn) --------------- */
  const startXConnect = useCallback(async () => {
    const { data } = await getXAuthUrl.refetch();
    openAuthUrl(data?.authUrl);
    webApp?.close();
  }, [getXAuthUrl, webApp]);

  const startGhConnect = useCallback(async () => {
    const { data } = await getGhAuthUrl.refetch();
    openAuthUrl(data?.authUrl);
    webApp?.close();
  }, [getGhAuthUrl, webApp]);

  const startLiConnect = useCallback(async () => {
    const { data } = await getLiAuthUrl.refetch();
    openAuthUrl(data?.authUrl);
    webApp?.close();
  }, [getLiAuthUrl, webApp]);

  /* ------------------------------- UI ------------------------------ */
  return (
    <main className="flex flex-col items-center gap-10 p-6">
      <h1 className="text-2xl font-semibold">Connect your social accounts</h1>

      {/* ---------- X section ---------- */}
      <AccountBlock
        title="Twitter / X"
        connected={!!linkedX}
        avatar={linkedX?.xProfileImageUrl}
        handle={linkedX?.xUsername ? `@${linkedX.xUsername}` : undefined}
        onConnect={startXConnect}
        onDisconnect={() => unlinkX.mutate()}
        loadingConnect={getXAuthUrl.isFetching}
        loadingDisconnect={unlinkX.isLoading}
        connectColor="bg-black"
      />

      {/* ---------- GitHub section ---------- */}
      <AccountBlock
        title="GitHub"
        connected={!!linkedGh}
        avatar={linkedGh?.ghAvatarUrl}
        handle={linkedGh?.ghLogin ? `@${linkedGh.ghLogin}` : undefined}
        onConnect={startGhConnect}
        onDisconnect={() => unlinkGh.mutate()}
        loadingConnect={getGhAuthUrl.isFetching}
        loadingDisconnect={unlinkGh.isLoading}
        connectColor="bg-gray-800"
      />

      {/* ---------- LinkedIn section ---------- */}
      <AccountBlock
        title="LinkedIn"
        connected={!!linkedLi}
        avatar={linkedLi?.liAvatarUrl}
        handle={linkedLi ? `${linkedLi.liFirstName ?? ""} ${linkedLi.liLastName ?? ""}`.trim() : undefined}
        onConnect={startLiConnect}
        onDisconnect={() => unlinkLi.mutate()}
        loadingConnect={getLiAuthUrl.isFetching}
        loadingDisconnect={unlinkLi.isLoading}
        connectColor="bg-blue-700"
      />
    </main>
  );
}

/* ------------------------- Small sub‑component ------------------------ */
interface AccountBlockProps {
  title: string;
  connected: boolean;
  avatar?: string | null;
  handle?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  loadingConnect: boolean;
  loadingDisconnect: boolean;
  connectColor: string; // Tailwind class
}

function AccountBlock({
  title,
  connected,
  avatar,
  handle,
  onConnect,
  onDisconnect,
  loadingConnect,
  loadingDisconnect,
  connectColor,
}: AccountBlockProps) {
  return (
    <section className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-medium">{title}</h2>

      {connected ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt="avatar"
                className="h-8 w-8 rounded-full"
              />
            )}
            {handle && <span>{handle}</span>}
          </div>
          <button
            className="rounded-xl bg-red-500 px-4 py-1 text-white"
            onClick={onDisconnect}
            disabled={loadingDisconnect}
          >
            {loadingDisconnect ? "Unlinking…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <button
          className={`rounded-xl px-6 py-2 text-white ${connectColor}`}
          onClick={onConnect}
          disabled={loadingConnect}
        >
          {loadingConnect ? "Loading…" : `Connect ${title}`}
        </button>
      )}
    </section>
  );
}
