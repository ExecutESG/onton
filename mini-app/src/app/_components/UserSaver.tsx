"use client";

import { useUserStore } from "@/context/store/user.store";
import useWebApp from "@/hooks/useWebApp";
import { FC, ReactNode, useEffect } from "react";
import { trpc } from "../_trpc/client";
import { ErrorState } from "./ErrorState";
import EventSkeleton from "./molecules/skeletons/EventSkeleton";
import { getClientTelegramInitData, isTelegramClient } from "@/lib/clientTelegramInitData";

const UserSaver: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { setUser, initData } = useUserStore();
  const webApp = useWebApp();

  const activeInitData = initData || getClientTelegramInitData();
  const isTg = isTelegramClient();

  const syncUser = trpc.users.syncUser.useQuery(undefined, {
    enabled: isTg ? !!activeInitData : true,
  });

  // Second effect: Handle user saving after WebApp is ready
  useEffect(() => {
    if (syncUser.isSuccess) {
      setUser(syncUser.data);
      webApp?.ready();
    }
  }, [syncUser.isSuccess, syncUser.data?.wallet_address, syncUser.data, setUser, webApp]);

  // Show loading state until everything is ready
  if (syncUser.isLoading || (isTg && !activeInitData)) {
    return (
      <div className="h-screen p-4">
        <EventSkeleton />
      </div>
    );
  }

  if (syncUser.isError) {
    if (syncUser.error.data?.code === "UNAUTHORIZED") {
      return <>{children}</>;
    }
    if (syncUser.error.data?.code === "FORBIDDEN") {
      return <ErrorState errorCode="banned" />;
    } else {
      return <ErrorState errorCode="something_went_wrong" />;
    }
  }

  if (syncUser.data?.has_blocked_the_bot) {
    return <ErrorState errorCode="blocked_bot" />;
  }

  if (syncUser.data?.role === "ban") {
    return <ErrorState errorCode="banned" />;
  }

  return <>{children}</>;
};

export default UserSaver;
