import { useGetEvent } from "@/hooks/events.hooks";
import { cn } from "@/utils";
import { useCreateEventStore } from "@/zustand/createEventStore";
import { ListInput, ListItem, Preloader, Toggle } from "konsta/react";
import Image from "next/image";
import { useEffect } from "react";
import ListLayout from "../../atoms/cards/ListLayout";
import { SbtOptionContent } from "../../organisms/events/SbtOptionContent";

interface RewardFormProps {
  passwordDisabled: boolean;
  passwordValue: string;
  setPasswordValue: (_: string) => void;
  setPasswordDisabled: (_: boolean) => void;
  sbtOption: "custom" | "default";
  setSbtOption: (_: "custom" | "default") => void;
  clearImageError: () => void;
  clearVideoError: () => void;
}

export const RewardForm = ({
  passwordDisabled,
  passwordValue,
  setPasswordValue,
  setPasswordDisabled,
  sbtOption,
  setSbtOption,
  clearImageError,
  clearVideoError,
}: RewardFormProps) => {
  const eventDataRes = useGetEvent();
  const { editOptions, eventData, resetReward, errors, setEventData } = useCreateEventStore((state) => ({
    editOptions: state.edit,
    eventData: state.eventData,
    resetReward: state.resetReward,
    errors: state.rewardStepErrors,
    setEventData: state.setEventData,
  }));

  useEffect(() => {
    if (eventData?.eventLocationType === "in_person" && eventData?.paid_event?.has_payment === true) {
      setEventData({ secret_phrase: "onton_default_placeholder" });
      setPasswordValue("onton_default_placeholder");
    } else {
      setEventData({ secret_phrase: "" });
    }
  }, [eventData?.eventLocationType, eventData?.paid_event?.has_payment, setEventData, setPasswordValue]);

  return (
    <>
      {eventData?.eventLocationType === "online" && (
        <ListLayout
          inset={false}
          title="Event password"
        >
          <ListInput
            placeholder="Enter your chosen password"
            name="secret_phrase"
            value={passwordValue}
            info={
              <div className="space-y-1">
                <p>Password is case-insensitive and must be at least 4 characters.</p>
                <p>
                  By setting a password for the event, you can prevent checking-in unexpectedly and receiving a reward
                  without attending the event.
                </p>
              </div>
            }
            inputClassName={cn({
              "text-cn-muted-foreground cursor-pointer": passwordDisabled,
            })}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (passwordDisabled) {
                setPasswordDisabled(false);
                setPasswordValue("");
              }
            }}
            onChange={(e) => {
              Boolean(e?.target?.value?.trim()) && setPasswordValue((e.target.value as string).toLowerCase().trim());
            }}
            error={errors?.secret_phrase?.[0]}
          />
        </ListLayout>
      )}

      {editOptions?.eventHash && (
        <>
          <ListLayout title="SBT Reward">
            {eventDataRes.isSuccess ? (
              <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-2">
                  <h5 className="text-lg font-medium">Reward Image</h5>
                  <Image
                    alt="ts-reward"
                    className="rounded-lg w-full"
                    width={300}
                    height={300}
                    src={eventDataRes.data?.tsRewardImage as string}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <h5 className="text-lg font-medium">Reward Video</h5>
                  <video
                    className="w-full rounded-lg"
                    autoPlay
                    loop
                    width={300}
                    height={300}
                  >
                    <source src={eventDataRes.data?.tsRewardVideo as string} />
                  </video>
                </div>
              </div>
            ) : (
              <Preloader />
            )}
          </ListLayout>
        </>
      )}

      {!editOptions?.eventHash && (
        <ListLayout title="Choose SBT Option">
          <ListItem
            title="Custom Reward"
            after={
              <Toggle
                onChange={() => {
                  if (sbtOption === "custom") {
                    setSbtOption("default");
                  } else {
                    setSbtOption("custom");
                  }
                  resetReward();
                }}
                checked={sbtOption === "custom"}
              />
            }
          />

          <SbtOptionContent
            sbtOption={sbtOption}
            errors={errors || {}}
            clearImageError={clearImageError}
            clearVideoError={clearVideoError}
          />
        </ListLayout>
      )}
    </>
  );
};
