"use client";

import ManageEvent from "@/app/_components/organisms/events/ManageEvent";
import { useUserStore } from "@/context/store/user.store";
import LoginRequired from "@/app/_components/auth/LoginRequired";
import { ShieldAlert } from "lucide-react";

export default function CreateEventAdminPage() {
  const { user } = useUserStore();

  if (!user) {
    return <LoginRequired />;
  }

  const isOrganizer = user.role === "organizer" || user.role === "admin";

  if (!isOrganizer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Organizer Role Required
        </h2>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Only registered organizers can create events on ONTON. Please contact support or verify your organizer profile to continue.
        </p>
      </div>
    );
  }

  return (
    <div className={"!py-0  min-h-screen overflow-auto mb-[calc(-1*(var(--tg-safe-area-inset-bottom)))]"}>
      <ManageEvent />
    </div>
  );
}
