import OntonDialog from "@/components/OntonDialog";
import Typography from "@/components/Typography";
import useDisableScrollbar from "@/hooks/ui/useDisableScrollbar";
import { cn } from "@/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Block, Button, Card, Page, Popup, Sheet } from "konsta/react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import greenCheckIcon from "./green-check.svg";
import usePollPromoteToOrganizer from "./usePollPromoteToOrganizer";
import { NFT_EVENT_PRICE, ORGANIZER_PROMOTE_PRICE } from "@/constants";

export default function PaymentCard({ visible }: { visible: boolean }) {
  const [confirmPayDialogOpen, setConfirmPayDialogOpen] = useState(false);
  const [congratsDrawerOpen, setCongratsDrawerOpen] = useState(false);

  const onFail = useCallback(() => {
    toast.error("Transaction was not successfully. Please try again");
    setConfirmPayDialogOpen(false);
  }, []);

  const onPollFinished = useCallback(
    (success: boolean) => {
      setConfirmPayDialogOpen(false);
      setTimeout(() => {
        if (success) {
          setCongratsDrawerOpen(true);
        } else {
          onFail();
        }
      }, 300);
    },
    [onFail]
  );

  const { state, onPay } = usePollPromoteToOrganizer(onPollFinished);

  const handlePay = async () => {
    setConfirmPayDialogOpen(false);
    onPay();
  };

  return (
    <>
      <Card className={cn("mx-0 w-full hidden", visible && "!block")}>
        <Typography
          bold
          variant="headline"
          className="mb-4"
        >
          Organizer Payment
        </Typography>
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirmPayDialogOpen(true);
          }}
          className="py-6 rounded-[10px]"
        >
          Pay {ORGANIZER_PROMOTE_PRICE} TON
        </Button>
      </Card>
      <ConfirmPayDialog
        open={confirmPayDialogOpen}
        onClose={() => setConfirmPayDialogOpen(false)}
        onPay={handlePay}
      />
      <CongratsDrawer
        open={congratsDrawerOpen}
        onClose={() => {
          setCongratsDrawerOpen(false);
          window.location.reload();
        }}
      />
      <LoadingPopup open={state === "processing"} />
    </>
  );
}

function LoadingPopup({ open }: { open: boolean }) {
  useDisableScrollbar(open);

  return (
    <Popup opened={open}>
      <Page className="flex flex-col h-full justify-center">
        <Block className="overscroll-contain">
          <Typography
            variant="title2"
            className="font-semibold text-center mb-15"
          >
            Checking your payment
          </Typography>
          <DotLottieReact
            loop
            autoplay
            src="/thinking-duck.json"
            height={112}
            width={112}
            className="mx-auto w-[112px] mb-[68px]"
          />
          <Typography
            variant="body"
            className="font-normal mb-7 mx-7 text-center"
          >
            Hold on a second, we need to make sure the payment went through successfully.
          </Typography>
          <Typography
            variant="body"
            className="font-normal text-center text-primary"
          >
            Contact Support
          </Typography>
        </Block>
      </Page>
    </Popup>
  );
}

function ConfirmPayDialog({ open, onClose, onPay }: { open: boolean; onClose: () => void; onPay: () => void }) {
  return (
    <OntonDialog
      open={open}
      onClose={onClose}
      title="Organizer Payment"
    >
      <Typography
        variant="body"
        className="text-center mb-6 font-normal"
      >
        <b>You are becoming an ONTON organizer.</b>
        <br />
        In order to create your channel you need to pay {NFT_EVENT_PRICE} tons so that you can create your first event
        afterwards.
      </Typography>
      <Button
        className="py-6 rounded-[10px] mb-3"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPay();
        }}
      >
        Pay {ORGANIZER_PROMOTE_PRICE} TON
      </Button>
      <Button
        className="py-6 rounded-[10px]"
        outline
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      >
        Maybe Later
      </Button>
    </OntonDialog>
  );
}

function CongratsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDisableScrollbar(open);

  return (
    <Sheet
      className="w-full"
      opened={open}
      onBackdropClick={onClose}
    >
      <Block className="mt-11 mb-8">
        <Image
          src={greenCheckIcon}
          width={72}
          height={72}
          className="mx-auto mb-3"
          alt="Success"
        />
        <Typography
          variant="title1"
          bold
          className="mb-2 text-center"
        >
          Congratulations!
        </Typography>
        <Typography
          variant="body"
          className="mb-4 text-center font-medium text-[#6A7785]"
        >
          You’re now a valuable ONTON organizer, you can create events, sell tickets and enjoy the journey!
        </Typography>
        <Button
          outline
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="w-auto py-5 rounded-[10px] mx-auto px-6"
        >
          Let’s Go!
        </Button>
      </Block>
    </Sheet>
  );
}
