import { Banner as OnionBanner } from "@/app/(landing-pages)/genesis-onions/_components/Banner";
import Images from "@/app/_components/atoms/images";
import UserCustomRegisterForm from "@/app/_components/Event/UserCustomRegisterForm";
import EventDates from "@/app/_components/EventDates";
import Divider from "@/components/Divider";
import channelAvatar from "@/components/icons/channel-avatar.svg";
import LoadableImage from "@/components/LoadableImage";
import Typography from "@/components/Typography";
import { useUserStore } from "@/context/store/user.store";
import { Address } from "@ton/core";
import { Block, List, ListItem } from "konsta/react";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { FaAngleRight } from "react-icons/fa6";
import SupportButtons from "../atoms/buttons/SupportButton";
import MainButton from "../atoms/buttons/web-app/MainButton";
import CustomCard from "../atoms/cards/CustomCard";
import DataStatus from "../molecules/alerts/DataStatus";
import { ConnectWalletCard } from "../organisms/ConnectWallet";
import EventKeyValue from "../organisms/events/EventKewValue";
import ShareEventButton from "../ShareEventButton";
import { ClaimRewardButton } from "./ClaimRewardButton";
import { EventActions } from "./EventActions";
import { useEventData } from "./eventPageContext";
import { EventPasswordAndWalletInput } from "./EventPasswordInput";
import { ManageEventButton } from "./ManageEventButton";
import PreRegistrationTasks from "./PreRegistrationTasks";
import UserRegisterForm from "./UserRegisterForm";

// Base components with memoization where beneficial
const EventImage = React.memo(() => {
  const { eventData } = useEventData();
  return (
    <Images.Event
      width={300}
      height={300}
      url={eventData.data?.image_url ?? ""}
    />
  );
});

EventImage.displayName = "EventImage";

const EventSubtitle = React.memo(() => {
  const { eventData } = useEventData();
  return (
    <Typography
      variant="body"
      weight="medium"
    >
      {eventData.data?.subtitle}
    </Typography>
  );
});
EventSubtitle.displayName = "EventSubtitle";

const EventLocation = React.memo(() => {
  const { location, isLocationUrl } = useEventData();
  if (!location || isLocationUrl) return null;

  return (
    <EventKeyValue
      label="Location"
      value={location}
      className="text-cn-primary text-[14px]"
    />
  );
});
EventLocation.displayName = "EventLocation";

const EventLink = React.memo(() => {
  const { location, isLocationUrl, eventData } = useEventData();
  if (!location || !isLocationUrl) return null;

  return (
    <EventKeyValue
      variant="link"
      label="Event Link"
      value={
        eventData.data?.has_registration && !["approved", "checkedin"].includes(eventData.data.registrant_status)
          ? "Visible after registration"
          : location
      }
    />
  );
});
EventLink.displayName = "EventLink";

const EventCategory = React.memo(() => {
  const { eventData } = useEventData();
  if (!eventData.data?.category_id) return null;

  return (
    <EventKeyValue
      variant="link"
      label="Category"
      href={"/search?" + new URLSearchParams({ selected_category: eventData.data.category_id.toString() }).toString()}
      value={eventData.data.category.name}
    />
  );
});
EventCategory.displayName = "EventWebsiteLink";

const EventWebsiteLink = React.memo(() => {
  const { eventData } = useEventData();
  if (!eventData.data?.website) return null;

  return (
    <EventKeyValue
      variant="link"
      label="website"
      value={eventData.data.website.link}
    />
  );
});
EventCategory.displayName = "EventWebsiteLink";

const EventTicketPrice = React.memo(() => {
  return (
    <EventKeyValue
      label="Ticket Price"
      value={"Free"}
    />
  );
});
EventTicketPrice.displayName = "EventTicketPrice";

const EventDatesComponent = React.memo(() => {
  const { startUTC, endUTC } = useEventData();
  return (
    <EventDates
      startDate={startUTC}
      endDate={endUTC}
    />
  );
});

EventDatesComponent.displayName = "EventDatesComponent";

const EventDescription = React.memo(() => {
  const { eventData } = useEventData();
  return (
    <CustomCard title={"About"}>
      <Typography
        weight="normal"
        variant={"body"}
        className="p-4 pt-0 whitespace-pre-line"
      >
        {eventData.data?.description ?? ""}
      </Typography>
    </CustomCard>
  );
});

EventDescription.displayName = "EventDescription";

const EventTitle = React.memo(() => {
  const { eventHash, eventData } = useEventData();

  const isNotPublished = !eventData.data?.activity_id || !!eventData.data?.hidden;

  return (
    <div className="mt-4 space-y-4">
      {isNotPublished && (
        <div className="text-sky-500 text-lg font-semibold">Event is not published and pending moderation!</div>
      )}
      <div className="grid grid-cols-12 items-start">
        <Typography
          variant="title2"
          weight="bold"
          className="self-center col-span-10"
        >
          {eventData.data?.title ?? ""}
        </Typography>
        <div className="col-span-2">
          <ShareEventButton
            event_uuid={eventHash}
            activity_id={eventData.data?.activity_id}
            hidden={eventData.data?.hidden}
          />
        </div>
      </div>
      <EventSubtitle />
    </div>
  );
});
EventTitle.displayName = "EventHead";

const EventAttributes = React.memo(() => {
  return (
    <div className="flex flex-col gap-4">
      <EventLocation />
      <EventLink />
      <EventTicketPrice />
      <EventDatesComponent />
      <EventWebsiteLink />
      <EventCategory />
    </div>
  );
});
EventAttributes.displayName = "EventAttributes";

// Status component to handle different event states
const EventRegistrationStatus = () => {
  const { eventData, isNotEnded } = useEventData();
  const registrantStatus = eventData.data?.registrant_status ?? "";
  const capacityFilled = Boolean(eventData.data?.capacity_filled);
  const hasWaitingList = Boolean(eventData.data?.has_waiting_list);

  if (!isNotEnded || !eventData.data?.has_registration) {
    return null;
  }

  const isCustom = Boolean(eventData.data?.registrationFromSchema?.isCustom);
  console.log(
    "EventRegistrationStatus: hasWaitingList or !capacityFilled and registrantStatus === ''",
    registrantStatus,
    hasWaitingList,
    capacityFilled
  );
  if ((hasWaitingList || !capacityFilled) && registrantStatus === "") {
    return isCustom ? (
      <CustomCard title={"Registration Form"}>
        <UserCustomRegisterForm />
      </CustomCard>
    ) : (
      <CustomCard title={"Registration Form"}>
        <UserRegisterForm />
      </CustomCard>
    );
  }

  return (
    <CustomCard defaultPadding>
      {capacityFilled && !hasWaitingList && (
        <>
          <DataStatus
            status="rejected"
            title="Capacity Filled"
            description="Event capacity is filled and no longer accepts registrations."
            size="md"
          />
          <MainButton
            text="Event Capacity Filled"
            disabled
            color="secondary"
          />
        </>
      )}

      {!capacityFilled && (
        <>
          {registrantStatus === "pending" && (
            <DataStatus
              status="sent"
              title="Request Pending"
              description="Your request to join this event is pending to be approved."
              size="md"
            />
          )}
          {registrantStatus === "approved" && (
            <DataStatus
              status="approved"
              title="Request Approved"
              description="Your request to join this event has been approved."
              size="md"
            />
          )}
          {registrantStatus === "rejected" && (
            <DataStatus
              status="rejected"
              title="Request Rejected"
              description="Your request to join this event has been rejected."
              size="md"
            />
          )}
          {registrantStatus === "checkedin" && <div></div>}
        </>
      )}
    </CustomCard>
  );
};

const OrganizerCard = React.memo(() => {
  const { eventData } = useEventData();
  const router = useRouter();

  const organizer = eventData?.data?.organizer;

  if (!organizer) return null;

  return (
    <CustomCard
      title={"Organizer"}
      className="!pb-2"
    >
      <List className="!mb-0 !-mt-2">
        <ListItem
          className="cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            router.push(`/channels/${eventData.data?.owner}/`);
          }}
          title={
            <Typography
              variant="headline"
              weight="medium"
              className="text-primary w-52"
              truncate
            >
              {organizer.org_channel_name || "Untitled organizer"}
            </Typography>
          }
          subtitle={
            <Typography
              weight={"medium"}
              variant="subheadline1"
              className="text-brand-muted"
            >
              {organizer.hosted_event_count || 0} events
            </Typography>
          }
          media={
            <LoadableImage
              alt={organizer.org_channel_name}
              src={organizer.org_image || channelAvatar.src}
              width={48}
              height={48}
            />
          }
          after={<FaAngleRight className="text-primary" />}
        />
      </List>
    </CustomCard>
  );
});
OrganizerCard.displayName = "OrganizerCard";

const SbtCollectionLink = React.memo(() => {
  const { eventData } = useEventData();

  const collectionAddress = eventData.data?.sbt_collection_address;

  const isValidAddress = useMemo(() => {
    try {
      if (!collectionAddress) return false;
      Address.parse(collectionAddress);
      return true;
    } catch {
      return false;
    }
  }, [collectionAddress]);

  if (!isValidAddress) return null;

  return (
    <CustomCard
      title={"SBTs"}
      description="Reward you receive by attending the event and submitting proof of attendance."
    >
      <Block
        className="!mt-0 mb-4 cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          window.open(`https://getgems.io/collection/${collectionAddress}`, "_blank");
        }}
      >
        <div className="w-full flex gap-2 items-stretch bg-brand-fill-bg/10 p-2 rounded-lg">
          {eventData.data?.tsRewardImage && (
            <LoadableImage
              alt={eventData.data?.title}
              src={eventData.data?.tsRewardImage}
              width={48}
              height={48}
            />
          )}
          <div className="flex flex-col grow justify-between overflow-hidden">
            <Typography
              variant="headline"
              truncate
              weight="normal"
              className="line-clamp-2"
            >
              {eventData.data?.title}
            </Typography>
            <Typography
              variant="subheadline1"
              className="text-brand-muted"
              truncate
              weight={"medium"}
            >
              {collectionAddress}
            </Typography>
          </div>
        </div>
      </Block>
    </CustomCard>
  );
});
SbtCollectionLink.displayName = "SbtCollectionLink";

const MainButtonHandler = React.memo(() => {
  const { eventData, hasEnteredPassword, isStarted, isNotEnded, initData } = useEventData();
  const { user } = useUserStore();
  const router = useRouter();

  const userCompletedTasks =
    (["approved", "checkedin"].includes(eventData.data?.registrant_status!) || !eventData.data?.has_registration) &&
    user?.wallet_address;

  const isOnlineEvent = eventData.data?.participationType === "online";
  const isCheckedIn = eventData.data?.registrant_status === "checkedin" || isOnlineEvent;
  const isEventActive = isStarted && isNotEnded;

  if (userCompletedTasks && hasEnteredPassword) {
    if (isCheckedIn) {
      return (
        <PreRegistrationTasks>
          <ClaimRewardButton
            initData={initData}
            eventId={eventData.data?.event_uuid ?? ""}
          />
        </PreRegistrationTasks>
      );
    } else if (isEventActive && eventData.data?.registrant_uuid) {
      return (
        <MainButton
          text="Check In"
          onClick={() => {
            router.push(`/events/${eventData.data?.event_uuid}/registrant/${eventData.data?.registrant_uuid}/qr`);
          }}
        />
      );
    }
  }

  if (!isStarted && isNotEnded) {
    return (
      <MainButton
        text="Event Not Started Yet"
        disabled
        color="secondary"
      />
    );
  } else if (!isNotEnded) {
    return (
      <MainButton
        text="Event Has Ended"
        disabled
        color="secondary"
      />
    );
  }

  return null;
});
MainButtonHandler.displayName = "MainButtonHandler";

const EventPassword = React.memo(() => {
  const { eventData, hasEnteredPassword, isStarted, isNotEnded } = useEventData();
  const { user } = useUserStore();
  const isOnlineEvent = eventData.data?.participationType === "online";
  const isEventActive = isStarted && isNotEnded;
  const userCompletedTasks =
    (["approved", "checkedin"].includes(eventData.data?.registrant_status as string) || !eventData.data?.has_registration) &&
    user?.wallet_address;

  if (!((userCompletedTasks && !hasEnteredPassword && isEventActive && isOnlineEvent) || !user?.wallet_address)) return null;

  if (eventData.data?.has_registration) return null;

  return (
    <CustomCard
      title="Claim Your Reward"
      description="Enter the Event Password that the organizer shared to confirm your participation in the event."
    >
      <div className="p-4 pt-0">
        <EventPasswordAndWalletInput />
      </div>
    </CustomCard>
  );
});
EventPassword.displayName = "EventPassword";

const EventHeader = React.memo(() => {
  const { eventData, hasEnteredPassword, isStarted, isNotEnded } = useEventData();
  const { user } = useUserStore();

  const userCompletedTasks =
    (["approved", "checkedin"].includes(eventData.data?.registrant_status!) || !eventData.data?.has_registration) &&
    user?.wallet_address;

  const isOnlineEvent = eventData.data?.participationType === "online";
  const isEventActive = isStarted && isNotEnded;

  return (
    <>
      <CustomCard defaultPadding>
        <EventImage />

        <EventTitle />
        <Divider margin="medium" />
        <EventAttributes />

        <EventActions />
      </CustomCard>

      {/* Removed inline claim reward JSX, now handled by <EventPassword /> */}
    </>
  );
});
EventHeader.displayName = "EventHeader";

// Main component
export const EventSections = () => {
  const { eventData } = useEventData();

  return (
    <div
      className="flex flex-col gap-3 p-4"
      style={{
        paddingBottom: "calc(var(--tg-safe-area-inset-bottom) + 4rem)",
      }}
    >
      <EventHeader />
      <EventDescription />
      <OnionBanner />
      <EventPassword />
      <ManageEventButton />
      <OrganizerCard />
      <SbtCollectionLink />
      <ConnectWalletCard />
      <EventRegistrationStatus />

      <SupportButtons orgSupportTelegramUserName={eventData.data?.organizer?.org_support_telegram_user_name || undefined} />

      {/* --------------------------------------- */}
      {/* ---------- MainButtonHandler ---------- */}
      {/* --------------------------------------- */}
      <MainButtonHandler />
    </div>
  );
};
