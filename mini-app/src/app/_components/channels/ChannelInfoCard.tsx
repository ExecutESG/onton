import { trpc } from "@/app/_trpc/client";
import channelAvatar from "@/components/icons/channel-avatar.svg";
import LoadableImage from "@/components/LoadableImage";
import useWebApp from "@/hooks/useWebApp";
import { wait } from "@/lib/utils";
import { Channel } from "@/types";
import { Card } from "konsta/react";
import { LoaderIcon } from "lucide-react";
import Image from "next/image";
import { PropsWithChildren } from "react";
import Typography from "../../../components/Typography";
import shareIcon from "./share.svg";
import telegramIcon from "./telegram.svg";
import xPlatformIcon from "./xplatform.svg";

export default function ChannelInfoCard({ data }: { data: Channel }) {
  const WebApp = useWebApp();
  const initData = WebApp?.initData || "";
  const hapticFeedback = WebApp?.HapticFeedback;
  const shareOrganizerMutation = trpc.telegramInteractions.requestShareOrganizer.useMutation();

  const share = async () => {
    // if there's no Telegram initData, do nothing
    if (!initData) return;

    // Fire the mutation
    await shareOrganizerMutation.mutateAsync({ organizerId: data.user_id });

    // Optionally open the Telegram link, haptic feedback, wait, then close
    WebApp?.openTelegramLink(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`);
    hapticFeedback?.impactOccurred("medium");
    await wait(500);
    WebApp?.close();
  };

  return (
    <Card className="mt-0">
      <LoadableImage
        src={data.org_image || channelAvatar.src}
        width={window.innerWidth}
        height={window.innerHeight}
        alt={data.org_channel_name}
        wrapperClassName="mb-3 flex justify-center"
      />

      <div className="flex justify-between align-center mb-4">
        <Typography
          bold
          variant="title2"
          className="self-center"
        >
          {data.org_channel_name || "Untitled Organizer"}
        </Typography>
        <div className="flex gap-3">
          {data.org_x_link && (
            <IconBg onClick={() => window.Telegram.WebApp.openLink(data.org_x_link as string, { try_instant_view: true })}>
              <Image
                src={xPlatformIcon}
                width={16}
                height={16}
                alt={`${data.org_channel_name} on X`}
              />
            </IconBg>
          )}
          {data.org_support_telegram_user_name && (
            <IconBg
              onClick={() =>
                window.Telegram.WebApp.openTelegramLink(`https://t.me/${data.org_support_telegram_user_name?.substring(1)}`)
              }
            >
              <Image
                src={telegramIcon}
                width={16}
                height={16}
                alt={`${data.org_channel_name} on Telegram`}
              />
            </IconBg>
          )}
          <IconBg onClick={share}>
            {shareOrganizerMutation.isLoading ? (
              <LoaderIcon className="animate-spin text-blue-600 -m-1" />
            ) : (
              <Image
                src={shareIcon}
                width={16}
                height={16}
                alt={`Share ${data.org_channel_name}'s channel`}
              />
            )}
          </IconBg>
        </div>
      </div>
      <Typography
        variant="body"
        className="font-normal break-word"
      >
        <span dangerouslySetInnerHTML={{ __html: data.org_bio?.replaceAll("\n", "<br/>") as string }} />
      </Typography>
      {/* {user?.user_id === data.user_id && (
        <Button
          className="mt-3 py-4 rounded-[10px]"
          outline
          onClick={() => router.push(`/my/edit`)}
        >
          Edit Profile
        </Button>
      )} */}
    </Card>
  );
}

function IconBg({ onClick, children }: PropsWithChildren<{ onClick: () => void }>) {
  return (
    <button
      className="w-8 h-8 bg-[#efeff4] rounded-[10px] p-2"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
