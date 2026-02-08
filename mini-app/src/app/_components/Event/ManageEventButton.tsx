import { useUserStore } from "@/context/store/user.store";
import { canUserManageEvent } from "@/lib/userRolesUtils";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import CustomButton from "../Button/CustomButton";
import CustomCard from "../atoms/cards/CustomCard";
import { useEventData } from "./eventPageContext";

export const ManageEventButton = () => {
  const { eventData, eventHash } = useEventData();
  const router = useRouter();

  const { user } = useUserStore();
  const canManageEvent = canUserManageEvent(user, {
    data: {
      owner: eventData?.data?.owner,
      accessRoles: eventData?.data?.accessRoles,
    },
  });

  if (!canManageEvent) {
    return null;
  }

  return (
    <CustomCard defaultPadding>
      <CustomButton
        onClick={(e) => {
          router.push(`/events/${eventHash}/manage`);
        }}
        variant="outline"
      >
        <div className="flex gap-2 items-center">
          <Pencil />
          <span>Manage Event</span>
        </div>
      </CustomButton>
    </CustomCard>
  );
};
