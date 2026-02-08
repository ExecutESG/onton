"use client";
import ActionCard from "@/ActionCard";
// import CheckUserInList from "@/app/_components/CheckUserInList";
import ticketIcon from "@/app/_components/icons/ticket.svg";
import { ConnectWalletCard } from "@/app/_components/organisms/ConnectWallet";
import { trpc } from "@/app/_trpc/client";
import LoadableImage from "@/components/LoadableImage";
import Typography from "@/components/Typography";
import channelAvatar from "@/components/icons/channel-avatar.svg";
import FabPlusIcon from "@/components/icons/plus-icon";
import solarCupOutline from "@/components/icons/solar-cup-outline.svg";
import OnionLogo from "@/components/icons/onion-logo.svg";
import questLogo from "@/components/icons/quest-flag.svg";
// import { ALLOWED_USER_TO_TEST } from "@/constants";
import { useUserStore } from "@/context/store/user.store";
import { Channel } from "@/types";
import { cn } from "@/utils";
import { useSectionStore } from "@/zustand/useSectionStore";
import { useTonAddress } from "@tonconnect/ui-react";
import { Card } from "konsta/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import PaymentCard from "./PaymentCard";
import calendarStarIcon from "./calendar-star.svg";
import { TbBowFilled } from "react-icons/tb";
export default function ProfilePage() {
  const { user } = useUserStore();
  const hasWallet = !!useTonAddress();
  const { setSection } = useSectionStore();
  const router = useRouter();
  const { data: totalPoints, isLoading: loadingTotalPoints } = trpc.usersScore.getTotalScoreByUserId.useQuery();

  const hasEventOrganizer = user?.role === "organizer" || user?.role === "admin";

  useEffect(() => {
    router.prefetch("/events/create");
    router.prefetch("/my/participated");
    router.prefetch("/my/hosted/");
    router.prefetch("/my/points/");
  }, [router, hasEventOrganizer]);

  if (!user || loadingTotalPoints) return null;

  return (
    <div className="relative isolate">
      {hasEventOrganizer ? <InlineChannelCard data={user} /> : <OrganizerProgress step={hasWallet ? 2 : 1} />}
      <ActionCard
        onClick={(e) => {
          router.push("/my/participated");
        }}
        iconSrc={ticketIcon}
        title="Participated"
        subtitle="Your Activity"
        footerTexts={[
          {
            count: user?.participated_event_count || 0,
            items: "Events",
          },
        ]}
      />
      <ActionCard
        onClick={(e) => {
          if (!hasEventOrganizer) {
            toast.error("Only organizers can host events");
            return;
          }
          router.push("/my/hosted/");
        }}
        iconSrc={calendarStarIcon}
        title="Hosted"
        subtitle="You Created"
        footerTexts={[
          hasEventOrganizer
            ? { items: "Events", count: user?.hosted_event_count || 0 }
            : { items: "Become an organizer first" },
        ]}
      />
      <ActionCard
        onClick={(e) => {
          router.push("/my/quest");
        }}
        iconSrc={questLogo}
        title="Quest"
        subtitle="Complete Quests and earn rewards"
        footerTexts={[]}
      />
      <ActionCard
        onClick={(e) => {
          router.push("/my/points/");
        }}
        iconSrc={solarCupOutline}
        title="My Points"
        subtitle="You Acheived"
        footerTexts={[{ items: "Points", count: Number(totalPoints) || 0 }]}
      />
      <ActionCard
        onClick={(e) => {
          router.push("/onion-snapshot/claim-points");
        }}
        iconSrc={OnionLogo}
        title="My Onions"
        subtitle="check your onions"
        footerTexts={[]}
      />

      {/*<ActionCard*/}
      {/*  onClick={(e) => {*/}
      {/*    router.push("/my/partner/onion-affiliate");*/}
      {/*  }}*/}
      {/*  iconSrc={solarCupOutline}*/}
      {/*  title="Onion Partnership Dashboard"*/}
      {/*  subtitle=""*/}
      {/*  footerTexts={[]}*/}
      {/*/>*/}

      <ConnectWalletCard />
      <PaymentCard visible={!hasEventOrganizer && hasWallet} />

      {hasEventOrganizer && (
        <div
          className="fixed text-primary drop-shadow rounded-full right-4 pt-1 z-50 cursor-pointer"
          onClick={(e) => {
            setSection("event_setup_form_general_step");
            router.push("/events/create");
          }}
          style={{
            bottom: `calc(90px + var(--tg-safe-area-inset-bottom))`,
          }}
        >
          <FabPlusIcon />
        </div>
      )}
    </div>
  );
}

function InlineChannelCard({ data }: { data: Channel | undefined }) {
  const router = useRouter();

  if (!data) return null;
  return (
    <Card
      className="!m-0 w-full cursor-pointer"
      onClick={(e) => {
        router.push(`/my/edit`);
      }}
    >
      <div className="flex gap-3">
        <LoadableImage
          width={80}
          height={80}
          src={data.org_image || data.photo_url || channelAvatar.src}
        />
        <div className="flex flex-col flex-1 gap-1 overflow-hidden">
          <Typography
            variant="title3"
            bold
            className="text-ellipsis whitespace-nowrap overflow-hidden"
          >
            {data.org_channel_name ?? "No Title"}
          </Typography>
          <Typography variant="subheadline2">Edit your information</Typography>
        </div>
        <div className="self-center">
          <ArrowRight className="text-main-button-color" />
        </div>
      </div>
    </Card>
  );
}

function OrganizerProgress({ step }: { step: 1 | 2 }) {
  return (
    <Card className="border border-[#007AFF] w-full !m-0">
      <Typography
        bold
        variant="headline"
        className="mb-1"
      >
        Early Organizer Access
      </Typography>
      <Typography
        variant="subheadline1"
        className="text-[#575757] font-medium mb-3"
      >
        Step forward as an organizer, Create your Organizer Channel, Conduct wonderful events and distribute SBT badges to
        your participants.
        <br />
        <b>{step === 1 ? "1. Connect your wallet." : "2. Pay one-time fee to become an organizer"}</b>
      </Typography>
      <div className="flex h-[2px] align-stretch gap-3">
        <div className="flex-1 bg-[#007AFF]" />
        <div className={cn("flex-1", step === 1 ? "bg-[#EEEEF0]" : "bg-[#007AFF]")} />
      </div>
    </Card>
  );
}
