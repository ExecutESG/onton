"use client";

import { trpc } from "@/app/_trpc/client";
import { EventRegisterSchema } from "@/types";
import { List, ListInput } from "konsta/react";
import { useParams } from "next/navigation";
import React, { useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { useUserStore } from "@/context/store/user.store";
import { isTelegramEnvironment } from "@/lib/platform/platformBridge";
import { useLoginStore } from "@/context/store/login.store";
import { useEventData } from "./eventPageContext";

const UserRegisterForm = () => {
  const params = useParams<{ hash: string }>();
  const registrationForm = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<any>(null);
  const { user } = useUserStore();
  const { openLogin } = useLoginStore();
  const { eventData } = useEventData();

  const [formErrors, setErrors] = useState<{
    full_name?: string[];
    company?: string[];
    position?: string[];
    notes?: string[];
  }>({});

  const defaultFullName = useMemo(() => {
    if (!user) return "";
    const parts = [user.first_name, user.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : user.username ? `@${user.username}` : "";
  }, [user]);

  const [fullName, setFullName] = useState(defaultFullName);

  React.useEffect(() => {
    if (defaultFullName && !fullName) {
      setFullName(defaultFullName);
    }
  }, [defaultFullName]);

  const trpcUtils = trpc.useUtils();
  const registerUser = trpc.registrant.eventRegister.useMutation({
    onError: (error) => {
      toast.error(error.data?.code + ": " + error.message);
    },
    onSuccess(data) {
      trpcUtils.events.getEvent.refetch();
      if (data?.status === "pending") {
        toast.success("Request to join submitted! Waiting for organizer approval.");
      } else {
        toast.success("You have successfully registered!");
      }
    },
  });

  React.useEffect(() => {
    if (user && pendingDataRef.current) {
      registerUser.mutate(pendingDataRef.current);
      pendingDataRef.current = null;
    }
  }, [user]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("onton:registration_loading", { detail: registerUser.isLoading })
      );
    }
  }, [registerUser.isLoading]);

  const handleInputChange = (field: string) => {
    setErrors((prev) => (prev[field as keyof typeof prev] ? { ...prev, [field]: undefined } : prev));
  };

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();

    if (!registrationForm.current || registerUser.isLoading) {
      return;
    }
    const formData = new FormData(registrationForm.current);
    const formObject = Object.fromEntries(formData.entries());
    const registrationData = {
      event_uuid: params.hash,
      ...formObject,
    };

    const parsedData = EventRegisterSchema.safeParse(registrationData);

    if (!parsedData.success) {
      setErrors(parsedData.error.flatten().fieldErrors);
      return;
    }
    setErrors({});

    // If user is unauthenticated on web, prompt 1-click email auth first
    if (!user && !isTelegramEnvironment()) {
      pendingDataRef.current = parsedData.data;
      openLogin();
      return;
    }

    registerUser.mutate(parsedData.data);
  };

  const isApprovalRequired = Boolean(eventData.data?.has_approval);

  return (
    <form
      id="event-registration-form"
      ref={registrationForm}
      onSubmit={handleSubmit}
    >
      <fieldset disabled={registerUser.isLoading} className="border-0 p-0 m-0 w-full disabled:opacity-60">
        <List strongIos className="!my-2">
          <ListInput
            outline
            label="Full Name"
            name="full_name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              handleInputChange("full_name");
            }}
            error={formErrors?.full_name?.[0]}
            placeholder="e.g. Satoshi Nakamoto"
          />
          <ListInput
            outline
            label="Organization / Company"
            name="company"
            onChange={() => handleInputChange("company")}
            error={formErrors?.company?.[0]}
            placeholder="Optional"
          />
          <ListInput
            outline
            label="Role / Position"
            name="position"
            onChange={() => handleInputChange("position")}
            error={formErrors?.position?.[0]}
            placeholder="Optional"
          />
          <ListInput
            outline
            label={isApprovalRequired ? "Reason to Attend / Note" : "Additional Note"}
            name="notes"
            onChange={() => handleInputChange("notes")}
            error={formErrors?.notes?.[0]}
            placeholder="Optional note for organizer"
          />
        </List>
      </fieldset>
      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
    </form>
  );
};

export default UserRegisterForm;
