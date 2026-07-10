"use client";

import { ShareAndEarnPartnership } from "./ShareAndEarnPartnership";
import { useUserStore } from "@/context/store/user.store";
import LoginRequired from "@/app/_components/auth/LoginRequired";

export default function FairlaunchAffiliatePage() {
  const { user } = useUserStore();

  if (!user) {
    return <LoginRequired />;
  }

  return (
    <>
      <ShareAndEarnPartnership />
    </>
  );
}

