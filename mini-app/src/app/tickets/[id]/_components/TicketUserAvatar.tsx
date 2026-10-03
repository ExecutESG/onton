"use client";

import useWebApp from "@/hooks/useWebApp";
import Image from "next/image";

const AVATAR_GRADIENTS = [
  "bg-gradient-to-b from-[#FF885E] to-[#FF516A]",
  "bg-gradient-to-b from-[#FFCD6A] to-[#FFA85C]",
  "bg-gradient-to-b from-[#82B1FF] to-[#665FFF]",
  "bg-gradient-to-b from-[#A0DE7E] to-[#54CB68]",
  "bg-gradient-to-b from-[#53EDD6] to-[#28C9B7]",
  "bg-gradient-to-b from-[#72D5FD] to-[#2A9EF1]",
  "bg-gradient-to-b from-[#E0A2F3] to-[#D669ED]",
];

/** Renders the Telegram user's avatar photo, or colored initials fallback. */
export default function TicketUserAvatar() {
  const webApp = useWebApp();
  const user = webApp?.initDataUnsafe?.user;

  if (user?.photo_url) {
    return (
      <Image
        src={user.photo_url}
        alt={user.username || "user avatar"}
        width={24}
        height={24}
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }

  const firstName = user?.first_name || "";
  const lastName = user?.last_name || "";
  const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "?";
  const gradientClass = AVATAR_GRADIENTS[initials.charCodeAt(0) % AVATAR_GRADIENTS.length];

  return (
    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium text-white ${gradientClass}`}>
      {initials}
    </div>
  );
}
