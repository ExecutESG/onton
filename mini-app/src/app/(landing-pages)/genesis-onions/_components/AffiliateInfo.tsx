import Typography from "@/components/Typography";
import { Box, Modal } from "@mui/material";
import { CircleX } from "lucide-react";
import { PropsWithChildren } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SectionTitle = ({ children }: PropsWithChildren) => (
  <Typography
    variant="callout"
    weight="semibold"
  >
    {children}
  </Typography>
);
const SectionBody = ({ children, className }: PropsWithChildren & { className?: string }) => (
  <Typography
    variant="subheadline1"
    weight="normal"
    className={className}
  >
    {children}
  </Typography>
);

export const AffiliateInfo = ({ open, onClose }: Props) => {
  const handleOnClick = () => {
    // TODO: replace the following URL with appropriate one
    window.Telegram.WebApp.openLink("https://onton.live/");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="text-white grid place-items-center"
    >
      <Box className="bg-navy px-4 py-5 flex flex-col gap-4 rounded-2lg border border-brand-divider-dark w-10/12 max-h-[90vh]">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="title2">Affiliate Reward</Typography>

          <CircleX
            className="cursor-pointer hover:opacity-80"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          />
        </Box>

        <div className="overflow-x-hidden overflow-y-auto">
          <SectionTitle>Share Your Link</SectionTitle>
          <SectionBody className="mb-3">
            Get a personal link to share. Anyone who buys spins through it counts as your referral.
          </SectionBody>

          <SectionTitle>Spins Counted</SectionTitle>
          <SectionBody className="mb-3">
            All spins bought via your link are totaled—and every spin gives you an ONION (no empty spins).
          </SectionBody>

          <SectionTitle>Get Rewards Automatically</SectionTitle>
          <SectionBody className="mb-3">
            <ul>
              <li>Every 5 spins = 1 free spin</li>
              <li>Every 20 spins = 1 guaranteed Gold ONION (At 20, only the Gold ONION is given, not both.)</li>
            </ul>
          </SectionBody>

          <SectionTitle>Stay Notified</SectionTitle>
          <SectionBody className="mb-3">You’ll get a Telegram message each time you earn an ONION.</SectionBody>

          <SectionTitle>Why It Works</SectionTitle>
          <SectionBody>Easy to share, rewards grow with referrals, and everything is auto-tracked.</SectionBody>
        </div>
      </Box>
    </Modal>
  );
};
