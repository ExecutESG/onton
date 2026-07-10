import { trpc } from "@/app/_trpc/client";
import { useUserStore } from "@/context/store/user.store";
import { useGetEvent } from "@/hooks/events.hooks";
import useWebApp from "@/hooks/useWebApp";
import { useEffect, useMemo, useState } from "react";
import zod from "zod";
import { ErrorState } from "../ErrorState";
import { EventDataContext } from "./eventPageContext";

export const EventDataProvider = ({ children, eventHash }: { children: React.ReactNode; eventHash: string }) => {
  const webApp = useWebApp();
  const trpcUtils = trpc.useUtils();
  const currentUser = useUserStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [initData, setInitData] = useState<string>("");

  const userEventFields = trpc.userEventFields.getUserEventFields.useQuery(
    {
      event_hash: eventHash,
    },
    {
      queryKey: [
        "userEventFields.getUserEventFields",
        {
          event_hash: eventHash,
        },
      ],
      enabled: Boolean(eventHash) && !!currentUser.user, // Run the query only if user is logged in
    }
  );

  useEffect(() => {
    if (userEventFields.isSuccess) {
      trpcUtils.users.getVisitorReward.invalidate({}, { refetchType: "all" });
    }
  }, [userEventFields.isSuccess, userEventFields.data, trpcUtils.users.getVisitorReward]);

  useEffect(() => {
    if (webApp?.initData && !isInitialized) {
      setInitData(webApp.initData);
      setIsInitialized(true);
    }
  }, [webApp?.initData, isInitialized]);

  const eventData = useGetEvent();

  const eventPasswordField = useMemo(() => {
    return eventData.data?.dynamic_fields?.find((v) => v.title === "secret_phrase_onton_input");
  }, [eventData.data?.dynamic_fields]);

  const { isLocationUrl, endUTC, startUTC, location } = useMemo(() => {
    if (!eventData.data) {
      return {
        isLocationUrl: false,
        endUTC: 0,
        startUTC: 0,
      };
    }
    const startUTC = Number(eventData.data.start_date) * 1000;
    const endUTC = Number(eventData.data.end_date) * 1000;

    const location = eventData.data.location;
    const urlSchema = zod.string().url();
    const { success } = urlSchema.safeParse(location);
    return {
      endUTC,
      isLocationUrl: success,
      startUTC,
      location,
    };
  }, [eventData.data]);

  const userEventPasswordField = useMemo(() => {
    if (eventPasswordField?.id) {
      return userEventFields.data?.[eventPasswordField.id];
    }
  }, [eventPasswordField?.id, userEventFields.data]);

  if (eventData.isError) {
    // KNOWN ERRORS
    if (eventData.error.data?.code === "NOT_FOUND") {
      return <ErrorState errorCode="event_not_found" />;
    } else if (eventData.error.data?.code === "UNPROCESSABLE_CONTENT") {
      return <ErrorState errorCode="event_not_published" />;
    }
    // ELSE
    return <ErrorState errorCode="something_went_wrong" />;
  }

  return (
    <EventDataContext.Provider
      value={{
        eventData,
        isNotEnded: Boolean(eventData.data?.isNotEnded),
        isStarted: Boolean(eventData.data?.isStarted),
        endUTC,
        hasEnteredPassword: Boolean(eventData.data?.participationType === "in_person" || userEventPasswordField?.completed),
        startUTC,
        location,
        initData,
        eventHash,
        userEventFields,
        isLocationUrl,
        eventPasswordField,
        userEventPasswordField,
        accessRoles: eventData.data?.accessRoles,
        registrationFromSchema: eventData.data?.registrationFromSchema,
      }}
    >
      {children}
    </EventDataContext.Provider>
  );
};
