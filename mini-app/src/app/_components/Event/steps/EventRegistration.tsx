import { useMainButton } from "@/hooks/useMainButton";
import { useCreateEventStore } from "@/zustand/createEventStore";
import { useSectionStore } from "@/zustand/useSectionStore";
import { useTonWallet } from "@tonconnect/ui-react";
import React, { useLayoutEffect } from "react";
import PaidEventCreationInputs from "./PaidEventCreationInputs";
import { UserRegistrationForm } from "./UserRegistrationForm";
import ListLayout from "../../atoms/cards/ListLayout";
import { ListItem, Toggle } from "konsta/react";
import { Award } from "lucide-react";
import { trpc } from "@/app/_trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IoInformationCircle } from "react-icons/io5";
import { EventDataSchema, UpdateEventDataSchema } from "@/types";

const RegistrationStep = () => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();

  const tonWallet = useTonWallet();
  const { setSection, clearSections } = useSectionStore();

  const { eventData, setEventData, submitMainbutton, isEdit, edit, toggleHasWeb3 } = useCreateEventStore((state) => ({
    eventData: state.eventData,
    setEventData: state.setEventData,
    setCurrentStep: state.setCurrentStep,
    submitMainbutton: state.registrationStepMainButtonClick,
    isEdit: Boolean(state.edit?.eventHash),
    edit: state.edit,
    toggleHasWeb3: state.toggleHasWeb3,
  }));

  const addEvent = trpc.events.addEvent.useMutation({
    onSuccess(data) {
      toast("Event created successfully", {
        icon: <IoInformationCircle />,
        duration: 4000,
      });
      setEventData({});
      router.replace(`/events/${data?.eventHash}/manage`);
      setSection("none");
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  const updateEvent = trpc.events.updateEvent.useMutation({
    onSuccess(data) {
      setEventData({});
      toast("Event updated successfully", {
        icon: <IoInformationCircle />,
        duration: 4000,
      });
      setSection("none");
      router.replace(`/events/${data?.eventId}`);
      clearSections();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  useLayoutEffect(() => {
    if (eventData?.eventLocationType === "in_person") {
      setEventData({ has_registration: true });
    }
  }, []);

  const buttonText = eventData?.has_web3
    ? "Next Step"
    : isEdit
      ? "Update Event"
      : "Create Event";

  useMainButton(() => {
    formRef.current?.requestSubmit();
  }, buttonText);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (eventData.has_web3) {
      setSection("event_setup_form_reward_step");
      submitMainbutton(tonWallet?.account.address || null);
      return;
    }

    // Direct Web2 / Lu.ma-style 3-step publishing:
    const dataToSubmit = {
      ...eventData,
      has_web3: false,
      ts_reward_url: undefined,
      video_url: undefined,
      secret_phrase: eventData?.secret_phrase || "",
    };

    if (isEdit && edit?.eventHash) {
      const updateParsedData = UpdateEventDataSchema.safeParse(dataToSubmit);
      if (updateParsedData.success) {
        updateEvent.mutate({
          event_uuid: edit.eventHash,
          eventData: updateParsedData.data,
        });
      } else {
        const errors = updateParsedData.error.flatten().fieldErrors;
        const errorMessages = Object.entries(errors).flatMap(([field, msgs]) =>
          msgs.map((msg, idx) => (
            <div key={`${field}-${idx}`}>
              {field}: {msg}
            </div>
          ))
        );
        toast.error(errorMessages);
      }
      return;
    }

    const parsedEventData = EventDataSchema.safeParse(dataToSubmit);
    if (parsedEventData.success) {
      addEvent.mutate({
        eventData: parsedEventData.data,
      });
    } else {
      const errors = parsedEventData.error.flatten().fieldErrors;
      const errorMessages = Object.entries(errors).flatMap(([field, msgs]) =>
        msgs.map((msg, idx) => (
          <div key={`${field}-${idx}`}>
            {field}: {msg}
          </div>
        ))
      );
      toast.error(errorMessages);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
    >
      <UserRegistrationForm />

      <ListLayout
        inset={false}
        title="Web3 & Blockchain Credentials"
      >
        <ListItem
          label
          title="Enable Web3 / SBT"
          media={<Award className="w-5 h-5 text-yellow-500" />}
          footer="Issue Soulbound Token (SBT) Proof-of-Attendance credentials on TON and unlock on-chain ticketing."
          after={
            <Toggle
              component="div"
              checked={Boolean(eventData.has_web3)}
              onChange={() => toggleHasWeb3()}
            />
          }
        />
      </ListLayout>

      {eventData.has_web3 && <PaidEventCreationInputs />}
    </form>
  );
};

export default RegistrationStep;
