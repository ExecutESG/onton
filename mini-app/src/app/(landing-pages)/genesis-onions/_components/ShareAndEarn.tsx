import { trpc } from "@/app/_trpc/client";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { InfoIcon, Share } from "lucide-react";
import { useState } from "react";
import { customToast } from "../GenesisOnions.utils";
import { useAffiliate } from "../hooks/useAffiliate";
import { AffiliateInfo } from "./AffiliateInfo";
import { InfoBox } from "./InfoBox";

const rewardsGuide = [
  {
    title: "1 Free Spin",
    subtitle: "Every 5 invites",
  },
  {
    title: "1 Gold ONION",
    subtitle: "Every 20 invites",
  },
];

export const ShareAndEarn = () => {
  const { inviteOnTelegram, isLoading: isLoadingInviteOnTelegram } = useAffiliate();
  const [showAffiliateInfo, setShowAffiliateInfo] = useState(false);

  const { data, isLoading, isError } = trpc.campaign.getOnionCampaignAffiliateData.useQuery();

  const handleInviteOnTelegram = async () => {
    try {
      await inviteOnTelegram();

      window.Telegram.WebApp.close();
    } catch (error) {
      console.error(error);
      customToast.error("Unable to open the invitation dialogue, please try again later.");
    }
  };

  const handleCopyToClipboard = async () => {
    if (!data?.linkHash) {
      customToast.error("No link hash available to copy.");
      return;
    }

    const input = document.createElement("input");
    input.setAttribute("readonly", "");
    input.value = data.linkHash;
    input.style.position = "absolute";
    input.style.left = "-9999px";

    document.body.appendChild(input);
    input.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        customToast.success("Link copied to clipboard! Let's share it and earn more!");
      } else {
        customToast.error("Failed to copy the link. Try again.");
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }

    document.body.removeChild(input);
  };

  const handleShare = async () => {
    const shareUrl = `https://t.me/theontonbot/start?startapp=${data?.linkHash}`;

    const shareData: ShareData = {
      title: `Genesis Onions Airdrop`,
      text: `A friend has invited you to join ONTON. Join, spin, and collect Genesis ONIONs!\n\n${shareUrl}`,
      url: shareUrl, // removed to avoid issues on Android
    };

    try {
      await navigator.share(shareData);
    } catch (err: any) {
      if (err.name !== "AbortError" && err.name !== "NotAllowedError") {
        try {
          await handleCopyToClipboard();
          // customToast.info("Sharing not supported. Link copied to clipboard!");
        } catch (clipboardErr) {
          console.log({ clipboardErr });
          customToast.error("Error sharing or copying link. Please try again later.");
        }
      }
    }
  };

  if (isLoading) return null;
  if (isError) return <div>Error loading affiliate links, please try again later.</div>;

  return (
    <div className="multi-step-gradient-bg px-4">
      <AffiliateInfo
        open={showAffiliateInfo}
        onClose={() => setShowAffiliateInfo(false)}
      />
      <InfoBox className="flex flex-col items-center border">
        <div className="flex flex-col gap-1 items-center mb-2">
          <Typography
            variant="headline"
            weight="semibold"
          >
            Share & Earn
          </Typography>

          <div className="flex gap-1 items-center">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAffiliateInfo(true);
              }}
              className="border-none bg-transparent outline-none hover:opacity-80"
            >
              <InfoIcon size={16} />
            </button>

            <Typography variant="subheadline2">Invite your friends to earn ONIONs.</Typography>
          </div>
        </div>

        <div className="w-24 h-24 bg-[url('/orange-cards.svg')] bg-no-repeat bg-center flex flex-col gap-1 justify-center items-center mb-4">
          <Typography
            variant="title2"
            weight="bold"
          >
            {data.totalSpins}
          </Typography>

          <Typography
            variant="caption2"
            weight="normal"
          >
            invites
          </Typography>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <div className="flex gap-3 w-full">
            {rewardsGuide.map((item) => (
              <InfoBox
                key={item.title}
                className="rounded-md py-2 px-3 flex flex-col gap-2 flex-1 items-center backdrop-blur-none"
              >
                <Typography
                  variant="subheadline2"
                  weight="medium"
                >
                  {item.title}
                </Typography>
                <Typography variant="caption2">{item.subtitle}</Typography>
              </InfoBox>
            ))}
          </div>

          <div className="flex justify-between items-center bg-white/25 rounded-2lg px-4 h-11 gap-2">
            <input
              type="text"
              readOnly
              value={data?.linkHash}
              className="border-none bg-transparent text-white outline-none flex-1 font-normal text-lg text-ellipsis overflow-hidden"
            />

            <button
              className="text-orange bg-transparent border-none outline-none"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopyToClipboard();
              }}
            >
              <Typography
                variant="body"
                weight="medium"
              >
                Copy
              </Typography>
            </button>
          </div>

          <div className="flex gap-3 h-12">
            <Button
              type="button"
              size="lg"
              className="rounded-2lg h-full flex flex-1 items-center justify-center bg-orange hover:bg-orange/80 overflow-hidden drop-shadow-md"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInviteOnTelegram();
              }}
              isLoading={isLoadingInviteOnTelegram}
              disabled={isLoadingInviteOnTelegram}
            >
              <Typography
                variant="body"
                weight="medium"
              >
                Invite on Telegram
              </Typography>
            </Button>

            <Button
              variant="default"
              className="bg-white hover:bg-white/80 h-full aspect-square p-0 drop-shadow-md"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleShare();
              }}
            >
              <Share
                size={24}
                className="text-orange"
              />
            </Button>
          </div>
        </div>
      </InfoBox>
    </div>
  );
};
