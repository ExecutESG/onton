"use client";

import ManageEvent from "@/app/_components/organisms/events/ManageEvent";
import { useUserStore } from "@/context/store/user.store";
import LoginRequired from "@/app/_components/auth/LoginRequired";
export default function CreateEventAdminPage() {
  const { user } = useUserStore();

  if (!user) {
    return <LoginRequired />;
  }

  return (
    <div className={"!py-0  min-h-screen overflow-auto mb-[calc(-1*(var(--tg-safe-area-inset-bottom)))]"}>
      <ManageEvent />
    </div>
  );
}
