import { ErrorMessage } from "@/app/_components/molecules/alerts/ErrorMessage";
import { useMainButton } from "@/hooks/useMainButton";
import { generalStepDataSchema } from "@/zodSchema/event/validation";
import { useCreateEventStore } from "@/zustand/createEventStore";
import { useSectionStore } from "@/zustand/useSectionStore";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import BasicEventInputs from "../../Event/steps/BasicEventInputs";

let lastToastId: string | number | null = null;

export const GeneralStep = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const { setSection } = useSectionStore();

  const { setCurrentStep, setEventData, eventData, clearGeneralErrors, setGeneralStepErrors } = useCreateEventStore(
    (state) => ({
      setCurrentStep: state.setCurrentStep,
      currentStep: state.currentStep,
      setEventData: state.setEventData,
      eventData: state.eventData,
      clearGeneralErrors: state.clearGeneralStepErrors,
      setGeneralStepErrors: state.setGeneralStepErrors,
    })
  );
  const { edit: editOptions } = useCreateEventStore();
  const [termsChecked, _setTermsChecked] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);

  const setTermsChecked = (checked: boolean) => {
    if (checked) setShowTermsError(false);
    _setTermsChecked(checked);
  };

  // TODO: eventData is updated multiple times during each render
  // useEffect(() => {
  //   if (!eventData?.start_date) return
  //   setTermsChecked(true)
  // }, [eventData?.event_uuid])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    if (!termsChecked && !editOptions?.eventHash) {
      toast.error("Please agree to the terms and conditions to continue.");
      return;
    }

    const formData = new FormData(formRef.current);
    formData.append("image_url", eventData?.image_url || "");

    const formDataObject = Object.fromEntries(formData.entries());
    const formDataParsed = generalStepDataSchema.safeParse({
      ...formDataObject,
      category_id: Number(formDataObject.category_id),
    });

    if (!formDataParsed.success) {
      const flattenedErrors = formDataParsed.error.flatten().fieldErrors;
      setGeneralStepErrors(flattenedErrors);

      const errorMessages = Object.entries(flattenedErrors)
        .filter(([, messages]) => messages && messages.length > 0)
        .map(([field, messages]) => (
          <ErrorMessage
            key={field}
            message={messages![0]}
          />
        ));

      if (lastToastId) {
        toast.dismiss(lastToastId);
      }

      lastToastId = toast.error(<div>{errorMessages}</div>, { duration: 3000 });
      return;
    }

    setEventData(formDataParsed.data);
    clearGeneralErrors();
    setCurrentStep(2);
    setSection("event_setup_form_time_place_step");
  };

  useMainButton(() => {
    formRef.current?.requestSubmit();
  }, "Next Step");

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
    >
      <BasicEventInputs
        showTermsError={showTermsError}
        termsChecked={termsChecked}
        setTermsChecked={setTermsChecked}
      />
    </form>
  );
};
