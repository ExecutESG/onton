import { ListItem, Toggle, ListInput } from "konsta/react";
import { UserRoundCheck, ArrowUpToLine, FileUser, Clock } from "lucide-react";
import ListLayout from "../../atoms/cards/ListLayout";
import { useCreateEventStore } from "@/zustand/createEventStore";
import { cn } from "@/utils";

export function UserRegistrationForm() {
  const { setEventData, eventData, editOtions, toggleHasRegistration } = useCreateEventStore((state) => ({
    setEventData: state.setEventData,
    editOtions: state.edit,
    eventData: state.eventData,
    toggleHasRegistration: state.toggleHasRegistration,
  }));

  const isRegistrationDisabled =
    Boolean(editOtions?.eventHash) || eventData?.eventLocationType === "in_person" || eventData.paid_event.has_payment;

  return (
    <ListLayout
      inset={false}
      title="Registration"
      description={
        eventData?.eventLocationType === "in_person" && (
          <p className="text-cn-muted-foreground">User registration is mandatory for in-person events</p>
        )
      }
    >
      <ListItem
        label
        media={<FileUser />}
        title="User Registration"
        footer="Enable user registration to allow attendees to fill out details like name, company, position, and notes during the event sign-up."
        after={
          <Toggle
            onChange={() => toggleHasRegistration()}
            className={cn({
              "opacity-50": isRegistrationDisabled,
            })}
            readOnly={Boolean(editOtions?.eventHash)}
            disabled={isRegistrationDisabled}
            component="div"
            checked={eventData?.has_registration}
          />
        }
      />
      {!eventData.paid_event.has_payment && eventData?.has_registration && (
        <>
          <ListItem
            label
            title="Require Approval"
            media={<UserRoundCheck />}
            after={
              <Toggle
                component="div"
                onChange={() => setEventData({ has_approval: !eventData?.has_approval })}
                checked={eventData?.has_approval}
              />
            }
          />
          {eventData?.eventLocationType !== "in_person" && (
            <ListItem
              label
              title={
                <p className="space-x-4">
                  <span>Capacity</span>
                  <small className={"dark:text-zinc-400"}>{eventData.capacity ? eventData.capacity : "unlimited"}</small>
                </p>
              }
              media={<ArrowUpToLine />}
              after={
                <Toggle
                  onChange={() => {
                    setEventData({ capacity: eventData?.capacity ? null : 100 });
                  }}
                  component="div"
                  checked={eventData?.capacity !== null}
                />
              }
            />
          )}
          {(eventData?.eventLocationType === "in_person" || eventData?.capacity !== null) && (
            <>
              <ListInput
                title="Max Capacity"
                type="number"
                name="capacity"
                inputMode="number"
                onChange={(e) => {
                  const value = e.target.value;
                  const numValue = Number(value);
                  setEventData({ capacity: value === "" ? undefined : numValue >= 1 ? numValue : 1 });
                }}
                value={eventData.capacity ?? 100}
                inputClassName={cn("placeholder:tracking-[.2rem] tracking-widest")}
                placeholder={"100"}
                outline
                info={
                  eventData?.eventLocationType === "in_person"
                    ? "Mandatory venue capacity. Automatically closes registration once capacity is reached."
                    : "Automatically close registration once capacity is reached, counting only approved guests."
                }
              />
              <ListItem
                label
                title={
                  <p className="space-x-4">
                    <span>Over-Capacity</span>
                    <small className="dark:text-zinc-400">waitlist</small>
                  </p>
                }
                footer="Accept registrations over the max-capacity, with approval required for users over capacity."
                media={<Clock />}
                after={
                  <Toggle
                    component="div"
                    checked={eventData.has_waiting_list}
                    onChange={() =>
                      setEventData({
                        has_waiting_list: !eventData.has_waiting_list,
                      })
                    }
                  />
                }
              />
            </>
          )}
        </>
      )}
    </ListLayout>
  );
}
