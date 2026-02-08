import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { formatDate, formatTime } from "@/lib/DateAndTime"; // or your helpers
import Image from "next/image";
import { JoinOntonAffiliateScore } from "@/db/modules/userScore.db"; // Adjust the import path as necessary

type AffiliateDetailCardProps = {
  data: JoinOntonAffiliateScore;
};

export const AffiliateDetailCard = ({ data }: AffiliateDetailCardProps) => {
  const { userName, userFirstName, userLastName, userPhotoUrl, point, createdAt } = data;

  const fullName = userName ?? ([userFirstName, userLastName].filter(Boolean).join(" ") || "Unknown User");

  const created = createdAt ? new Date(createdAt) : null;

  return (
    <CustomCard className="p-2">
      <div className="flex items-center gap-2">
        {/* avatar / photo */}
        <Image
          src={userPhotoUrl || "/template-images/default.webp"}
          alt={fullName}
          width={65}
          height={65}
          className="overflow-hidden object-cover rounded-md aspect-square"
        />

        {/* left side – user and date */}
        <div className="flex flex-col flex-1 overflow-hidden gap-[3.5px]">
          {/* username / fullname */}
          <Typography
            variant="callout"
            className="line-clamp-1"
          >
            {fullName}
          </Typography>

          {/* timestamp */}
          {created && (
            <Typography
              variant="subheadline2"
              className="text-gray-500 truncate"
            >
              {created && (
                <Typography
                  variant="subheadline2"
                  className="text-gray-500 truncate"
                >
                  {/*  use seconds  */}
                  {formatDate(Math.floor(created.getTime() / 1000))} | {formatTime(created)}
                </Typography>
              )}
            </Typography>
          )}
        </div>

        {/* points on the right */}
        <div className="flex flex-col items-center">
          <Typography variant="callout">{point}</Typography>
          <Typography variant="caption2">Points</Typography>
        </div>
      </div>
    </CustomCard>
  );
};
