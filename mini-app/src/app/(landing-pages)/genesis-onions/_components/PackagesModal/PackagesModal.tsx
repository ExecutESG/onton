import Typography from "@/components/Typography";
import { TokenCampaignOrders, TokenCampaignSpinPackages } from "@/db/schema";
import { Box, Modal } from "@mui/material";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { DELAY_BETWEEN_PACKAGE_ORDERS } from "../../GenesisOnions.constants";
import { usePackage } from "../../hooks/usePackage";
import { PackageItem } from "./PackageItem";

interface Props {
  open: boolean;
  onClose: () => void;
  onOrderPaid: (order: TokenCampaignOrders) => void;
  onOrderPaymentFailed: (err: Error) => void;
}

export const PackagesModal = ({ open, onClose, onOrderPaid, onOrderPaymentFailed }: Props) => {
  const [allowBuy, setAllowBuy] = useState(true);
  const { packages, isErrorPackages, isLoadingPackages } = usePackage();
  const timerId = useRef<NodeJS.Timeout>();

  if (isLoadingPackages) return null;
  if (isErrorPackages) return <div>Error! Try again later...</div>;

  const handleOrderPaid = (order: TokenCampaignOrders) => {
    onOrderPaid(order);

    onClose();
  };

  const handleOrderPaymentFailed = (err: Error) => {
    onOrderPaymentFailed(err);
    setAllowBuy(false);

    if (timerId.current) clearTimeout(timerId.current);

    timerId.current = setTimeout(() => {
      setAllowBuy(true);
    }, DELAY_BETWEEN_PACKAGE_ORDERS);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="text-white"
    >
      <Box
        className="bg-navy px-4 py-5 flex flex-col gap-4 rounded-t-3xl w-full"
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="title2">Secure Spin Bundles</Typography>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="border-2 p-0.5 rounded-full border-white w-7 h-7 flex items-center justify-center"
          >
            <X />
          </button>
        </Box>

        <div className="flex flex-col gap-3">
          <Typography
            variant="callout"
            weight="normal"
          >
            Select your preferred package to continue:
          </Typography>

          <div className="grid grid-cols-3 gap-2">
            {packages?.map((pkg) => (
              <PackageItem
                onOrderPaid={handleOrderPaid}
                onPaymentFailed={handleOrderPaymentFailed}
                key={pkg.id}
                pkg={pkg as TokenCampaignSpinPackages}
                allowBuy={allowBuy}
              />
            ))}
          </div>
        </div>

        <Typography
          variant="footnote"
          weight="normal"
        >
          Save time: Spin faster with Spin Bundles to hunt for the rarest ONIONs!
        </Typography>
      </Box>
    </Modal>
  );
};
