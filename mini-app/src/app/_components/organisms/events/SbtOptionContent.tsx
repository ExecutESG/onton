import { AlertGeneric } from "@/components/ui/alert";
import { UploadImageFile } from "@/components/ui/upload-file";
import { UploadVideoFile } from "@/components/ui/upload-video-file";
import { BiSolidLeftArrow, BiSolidRightArrow } from "react-icons/bi";
import LazyLoadVideo from "./LazyLoadVideo";

import { trpc } from "@/app/_trpc/client";
import { useCreateEventStore } from "@/zustand/createEventStore";
import useEmblaCarousel from "embla-carousel-react";
import { Block, BlockHeader, Preloader } from "konsta/react";
import React, { useEffect, useState } from "react";

interface SbtOptionContentProps {
  sbtOption: "custom" | "default";
  errors: { ts_reward_url?: string[]; video_url?: string[] };
  clearImageError: () => void;
  clearVideoError: () => void;
}

export const SbtOptionContent: React.FC<SbtOptionContentProps> = ({
  sbtOption,
  errors,
  clearImageError,
  clearVideoError,
}) => {
  const eventData = useCreateEventStore((state) => state.eventData);
  const setEventData = useCreateEventStore((state) => state.setEventData);

  const {
    data: rewardCollections,
    isLoading,
    isSuccess,
  } = trpc.sbtRewardCollection.getRewardCollectionsByHubID.useQuery(
    { hubID: Number(eventData?.society_hub?.id) || 0 },
    {
      enabled: sbtOption === "default",
      cacheTime: 1000 * 60,
    }
  );

  const [selectedSbtId, setSelectedSbtId] = useState<number | undefined>(rewardCollections?.[0]?.id);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
  });

  useEffect(() => {
    if (emblaApi) {
      emblaApi.on("select", () => {
        const currentIndex = emblaApi.selectedScrollSnap();
        const currentSlide = rewardCollections?.[currentIndex];

        if (currentSlide) {
          setEventData({
            ts_reward_url: currentSlide.imageLink,
            video_url: currentSlide.videoLink,
          });
          setSelectedSbtId(currentSlide.id);
        }
      });
    }
  }, [emblaApi, rewardCollections, setEventData, eventData]);

  // Select the first collection on collection load
  useEffect(() => {
    if (rewardCollections?.length && sbtOption === "default") {
      const collection = rewardCollections[0];
      setEventData({
        ts_reward_url: collection.imageLink,
        video_url: collection.videoLink,
      });
      setSelectedSbtId(collection.id);
    }
  }, [rewardCollections?.length, sbtOption]);

  if (sbtOption === "default") {
    return isLoading && !isSuccess && !eventData?.ts_reward_url ? (
      <Block className="justify-center flex">
        <Preloader />
      </Block>
    ) : (
      <>
        <BlockHeader className="justify-center">Select SBT Video</BlockHeader>
        <Block>
          <div className="text-center w-full space-y-1">
            <div className="flex items-center justify-center text-gray-500 text-sm">
              <BiSolidLeftArrow className="mr-1" />
              <span>Drag left or right to check other badges</span>
              <BiSolidRightArrow className="ml-1" />
            </div>
          </div>
          <div
            ref={emblaRef}
            className="overflow-hidden"
          >
            <div className="flex mx-6">
              {rewardCollections?.map((collection) => (
                <div
                  className="flex-grow-0 flex-shrink-0 w-full min-w-0"
                  key={collection.id}
                >
                  <LazyLoadVideo
                    src={collection.videoLink || ""}
                    hubName={collection.hubName || ""}
                    collectionId={collection.id || 0}
                    coverImage={collection.imageLink || ""}
                    selected={selectedSbtId === collection.id}
                    onClick={() => {
                      setSelectedSbtId(collection.id);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Block>
      </>
    );
  }

  return (
    <>
      <BlockHeader className="!mt-2">Reward Image</BlockHeader>
      <Block margin="!mt-8">
        <AlertGeneric
          variant="info"
          className="my-4"
        >
          Events reward badge, visible on TON society. It cannot be changed after event creation.
        </AlertGeneric>
        <UploadImageFile
          changeText="Change SBT Image"
          infoText="Image must be in 1:1 ratio"
          triggerText="Upload SBT Image"
          drawerDescriptionText="Upload your custom SBT reward image"
          onDone={(url) => {
            setEventData({ ts_reward_url: url });
            clearImageError();
          }}
          isError={Boolean(errors?.ts_reward_url)}
        />
      </Block>

      <BlockHeader>Reward Video</BlockHeader>
      <Block margin="!mb-4 !mt-8">
        <AlertGeneric
          variant="info"
          className="my-4"
        >
          Upload a video related to your event. Only MP4 format is allowed, and the file size must be under 5 MB.
        </AlertGeneric>
        <UploadVideoFile
          changeText="Change SBT Video"
          infoText="Only MP4 files under 5 MB"
          triggerText="Upload SBT Video"
          drawerDescriptionText="Upload a promotional video for your custom SBT"
          onDone={(url) => {
            setEventData({ video_url: url });
            clearVideoError();
          }}
          isError={Boolean(errors?.video_url)}
        />
      </Block>
    </>
  );
};
