"use client";

import { Block } from "konsta/react";
import { useParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { type RouterOutput } from "@/server";

import Stepper from "@/app/_components/molecules/stepper";

import { useSectionStore } from "@/zustand/useSectionStore";
// We keep createEventStore for storing data (like setEventData, setEdit, etc.)
import { useCreateEventStore } from "@/zustand/createEventStore";

// The 4-step components
import RegistrationStep from "../../Event/steps/EventRegistration";
import { GeneralStep } from "./GeneralStep";
import { RewardStep } from "./RewardStep";
import { TimePlaceStep } from "./TimePlaceStep";

type ManageEventProps = {
  event?: RouterOutput["events"]["getEvent"];
};

const steps = [
  { icon: <span>1</span>, label: "General" },
  { icon: <span>2</span>, label: "Time/place" },
  { icon: <span>3</span>, label: "Registration" },
  { icon: <span>4</span>, label: "Reward" },
];

/**
 * We unify the step logic via "edit_event_step1" ... "edit_event_step4" in useSectionStore.
 * Then we map those to numeric step indexes for Stepper.
 */
function ManageEvent({ event }: ManageEventProps) {
  const params = useParams<{ hash: string }>();

  // We read from createEventStore for data, but no step logic from here
  const { setEdit, setEventData, resetState, clearGeneralStepErrors, eventData } = useCreateEventStore((state) => ({
    setEdit: state.setEdit,
    setEventData: state.setEventData,
    resetState: state.resetState,
    clearGeneralStepErrors: state.clearGeneralStepErrors,
    eventData: state.eventData,
  }));

  // Instead of currentStep, we read from our single store:
  const { getCurrentSection } = useSectionStore();
  // We'll track if we finished calling resetState so we can safely set data
  const [isReset, setIsReset] = useState(false);

  // 1) Clear errors on mount
  useEffect(() => {
    clearGeneralStepErrors();
  }, [clearGeneralStepErrors]);

  // TODO: This is cancer!
  useLayoutEffect(() => {
    resetState();
    setIsReset(true);

    if (params.hash && isReset) {
      setEdit({ eventHash: params.hash });

      if (event) {
        setEventData({
          title: event.title || undefined,
          description: event.description || undefined,
          image_url: event.image_url || undefined,
          subtitle: event.subtitle || undefined,
          start_date: event.start_date || undefined,
          end_date: event.end_date || undefined,
          location: event.location || undefined,
          category_id: event.category_id || undefined,
          // @ts-ignore
          society_hub: event.society_hub
            ? {
                id: event.society_hub.id,
                name: event.society_hub.name,
              }
            : undefined,
          eventLocationType: event.participationType,
          countryId: event.countryId || undefined,
          cityId: event.cityId || undefined,
          ts_reward_url: event.tsRewardImage || undefined,

          // Registration
          has_registration: Boolean(event.has_registration),
          has_approval: Boolean(event.has_approval),
          capacity: event.capacity || null,
          has_waiting_list: Boolean(event.has_waiting_list),
          // Payment
          paid_event: {
            token_id: event.payment_details?.token_id,
            payment_recipient_address: event.payment_details?.recipient_address,
            nft_description: event.payment_details?.description || undefined,
            nft_title: event.payment_details?.title || undefined,
            has_payment: Boolean(event.payment_details?.token_id),
            payment_amount: event.payment_details?.price,
            nft_image_url: event.payment_details?.ticketImage || undefined,
            bought_capacity: event.payment_details?.bought_capacity,
          },
        });
      }
    }
  }, [params.hash, event, isReset, resetState, setEdit, setEventData]);

  if (params?.hash && !eventData) {
    return <div>Loading...</div>;
  }

  // 3) Convert currentSection => numeric step for Stepper
  const getStepIndex = (section: string) => {
    switch (section) {
      case "event_setup_form_general_step":
        return 1;
      case "event_setup_form_time_place_step":
        return 2;
      case "event_setup_form_registration_setup":
        return 3;
      case "event_setup_form_reward_step":
        return 4;
      default:
        return 1;
    }
  };

  // We'll read the numeric step from the store's currentSection
  const stepIndex = getStepIndex(getCurrentSection());

  // 4) Render the Stepper & the relevant step content
  return (
    <>
      <Block className="!-mb-2">
        <Stepper
          steps={steps}
          currentStep={stepIndex}
        />
      </Block>

      <Block className="!p-0">
        {isReset && stepIndex === 1 && <GeneralStep />}
        {isReset && stepIndex === 2 && <TimePlaceStep />}
        {isReset && stepIndex === 3 && <RegistrationStep />}
        {isReset && stepIndex === 4 && <RewardStep />}
      </Block>
    </>
  );
}

export default ManageEvent;
