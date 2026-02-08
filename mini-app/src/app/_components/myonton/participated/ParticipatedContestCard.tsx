import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { getDiffValueAndSuffix } from "@/lib/time.utils";
import { RouterOutput } from "@/server";
import { cn } from "@/utils";
import { Calendar, Clock } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";
import PrizeCupIcon from "../../icons/prize-cup";

interface ParticipatedContestCardProps {
  tournament: RouterOutput["tournaments"]["getTournaments"]["tournaments"][number];
  noClick?: boolean;
  afterTitle?: React.ReactNode;
  duration?: boolean;
}

const ParticipatedContestCard: React.FC<ParticipatedContestCardProps> = (props) => {
  const router = useRouter();

  const tournament = props.tournament;

  const handleEventClick = () => {
    // If noClick prop is set, do nothing
    if (props.noClick) return;

    router.push(`/play-2-win/${tournament.id}`);
  };

  if (!tournament.startDate || !tournament.endDate) return null;

  const start = new Date(tournament.startDate);
  const end = new Date(tournament.endDate);

  // Helper to format time without seconds and using lowercase am/pm
  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    return minutes === 0 ? `${hours}${period}` : `${hours}:${minutes < 10 ? "0" : ""}${minutes}${period}`;
  };

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

  // Use the provided utils to compute the contest duration in hours
  const { formattedValue: contestDuration } = getDiffValueAndSuffix(start, end);
  const formattedDate = props.duration ? contestDuration : `${datePart} | ${timePart}`;

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        handleEventClick();
      }}
      className={cn(!props.noClick && "cursor-pointer")}
    >
      <CustomCard className="p-2">
        <div className="grid grid-cols-[100px_1fr] gap-4">
          {/* Event Image */}
          <Image
            src={tournament.imageUrl || "/placeholder.svg"}
            alt={tournament.name || "tournament image"}
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
                className="mb-[5.5px] line-clamp-1 leading-[17px]"
              >
                {tournament.name}
              </Typography>
              {props.afterTitle}
            </div>

            {/* Date and Time */}
            <div
              title={formattedDate}
              className="flex items-center text-gray-500 mb-1"
            >
              {props.duration ? (
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

            {/* Date and Time */}

            <div
              title={formattedDate}
              className="flex items-center text-gray-500 mb-1"
            >
              <PrizeCupIcon className="w-4 h-4 mr-2 flex-shrink-0" />
              <Typography
                variant="subheadline2"
                className="truncate"
              >
                {tournament.pricePool?.value ? `${tournament.pricePool?.value} ${tournament.pricePool?.type}` : "Free"}
              </Typography>
            </div>

            {/* Bottom row with organizer and badges */}
            <div className="flex items-center justify-between mt-auto gap-2">
              {/* Organizer or Hosting Status */}
              {tournament.organizer?.channel_name && (
                <div
                  title={tournament.organizer.channel_name}
                  className="flex items-center flex-1 min-w-0"
                >
                  {tournament.organizer.imageUrl && (
                    <div className="relative w-6 h-6 rounded-full overflow-hidden mr-2">
                      <Image
                        src={tournament.organizer.imageUrl || "/placeholder.svg"}
                        alt={tournament.organizer.channel_name}
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
                    {tournament.organizer.channel_name}
                  </Typography>
                </div>
              )}

              {/* Tags/Badges */}
              {/* FIXME: do we have the prize pool or join price pull? */}
              {/* <div className="flex flex-nowrap gap-2 justify-end">
                <Badge className="rounded-md px-1 font-normal text-xs bg-gray-200 text-gray-700 hover:bg-gray-200 hover:text-gray-700">
                  {tournament.price?.value ? `${tournament.price?.value} ${tournament.price?.type}` : "Free"}
                </Badge>
              </div> */}
            </div>
          </div>
        </div>
      </CustomCard>
    </div>
  );
};

export default ParticipatedContestCard;
