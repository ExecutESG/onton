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
import { useSectionStore } from "@/zustand/useSectionStore";
import { Card } from "konsta/react";
import { ArrowRight, Plus, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import CustomButton from "@/app/_components/Button/CustomButton";
import { useEffect } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { toast } from "sonner";
import calendarStarIcon from "./calendar-star.svg";
import badgeAwardIcon from "./badge-award.svg";
import LoginRequired from "@/app/_components/auth/LoginRequired";
import LinkedAccountsCard from "@/app/_components/auth/LinkedAccountsCard";
import FoundingOrganizerBadge from "@/app/_components/FoundingOrganizerBadge";

export default function ProfilePage() {
  const { user } = useUserStore();
  const { setSection } = useSectionStore();
  const router = useRouter();
  const tonWalletAddress = useTonAddress();
  const isOrganizer = user?.role === "organizer" || user?.role === "admin";

  const { data: identities } = trpc.users.getLinkedIdentities.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: canCreateEvents } = trpc.users.canCreateEvents.useQuery(undefined, { enabled: !!user });
  const hasVerifiedIdentity = canCreateEvents === true;

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

  const handleCreateEventClick = () => {
    if (!hasVerifiedIdentity) {
      toast.error("Please link Telegram, Google, or email to create events");
      return;
    }
    setSection("event_setup_form_general_step");
    router.push("/events/create");
  };

  return (
    <div className="relative isolate space-y-3">
      {/* Organizer Channel Card */}
      {(isOrganizer || user?.org_channel_name) && <InlineChannelCard data={user} />}

      {/* Identity Verification Prompt for users without Telegram / Google / Email */}
      {!hasVerifiedIdentity && (
        <Card className="!m-0 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <Typography variant="subheadline1" bold className="text-amber-800 dark:text-amber-200">
                Link an identity to create events
              </Typography>
              <Typography variant="caption1" className="text-amber-700 dark:text-amber-300">
                Connect your Telegram, Google, or email account below to start hosting events on ONTON.
              </Typography>

            </div>
          </div>
        </Card>
      )}

      {/* Create Event Button (Open to everyone) */}
      <div className="pt-1 pb-1 w-full">
        <CustomButton
          variant="primary"
          onClick={handleCreateEventClick}
          icon={<Plus size={20} />}
          className="justify-center font-semibold"
        >
          Create New Event
        </CustomButton>
      </div>

      <ActionCard
        onClick={() => {
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
        onClick={() => {
          router.push("/my/hosted/");
        }}
        iconSrc={calendarStarIcon}
        title="Hosted"
        subtitle={user?.hosted_event_count ? "You Created" : "Events you create"}
        footerTexts={[
          {
            items: "Events",
            count: user?.hosted_event_count || 0,
          },
        ]}
      />
      <ActionCard
        onClick={() => {
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
        onClick={() => {
          router.push("/my/quest");
        }}
        iconSrc={questLogo}
        title="Quest"
        subtitle="Complete Quests and earn rewards"
        footerTexts={[]}
      />
      <ActionCard
        onClick={() => {
          router.push("/my/points/");
        }}
        iconSrc={solarCupOutline}
        title="My Points"
        subtitle="You Achieved"
        footerTexts={[{ items: "Points", count: Number(totalPoints) || 0 }]}
      />

      <ConnectWalletCard />
      <LinkedAccountsCard />
    </div>
  );
}

function InlineChannelCard({ data }: { data: Channel | undefined }) {
  const router = useRouter();

  if (!data) return null;
  return (
    <Card
      className="!m-0 w-full cursor-pointer"
      onClick={() => {
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
          <div className="flex items-center gap-2 flex-wrap">
            <Typography
              variant="title3"
              bold
              className="text-ellipsis whitespace-nowrap overflow-hidden"
            >
              {data.org_channel_name ?? "No Title"}
            </Typography>
            {data.founding_organizer_at && <FoundingOrganizerBadge />}
          </div>
          <Typography variant="subheadline2">Edit your information</Typography>
        </div>
        <div className="self-center">
          <ArrowRight className="text-main-button-color" />
        </div>
      </div>
    </Card>
  );
}
