import { Banner as OnionBanner } from "@/app/(landing-pages)/genesis-onions/_components/Banner";
import Images from "@/app/_components/atoms/images";
import UserCustomRegisterForm from "@/app/_components/Event/UserCustomRegisterForm";
import EventDates from "@/app/_components/EventDates";
import Divider from "@/components/Divider";
import channelAvatar from "@/components/icons/channel-avatar.svg";
import LoadableImage from "@/components/LoadableImage";
import Typography from "@/components/Typography";
import { useUserStore } from "@/context/store/user.store";
import { useLoginStore } from "@/context/store/login.store";
import { useTonConnectModal, useTonWallet } from "@tonconnect/ui-react";
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
import ReportEventButton from "./ReportEventButton";
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

  const isNotPublished = !!eventData.data?.hidden || !eventData.data?.enabled;

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
  const { user } = useUserStore();
  const { openLogin } = useLoginStore();
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
    if (!user) {
      return (
        <CustomCard title="Registration Form">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Typography variant="body" className="text-gray-500 mb-4">
              Please sign in to register for this event.
            </Typography>
            <MainButton
              text="Sign In to Register"
              onClick={openLogin}
              color="primary"
            />
          </div>
        </CustomCard>
      );
    }

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

  const registrantStatus = eventData.data?.registrant_status ?? "";
  const isRegistered = ["approved", "checkedin"].includes(registrantStatus);
  const isPaid = Boolean(
    eventData.data?.has_payment ||
      (eventData.data?.payment_details?.price && eventData.data.payment_details.price > 0)
  );

  const userCompletedTasks =
    (isRegistered || !eventData.data?.has_registration) &&
    user?.wallet_address;

  const isOnlineEvent = eventData.data?.participationType === "online";
  const isCheckedIn = eventData.data?.registrant_status === "checkedin" || isOnlineEvent;
  const isEventActive = isStarted && isNotEnded;

  // Paid event: user has ticket → view ticket pass
  if (isPaid && isRegistered && isNotEnded) {
    return (
      <MainButton
        text="View Ticket Pass"
        onClick={() => router.push(`/tickets/${eventData.data?.event_uuid}`)}
      />
    );
  }

  // Paid event: user hasn't bought ticket yet → checkout
  if (isPaid && !isRegistered && isNotEnded) {
    const price = eventData.data?.payment_details?.price ?? 0;
    const symbol = eventData.data?.payment_details?.token?.symbol ?? "";
    const label = price > 0 ? `Buy Ticket — ${price} ${symbol}` : "Get Free Ticket";
    return (
      <MainButton
        text={label}
        onClick={() => router.push(`/events/${eventData.data?.event_uuid}/checkout`)}
      />
    );
  }

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
  const { openLogin } = useLoginStore();
  const isOnlineEvent = eventData.data?.participationType === "online";
  const isEventActive = isStarted && isNotEnded;
  const userCompletedTasks =
    (["approved", "checkedin"].includes(eventData.data?.registrant_status as string) || !eventData.data?.has_registration) &&
    user?.wallet_address;

  if (!user) {
    if (eventData.data?.has_registration) return null;
    return (
      <CustomCard
        title="Claim Your Reward"
        description="Please sign in and connect your wallet to verify participation and claim rewards."
      >
        <div className="p-4 pt-0">
          <MainButton
            text="Sign In to Claim Reward"
            onClick={openLogin}
            color="primary"
          />
        </div>
      </CustomCard>
    );
  }

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

const ContextualWalletSection = React.memo(() => {
  const { eventData } = useEventData();
  const tonWallet = useTonWallet();
  const walletModal = useTonConnectModal();
  const hasWallet = Boolean(tonWallet?.account.address);
  const registrantStatus = eventData.data?.registrant_status ?? "";
  const isRegistered = registrantStatus !== "" && registrantStatus !== "rejected";
  const isPaid = Boolean(
    eventData.data?.has_payment ||
      (eventData.data?.payment_details?.price && eventData.data.payment_details.price > 0)
  );
  const hasSbt = Boolean(eventData.data?.sbt_collection_address);

  const isStarsOnly = eventData.data?.payment_details?.token?.symbol === "STAR";

  // 1. If user already has a connected wallet, show the standard wallet card
  if (hasWallet) {
    return <ConnectWalletCard />;
  }

  // 2. If the event requires crypto payment, show the wallet card (mandatory for crypto payment)
  if (isPaid && !isStarsOnly) {
    return <ConnectWalletCard />;
  }

  // 3. If user is registered and event has SBT attendance credentials, show contextual claim prompt
  if (isRegistered && hasSbt) {
    return (
      <CustomCard title="Soulbound Attendance Badge" className="w-full !mx-0">
        <div className="p-4 flex flex-col items-center text-center gap-2.5">
          <Typography variant="body" weight="medium" className="text-gray-900 dark:text-gray-100">
            Claim your verified attendance badge on TON
          </Typography>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
            Connect your wallet to receive your soulbound credential (SBT) upon event check-in.
          </p>
          <button
            onClick={() => walletModal.open()}
            type="button"
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition"
          >
            Connect TON Wallet
          </button>
        </div>
      </CustomCard>
    );
  }

  // 4. Free events for unregistered users: Suppress blocking wallet prompt (Progressive Disclosure)
  return null;
});
ContextualWalletSection.displayName = "ContextualWalletSection";

// Main component
export const EventSections = () => {
  const { eventData, eventHash } = useEventData();

  return (
    <div
      className="flex flex-col gap-3 p-4 mx-auto max-w-xl w-full md:rounded-2xl md:shadow-md md:border md:border-gray-200 dark:md:border-gray-800 md:bg-white"
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
      <EventRegistrationStatus />
      <ContextualWalletSection />

      <div className="flex items-center justify-between px-1 pt-1">
        <SupportButtons orgSupportTelegramUserName={eventData.data?.organizer?.org_support_telegram_user_name || undefined} />
        {eventHash && (
          <ReportEventButton
            eventUuid={eventHash}
            eventTitle={eventData.data?.title ?? "Event"}
          />
        )}
      </div>

      {/* --------------------------------------- */}
      {/* ---------- MainButtonHandler ---------- */}
      {/* --------------------------------------- */}
      <MainButtonHandler />
    </div>
  );
};
