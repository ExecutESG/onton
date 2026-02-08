import Typography from "@/components/Typography";
import { Box, Modal } from "@mui/material";
import { CircleX } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const AccessRestrictedModal = ({ open, onClose }: Props) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="text-white grid place-items-center"
    >
      <Box className="bg-navy px-4 py-5 flex flex-col gap-4 rounded-2lg border border-brand-divider-dark w-10/12">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography
            variant="title2"
            weight="normal"
          >
            Access Restricted
          </Typography>

          <CircleX
            className="cursor-pointer hover:opacity-80"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
          />
        </Box>

        <div className="flex gap-3">
          <div className="flex flex-col gap-2">
            <Typography
              variant="subheadline1"
              weight="normal"
            >
              Only ONTON Pioneers, ONION Pioneers and ON Smile SBT holders can access today.
            </Typography>

            <Typography
              variant="subheadline1"
              weight="normal"
            >
              The access will be open for all SBT holders from Monday 7th April 2 PM CET.
            </Typography>
          </div>
        </div>
      </Box>
    </Modal>
  );
};
