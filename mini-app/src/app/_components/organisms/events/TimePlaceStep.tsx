"use client";
import TimePlaceForm from "@/app/_components/Event/steps/TimePlaceForm";
import { useMainButton } from "@/hooks/useMainButton";
import { timeplaceStepValidation } from "@/zodSchema/event/validation";
import { dataValidationSchema } from "@/zodSchema/dataValidationSchema";
import { useCreateEventStore } from "@/zustand/createEventStore";
import { useSectionStore } from "@/zustand/useSectionStore";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export const TimePlaceStep = () => {
  const formRef = useRef<HTMLFormElement>(null);

  const { setSection } = useSectionStore();
  const setCurrentStep = useCreateEventStore((state) => state.setCurrentStep);
  const setEventData = useCreateEventStore((state) => state.setEventData);
  const editOptions = useCreateEventStore((state) => state.edit);
  const eventData = useCreateEventStore((state) => state.eventData);
  const setErrors = useCreateEventStore((state) => state.setTimePlaceStepErrors);
  const clearErrors = useCreateEventStore((state) => state.clearTimePlaceStepErrors);

  const startDateLimit = (Date.now() - 1000 * 3600 * 4) / 1000; // 4 hours before now

  let lastToastIdRef = useRef<string | number | null>(null); // Store the ID of the last toast using a ref

  const handleSubmit = () => {
    if (!formRef.current) {
      return;
    }
    const formData = new FormData(formRef.current);
    const formDataObject = Object.fromEntries(formData.entries()) as Record<string, any>;

    formDataObject.start_date = new Date(formDataObject?.start_date).getTime() / 1000;
    formDataObject.end_date = new Date(formDataObject?.end_date).getTime() / 1000;
    formDataObject.duration = (formDataObject.end_date || 0) - (formDataObject.start_date || 0);
    formDataObject.timezone = eventData?.timezone || "";
    formDataObject.eventLocationType = eventData?.eventLocationType || "online";
    formDataObject.cityId = eventData?.cityId ? Number(eventData.cityId) : undefined;
    formDataObject.countryId = eventData?.countryId ? Number(eventData.countryId) : undefined;

    if (formDataObject.eventLocationType === "online" && typeof formDataObject.location === "string") {
      const parsedUrl = dataValidationSchema.urlSchema.safeParse(formDataObject.location);
      if (parsedUrl.success) {
        formDataObject.location = parsedUrl.data;
      }
    }

    const secondStepDataSchema = timeplaceStepValidation(editOptions, startDateLimit, eventData, formDataObject);

    const formDataParsed = secondStepDataSchema.safeParse(formDataObject);

    if (!formDataParsed.success) {
      setErrors(formDataParsed.error.flatten().fieldErrors);

      const flattenedErrors = formDataParsed.error.flatten().fieldErrors;
      const errorMessages = Object.values(flattenedErrors)
        .flat()
        .map((v, i) => <div key={i}>* {v}</div>);

      // Dismiss the previous error toast, if any
      if (lastToastIdRef.current) {
        toast.dismiss(lastToastIdRef.current); // Correctly dismissing the last toast using ref
      }

      // Show new toast with errors
      lastToastIdRef.current = toast.error(errorMessages, {
        duration: 3000, // Set duration for 5 seconds
      });

      return;
    }

    const data = formDataParsed.data;

    setEventData(data);
    clearErrors();
    setCurrentStep(3);
    setSection("event_setup_form_registration_setup");
  };

  useEffect(() => {
    setEventData({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      eventLocationType: eventData?.eventLocationType || "online",
    });
  }, [eventData?.eventLocationType, setEventData]);

  useMainButton(() => {
    formRef.current?.requestSubmit();
  }, "Next Step");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      ref={formRef}
    >
      <TimePlaceForm />
    </form>
  );
};
