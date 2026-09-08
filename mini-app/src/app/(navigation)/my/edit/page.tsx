"use client";

import { trpc } from "@/app/_trpc/client";
import EditForm from "./EditForm";
import { useUserStore } from "@/context/store/user.store";
import LoginRequired from "@/app/_components/auth/LoginRequired";

export default function EditOrganizerPage() {
  const { user } = useUserStore();
  const { data } = trpc.organizers.getOrganizer.useQuery({}, {
    enabled: !!user,
  });

  if (!user) {
    return <LoginRequired />;
  }

  if (!data) return null;

  return <EditForm data={data} />;
}

