"use client";
import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Divider from "@/components/Divider";
import { Skeleton } from "@mui/material";

const LoadingSkeleton = () => {
  return (
    <div>
      <div className="flex flex-col gap-4 p-4">
        {/* Event Header Skeleton */}
        <CustomCard defaultPadding>
          <Skeleton
            variant="rectangular"
            className="w-full rounded-2lg"
            height={320}
          />
          <div className="mt-4 space-y-4">
            <Skeleton
              variant="text"
              width="60%"
              height={32}
            />
            <Skeleton
              variant="text"
              width="40%"
              height={24}
            />
          </div>
          <Divider margin="medium" />
          <div className="flex flex-col gap-4">
            <Skeleton
              variant="text"
              width="50%"
            />
            <Skeleton
              variant="text"
              width="50%"
            />
            <Skeleton
              variant="text"
              width="50%"
            />
            <Skeleton
              variant="text"
              width="50%"
            />
            <Skeleton
              variant="text"
              width="50%"
            />
          </div>
        </CustomCard>

        {/* Sponsor Card Skeleton */}
        <CustomCard title="Sponsor">
          <div className="flex items-center justify-between cursor-pointer p-4 pt-0">
            <div className="flex items-center gap-3">
              <Skeleton
                variant="circular"
                width={48}
                height={48}
              />
              <div>
                <Skeleton
                  variant="text"
                  width={100}
                />
                <Skeleton
                  variant="text"
                  width={80}
                />
              </div>
            </div>
            <Skeleton
              variant="circular"
              width={24}
              height={24}
            />
          </div>
        </CustomCard>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
