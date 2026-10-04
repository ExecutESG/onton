"use client";
import ActionCard from "@/ActionCard";
import ticketIcon from "@/app/_components/icons/ticket.svg";
import { ConnectWalletCard } from "@/app/_components/organisms/ConnectWallet";
import { trpc } from "@/app/_trpc/client";
import LoadableImage from "@/components/LoadableImage";
import Typography from "@/components/Typography";
import channelAvatar from "@/components/icons/channel-avatar.svg";
import solarCupOutline from "@/components/icons/solar-cup-outline.svg";
import questLogo from "@/components/icons/quest-flag.svg";
import { useUserStore } from "@/context/store/user.store";
import { Channel } from "@/types";
import { cn } from "@/utils";
import { useSectionStore } from "@/zustand/useSectionStore";
import { Card } from "konsta/react";
import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import CustomButton from "@/app/_components/Button/CustomButton";
import { useEffect } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { toast } from "sonner";
import calendarStarIcon from "./calendar-star.svg";
import badgeAwardIcon from "./badge-award.svg";
import LoginRequired from "@/app/_components/auth/LoginRequired";
import LinkedAccountsCard from "@/app/_components/auth/LinkedAccountsCard";
import PaymentCard from "./PaymentCard";
import ConsentCard from "@/components/consent/ConsentCard";

export default function ProfilePage() {
  const { user } = useUserStore();
  const { setSection } = useSectionStore();
  const router = useRouter();
  const tonWalletAddress = useTonAddress();
  const hasWallet = Boolean(tonWalletAddress || user?.wallet_address);
  const isOrganizer = user?.role === "organizer" || user?.role === "admin";

  const { data: totalPoints, isLoading: loadingTotalPoints } = trpc.usersScore.getTotalScoreByUserId.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: userBadgesData } = trpc.sbt.getUserBadges.useQuery(
    { userId: user?.user_id ?? 0 },
    { enabled: Boolean(user?.user_id) }
  );

  useEffect(() => {
    router.prefetch("/events/create");
    router.prefetch("/my/participated");
    router.prefetch("/my/hosted/");
    router.prefetch("/my/badges");
    router.prefetch("/my/points/");
  }, [router]);

  if (!user) {
    return <LoginRequired />;
  }

  if (loadingTotalPoints) return null;

  return (
    <div className="relative isolate space-y-3">
      {isOrganizer ? (
        <>
          <InlineChannelCard data={user} />
          <div className="pt-1 pb-1 w-full">
            <CustomButton
              variant="primary"
              onClick={(e) => {
                setSection("event_setup_form_general_step");
                router.push("/events/create");
              }}
              icon={<Plus size={20} />}
              className="justify-center font-semibold"
            >
              Create New Event
            </CustomButton>
          </div>
        </>
      ) : (
        <OrganizerProgress step={hasWallet ? 2 : 1} />
      )}

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
          if (!isOrganizer) {
            toast.error("Only organizers can host events");
            return;
          }
          router.push("/my/hosted/");
        }}
        iconSrc={calendarStarIcon}
        title="Hosted"
        subtitle={isOrganizer ? "You Created" : "Become an organizer first"}
        footerTexts={[
          isOrganizer
            ? { items: "Events", count: user?.hosted_event_count || 0 }
            : { items: "Activation required" },
        ]}
      />
      <ActionCard
        onClick={(e) => {
          router.push("/my/badges");
        }}
        iconSrc={badgeAwardIcon}
        title="My Badges"
        subtitle="Proof of Attendance"
        footerTexts={[
          { items: "Badges", count: userBadgesData?.badges?.length || 0 },
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
        subtitle="You Achieved"
        footerTexts={[{ items: "Points", count: Number(totalPoints) || 0 }]}
      />

      <ConnectWalletCard />
      {!isOrganizer && <PaymentCard visible={hasWallet} />}
      <LinkedAccountsCard />
      <ConsentCard />
    </div>
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
