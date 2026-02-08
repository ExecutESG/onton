import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import useWebApp from "@/hooks/useWebApp";
import { FaTelegram, FaXTwitter } from "react-icons/fa6";
import { IoDocument } from "react-icons/io5";

export const OnionFollowUsCard = () => {
  const webapp = useWebApp();
  return (
    <CustomCard defaultPadding>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Typography
            variant="callout"
            weight="semibold"
          >
            How and when I can claim my ONIONs?
          </Typography>
          <Typography
            variant="subheadline2"
            weight="normal"
            className="flex flex-col gap-3"
          >
            <p>You can claim your tokens after TGE, based on Vesting terms.</p>
            <p>Follow ONTON Social Media and Stay updated.</p>
          </Typography>
        </div>
        <Button
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            webapp?.openTelegramLink("https://t.me/ontonlive");
          }}
        >
          <FaTelegram className="w-4 h-4 mr-1" />
          Visit Announcement Channel
        </Button>
        <Button
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            webapp?.openLink("https://x.com/ontonbot");
          }}
        >
          <FaXTwitter className="w-4 h-4 mr-1" />
          Follow us on X
        </Button>
        <div className="flex flex-col gap-3 rounded-2lg">
          <Typography
            variant="subheadline1"
            className="text-black font-normal leading-tight tracking-tighter text-sm"
          >
            ‌Whats is ONION and what's it worth?
          </Typography>
          <div>
            <Button
              className="w-full"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                webapp?.openLink("https://onion.tg/docs");
              }}
            >
              <IoDocument className="w-4 h-4 mr-1" />
              ‌ONION Docs
            </Button>
          </div>
        </div>
      </div>
    </CustomCard>
  );
};
