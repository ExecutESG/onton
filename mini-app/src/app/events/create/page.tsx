"use client";
import ManageEvent from "@/app/_components/organisms/events/ManageEvent";

export default function CreateEventAdminPage() {
  return (
    <div className={"!py-0  min-h-screen overflow-auto mb-[calc(-1*(var(--tg-safe-area-inset-bottom)))]"}>
      <ManageEvent />
    </div>
  );
}
