import { Banner as OnionBanner } from "@/app/(landing-pages)/genesis-onions/_components/Banner";
import Images from "@/app/_components/atoms/images";
import CustomButton from "@/app/_components/Button/CustomButton";
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
import { ClaimSbtButton } from "@/app/tickets/[id]/_components/ClaimSbtButton";
import { trpc } from "@/app/_trpc/client";
import ReportEventButton from "./ReportEventButton";
import { EventActions } from "./EventActions";
import { useEventData } from "./eventPageContext";
import { EventPasswordAndWalletInput } from "./EventPasswordInput";
import { ManageEventButton } from "./ManageEventButton";
import { getAttendeeMainButtonState } from "./getAttendeeMainButtonState";
import FoundingOrganizerBadge from "@/app/_components/FoundingOrganizerBadge";
import UserRegisterForm from "./UserRegisterForm";
import BadgeDetailModal, { BadgeItemData } from "@/components/sbt/BadgeDetailModal";
import { ShieldCheck, Award } from "lucide-react";

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
  const { eventData } = useEventData();
  const tiers = (eventData.data?.ticket_tiers as Array<{ price: number }>) || [];

  let priceDisplay = "Free";
  if (tiers.length > 0) {
    const prices = tiers.map((t) => Number(t.price || 0));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (maxPrice === 0) {
      priceDisplay = "Free";
    } else if (minPrice === 0) {
      priceDisplay = `Free – ⭐ ${maxPrice}`;
    } else if (minPrice === maxPrice) {
      priceDisplay = `⭐ ${minPrice}`;
    } else {
      priceDisplay = `From ⭐ ${minPrice}`;
    }
  } else if (eventData.data?.has_payment) {
    const ticket = eventData.data?.payment_details;
    const price = Number(ticket?.price || 0);
    const symbol = ticket?.token?.symbol || (ticket?.ticket_type === "TSCSBT" ? "⭐" : "TON");
    if (price > 0) {
      priceDisplay = symbol === "STAR" || symbol === "⭐" ? `⭐ ${price}` : `${price} ${symbol}`;
    }
  }

  return (
    <EventKeyValue
      label="Ticket Price"
      value={priceDisplay}
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

  const tiers = (eventData.data?.ticket_tiers as Array<{ price: number }>) || [];
  const hasPaidTiers = tiers.some((t) => Number(t.price || 0) > 0);
  const isPaid = Boolean(
    eventData.data?.has_payment ||
      hasPaidTiers ||
      (eventData.data?.payment_details?.price && eventData.data.payment_details.price > 0)
  );

  if (!isNotEnded || !eventData.data?.has_registration || isPaid) {
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
        <CustomCard title="Registration">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Typography variant="body" className="text-gray-500">
              Please sign in to register for this event.
            </Typography>
          </div>
        </CustomCard>
      );
    }

    return (
      <CustomCard title={eventData.data?.has_approval ? "Request to Join" : "Registration Form"}>
        <UserRegisterForm />
      </CustomCard>
    );
  }

  return (
    <CustomCard defaultPadding>
      {capacityFilled && !hasWaitingList && (
        <DataStatus
          status="rejected"
          title="Capacity Filled"
          description="Event capacity is filled and no longer accepts registrations."
          size="md"
        />
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
              title="Registration Confirmed"
              description="Your registration has been approved. Use the button below to view your check-in pass."
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
            <div className="flex items-center gap-2 flex-wrap">
              <Typography
                variant="headline"
                weight="medium"
                className="text-primary max-w-[200px]"
                truncate
              >
                {organizer.org_channel_name || "Untitled organizer"}
              </Typography>
              {organizer.founding_organizer_at && <FoundingOrganizerBadge />}
            </div>
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
  const { eventData, startUTC } = useEventData();
  const [showBadgeModal, setShowBadgeModal] = React.useState(false);

  const collectionAddress = eventData.data?.sbt_collection_address;
  const registrantUuid = eventData.data?.registrant_uuid || undefined;
  const hasSbt = Boolean(collectionAddress);

  const badgeStatus = trpc.sbt.getAttendeeBadgeStatus.useQuery(
    {
      eventUuid: eventData.data?.event_uuid ?? "",
      registrantUuid: registrantUuid,
    },
    {
      enabled: Boolean(hasSbt && eventData.data?.event_uuid),
    }
  );

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

  const isMinted = badgeStatus.data?.status === "minted";
  const badgeItem = badgeStatus.data?.item;

  if (isMinted && badgeItem) {
    const badgeImageSrc = eventData.data?.tsRewardImage || eventData.data?.image_url || undefined;
    const badgeData: BadgeItemData = {
      ...badgeItem,
      eventTitle: eventData.data?.title,
      eventImage: badgeImageSrc,
      eventDateFrom: startUTC ? new Date(startUTC) : null,
      collectionAddress: collectionAddress,
      collectionName: eventData.data?.title,
    };

    return (
      <>
        <CustomCard
          title="Your Attendance Badge"
          description="Verified Soulbound Proof of Attendance (TEP-85) minted to your wallet."
        >
          <div
            onClick={() => setShowBadgeModal(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/15 transition group"
          >
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
              {badgeImageSrc ? (
                <LoadableImage
                  alt={eventData.data?.title}
                  src={badgeImageSrc}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Award className="w-6 h-6 text-emerald-500" />
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">
                  {eventData.data?.title} Badge
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Claimed &amp; Verified on TON
              </span>
            </div>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium group-hover:bg-emerald-700 transition"
            >
              View
            </button>
          </div>
        </CustomCard>
        <BadgeDetailModal
          badge={badgeData}
          open={showBadgeModal}
          onClose={() => setShowBadgeModal(false)}
        />
      </>
    );
  }

  return (
    <CustomCard
      title={"SBT Attendance Reward"}
      description="Reward you receive by attending the event and submitting proof of attendance."
    >
      <Block
        className="!mt-0 mb-4 cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          const isTestnet = process.env.NEXT_PUBLIC_TON_NETWORK === "testnet";
          const explorerHost = isTestnet ? "testnet.tonviewer.com" : "tonviewer.com";
          window.open(`https://${explorerHost}/${collectionAddress}`, "_blank");
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
  const { openLogin } = useLoginStore();
  const router = useRouter();

  const [isRegisterLoading, setIsRegisterLoading] = React.useState(false);

  React.useEffect(() => {
    const handleLoading = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsRegisterLoading(Boolean(customEvent.detail));
    };
    window.addEventListener("onton:registration_loading", handleLoading);
    return () => window.removeEventListener("onton:registration_loading", handleLoading);
  }, []);

  const registrantStatus = eventData.data?.registrant_status ?? "";
  const isRegistered = ["approved", "checkedin"].includes(registrantStatus);
  const tiers = (eventData.data?.ticket_tiers as Array<{ price: number }>) || [];
  const hasPaidTiers = tiers.some((t) => Number(t.price || 0) > 0);
  const isPaid = Boolean(
    eventData.data?.has_payment ||
      hasPaidTiers ||
      (eventData.data?.payment_details?.price && eventData.data.payment_details.price > 0)
  );

  const userCompletedTasks =
    isRegistered || !eventData.data?.has_registration;

  const isOnlineEvent = eventData.data?.participationType === "online";
  const isCheckedIn = eventData.data?.registrant_status === "checkedin" || isOnlineEvent;
  const isEventActive = isStarted && isNotEnded;
  const hasSbt = Boolean(eventData.data?.sbt_collection_address);

  const badgeStatus = trpc.sbt.getAttendeeBadgeStatus.useQuery(
    {
      eventUuid: eventData.data?.event_uuid ?? "",
      userId: user?.user_id,
      registrantUuid: eventData.data?.registrant_uuid || undefined,
    },
    {
      enabled: Boolean(isCheckedIn && hasSbt && eventData.data?.event_uuid),
    }
  );

  const buttonState = getAttendeeMainButtonState({
    isPaid,
    isRegistered,
    isNotEnded,
    isStarted,
    isOnlineEvent,
    isCheckedIn,
    hasEnteredPassword,
    hasSbt,
    userCompletedTasks,
    registrantUuid: eventData.data?.registrant_uuid,
    tiers: tiers as any,
    paymentDetails: eventData.data?.payment_details,
    hasRegistration: Boolean(eventData.data?.has_registration),
    hasApproval: Boolean(eventData.data?.has_approval),
    capacityFilled: Boolean(eventData.data?.capacity_filled),
    hasWaitingList: Boolean(eventData.data?.has_waiting_list),
    registrantStatus: eventData.data?.registrant_status ?? "",
    user,
  });

  switch (buttonState.type) {
    case "view_ticket_pass":
      return (
        <MainButton
          text="View Ticket Pass"
          onClick={() => router.push(`/tickets/${eventData.data?.event_uuid}`)}
        />
      );
    case "checkout":
      return (
        <MainButton
          text={buttonState.label}
          onClick={() => router.push(`/events/${eventData.data?.event_uuid}/checkout`)}
        />
      );
    case "register":
      return (
        <MainButton
          text={buttonState.label}
          progress={isRegisterLoading}
          disabled={isRegisterLoading}
          onClick={() => {
            if (isRegisterLoading) return;
            const form = document.getElementById("event-registration-form") as HTMLFormElement | null;
            if (form) {
              form.requestSubmit();
            }
          }}
        />
      );
    case "login_required":
      return (
        <MainButton
          text="Sign In to Register"
          onClick={openLogin}
          color="primary"
        />
      );
    case "pending":
      return (
        <MainButton text="Request Pending" disabled color="secondary" />
      );
    case "rejected":
      return (
        <MainButton text="Request Rejected" disabled color="secondary" />
      );
    case "capacity_filled":
      return (
        <MainButton text="Event Capacity Filled" disabled color="secondary" />
      );
    case "claim_sbt":
      return (
        <ClaimSbtButton
          ticketUuid={eventData.data?.registrant_uuid}
          rewardLink={badgeStatus.data?.rewardLink}
          isMinted={badgeStatus.data?.status === "minted"}
        />
      );
    case "checked_in":
      return (
        <MainButton text="Checked In ✅" disabled color="secondary" />
      );
    case "show_qr":
      return (
        <MainButton
          text="View Ticket Pass"
          onClick={() => {
            router.push(`/events/${eventData.data?.event_uuid}/registrant/${eventData.data?.registrant_uuid}/qr`);
          }}
        />
      );
    case "not_started":
      return (
        <MainButton text="Event Not Started Yet" disabled color="secondary" />
      );
    case "ended":
      return (
        <MainButton text="Event Has Ended" disabled color="secondary" />
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
    ["approved", "checkedin"].includes(eventData.data?.registrant_status as string) || !eventData.data?.has_registration;

  if (!user) {
    if (eventData.data?.has_registration) return null;
    return (
      <CustomCard
        title="Claim Your Reward"
        description="Please sign in to verify participation and claim rewards."
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

  if (!(userCompletedTasks && !hasEnteredPassword && isEventActive && isOnlineEvent)) return null;

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
  const tiers = (eventData.data?.ticket_tiers as Array<{ price: number; ticket_type: string }>) || [];
  const hasPaidTiers = tiers.some((t) => Number(t.price || 0) > 0);
  const isPaid = Boolean(
    eventData.data?.has_payment ||
      hasPaidTiers ||
      (eventData.data?.payment_details?.price && eventData.data.payment_details.price > 0)
  );
  const hasSbt = Boolean(eventData.data?.sbt_collection_address);

  const isStarsOnly =
    eventData.data?.payment_details?.token?.symbol === "STAR" ||
    (tiers.length > 0 && tiers.every((t) => Number(t.price) === 0 || t.ticket_type === "TSCSBT"));

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
