import { trpc } from "@/app/_trpc/client";
import { TG_SUPPORT_GROUP } from "@/constants";
import { useConfig } from "@/context/ConfigContext";
import useWebApp from "@/hooks/useWebApp";
import { sleep } from "@/utils";
import { FC, ReactNode, useEffect, useState } from "react";
import CustomButton from "../Button/CustomButton";
import CustomSheet from "../Sheet/CustomSheet";
import Task from "../Task";
import MainButton from "../atoms/buttons/web-app/MainButton";
import { useEventData } from "./eventPageContext";

const PreRegistrationTasks: FC<{ children: ReactNode }> = (props) => {
  const webApp = useWebApp();
  const config = useConfig();
  const { eventData } = useEventData();

  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const joinTaskStatus = trpc.users.joinOntonTasks.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  // Removed localStorage functionality; default to "not_done"
  const [isJoinedX, setJoinedX] = useState<"done" | "not_done" | "checking">("checking");

  const allTasksDone = joinTaskStatus.data?.all_done && isJoinedX === "done";

  // if it was not ts verified and lock was not set we will show it
  const areTasksRequired = !eventData.data?.organizer?.is_ts_verified && !config.tjo;
  console.log("areTasksRequired: ", areTasksRequired, eventData.data?.organizer?.is_ts_verified, config.tjo);

  const closeTasksOpen = () => {
    setIsTasksOpen(false);
  };

  useEffect(() => {
    if (joinTaskStatus.data?.all_done) {
      setJoinedX("done");
    } else {
      setJoinedX("not_done");
    }
  }, [joinTaskStatus.data?.all_done]);

  if (areTasksRequired && !joinTaskStatus.isFetched && joinTaskStatus.isLoading) {
    return <MainButton progress />;
  }

  if (areTasksRequired && (!joinTaskStatus.data?.all_done || isJoinedX !== "done" || isTasksOpen)) {
    return (
      <>
        {!isTasksOpen && (
          <MainButton
            text="Complete tasks to Attend"
            onClick={() => {
              setIsTasksOpen(true);
            }}
          />
        )}

        <CustomSheet
          title="Pre-registration tasks"
          opened={isTasksOpen}
          onClose={closeTasksOpen}
        >
          <div className="space-y-4">
            <Task
              title="ONTON Community Chat"
              status={joinTaskStatus.isFetching ? "checking" : !!joinTaskStatus.data?.gp ? "done" : "not_done"}
              onClick={() => {
                webApp?.openTelegramLink(TG_SUPPORT_GROUP);
              }}
            />
            <Task
              title="ONTON Announcement Channel"
              status={joinTaskStatus.isFetching ? "checking" : !!joinTaskStatus.data?.ch ? "done" : "not_done"}
              onClick={() => {
                webApp?.openTelegramLink("https://t.me/ontonlive");
              }}
            />
            <Task
              title="Follow ONTON on X"
              status={
                joinTaskStatus.isFetching || isJoinedX === "checking"
                  ? "checking"
                  : joinTaskStatus.data?.ch && joinTaskStatus.data?.gp
                    ? "done"
                    : isJoinedX === "done"
                      ? "done"
                      : "not_done"
              }
              onClick={async () => {
                setJoinedX("checking");
                webApp?.openLink("https://x.com/ontonbot");
                await sleep(30000);
                setJoinedX("done");
              }}
            />
          </div>
          <div className="mt-6">
            <CustomButton
              variant={allTasksDone ? undefined : "outline"}
              onClick={(e) => {
                closeTasksOpen();
              }}
            >
              Close
            </CustomButton>
          </div>
        </CustomSheet>
      </>
    );
  }

  return <>{props.children}</>;
};

export default PreRegistrationTasks;
