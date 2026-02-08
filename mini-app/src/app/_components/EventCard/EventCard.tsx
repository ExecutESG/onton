"use client";

import { Calendar, Clock, MapPin } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ForwardedRef } from "react";

import Typography from "@/components/Typography";
import { Badge } from "@/components/ui/badge";
import useWebApp from "@/hooks/useWebApp";
import { formatTime } from "@/lib/DateAndTime";
import { cn } from "@/utils";
import { PiLinkSimple } from "react-icons/pi";
import CustomCard from "../atoms/cards/CustomCard";

export interface EventCardProps {
  event: {
    eventUuid: string;
    title?: string;
    startDate: number;
    endDate: number;
    location?: string;
    imageUrl?: string;
    subtitle?: string;
    organizerChannelName?: string;
    organizerFirstName?: string;
    organizerLastName?: string;
    organizerUsername?: string;
    organizerUserId?: number;
    ticketToCheckIn?: boolean;
    timezone?: string;
    reservedCount?: number;
    visitorCount?: number;
    ticketPrice?: number;
    city?: string;
    country?: string;
    participationType?: string;
    hidden?: number;
    paymentType?: string;
    organizerImageUrl?: string;
    // Has
    hasApproval?: boolean | null;
    hasPayment?: boolean | null;
    hasRegistration?: boolean | null;
  };
  timeOnly?: boolean;
  noClick?: boolean;
  afterTitle?: React.ReactNode;
}

/**
 * Event card component that displays event information in a clean, modern layout
 */
function EventCard({ event, afterTitle, timeOnly, noClick }: EventCardProps, ref: ForwardedRef<HTMLDivElement> | null) {
  // ------------------------- //
  //          HOOKS            //
  // ------------------------- //
  const webApp = useWebApp();
  const router = useRouter();

  // Destructure event fields
  const {
    eventUuid,
    title = "No Title",
    startDate,
    endDate,
    location = "No Location",
    imageUrl = "/placeholder.svg?height=200&width=200",
    organizerChannelName = "",
    ticketToCheckIn = false,
    ticketPrice = 0,
    city = null,
    country = null,
    participationType = "unknown",
    paymentType = "unknown",
    organizerImageUrl,

    // ---------- has properties
    hasRegistration,
    hasPayment,
  } = event;

  // Build location display
  const displayLocation = city && country ? `${city}, ${country}` : location;

  // Format location for display (truncate if needed)
  const formattedLocation = displayLocation.length > 30 ? `${displayLocation.slice(0, 30)}...` : displayLocation;

  // Determine event participation type
  const isOnline = participationType === "online";

  // Determine currency for ticket price
  const normalizedPaymentType = paymentType?.toString().toUpperCase();
  const currency =
    normalizedPaymentType && !["FREE", "UNKNOWN", ""].includes(normalizedPaymentType) ? normalizedPaymentType : "";

  const handleEventClick = () => {
    // If noClick prop is set, do nothing
    if (noClick) return;

    // If ticketToCheckIn => open Telegram link
    if (hasPayment || ticketToCheckIn) {
      webApp?.openTelegramLink(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${eventUuid}`);
    } else {
      // Otherwise, push to /events/[eventUuid]
      router.push(`/events/${eventUuid}`);
    }
  };

  const start = new Date(startDate * 1000);
  const end = new Date(endDate * 1000);

  // Build the date part
  const startMonth = start.toLocaleString("en-US", { month: "short" });
  const endMonth = end.toLocaleString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const sameDay = start.toDateString() === end.toDateString();

  let datePart = "";
  if (sameDay) {
    datePart = `${startMonth} ${startDay}`;
  } else if (startMonth === endMonth) {
    datePart = `${startMonth} ${startDay} - ${endDay}`;
  } else {
    datePart = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }

  // Build the time part
  const timePart = `${formatTime(start)} - ${formatTime(end)}`;

  const formattedDate = timeOnly ? timePart : `${datePart} | ${timePart}`;

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        handleEventClick();
      }}
      className={cn(!noClick && "cursor-pointer")}
    >
      <CustomCard className="p-2">
        <div className="grid grid-cols-[100px_1fr] gap-4">
          {/* Event Image */}
          <Image
            src={imageUrl || "/placeholder.svg"}
            alt={title}
            width={100}
            height={100}
            className="overflow-hidden object-contain !w-[100px] h-[100px] rounded-md self-center"
          />

          {/* Event Details */}
          <div className="flex flex-col overflow-hidden">
            {/* Event Title */}
            <div className="flex items-center justify-between gap-4">
              <Typography
                variant="callout"
                className="mb-[5.5px] h-8 line-clamp-2 leading-[17px]"
              >
                {title}
              </Typography>
              {afterTitle}
            </div>

            {/* Date and Time */}
            <div
              title={formattedDate}
              className="flex items-center text-gray-500 mb-1"
            >
              {timeOnly ? (
                <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
              ) : (
                <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
              )}
              <Typography
                variant="subheadline2"
                className="truncate"
              >
                {formattedDate}
              </Typography>
            </div>

            {/* Location */}
            <div
              title={isOnline ? "Online" : formattedLocation}
              className="flex items-center text-gray-500 mb-1"
            >
              {isOnline ? (
                <PiLinkSimple className="w-4 h-4 mr-2 flex-shrink-0" />
              ) : (
                <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
              )}
              <Typography
                variant="subheadline2"
                className="truncate"
              >
                {isOnline ? "Online" : formattedLocation}
              </Typography>
            </div>

            {/* Bottom row with organizer and badges */}
            <div className="flex items-center justify-between mt-auto gap-2">
              {/* Organizer or Hosting Status */}
              {organizerChannelName && (
                <div
                  title={organizerChannelName}
                  className="flex items-center flex-1 min-w-0"
                >
                  {organizerImageUrl && (
                    <div className="relative w-6 h-6 rounded-full overflow-hidden mr-2">
                      <Image
                        src={organizerImageUrl || "/placeholder.svg"}
                        alt={organizerChannelName}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <Typography
                    variant="subheadline2"
                    className="text-blue-500 truncate"
                    truncate
                  >
                    {organizerChannelName}
                  </Typography>
                </div>
              )}

              {/* Tags/Badges */}
              <div className="flex flex-nowrap gap-2 justify-end">
                <Badge className="rounded-md px-1 font-normal text-xs bg-gray-200 text-gray-700 hover:bg-gray-200 hover:text-gray-700">
                  {isOnline ? "Online" : "In-Person"}
                </Badge>
                <Badge className="rounded-md px-1 font-normal text-xs bg-gray-200 text-gray-700 hover:bg-gray-200 hover:text-gray-700">
                  {ticketPrice > 0 ? `${ticketPrice} ${currency}` : "Free"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CustomCard>
    </div>
  );
}

export default EventCard;
