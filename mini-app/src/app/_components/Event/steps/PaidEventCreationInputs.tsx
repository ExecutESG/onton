import { UploadImageFile } from "@/components/ui/upload-file";
import { UploadVideoFile } from "@/components/ui/upload-video-file";
import { trpc } from "@/app/_trpc/client";
import { cn } from "@/utils";
import { useCreateEventStore } from "@/zustand/createEventStore";
import { ListInput, ListItem, Segmented, SegmentedButton, Toggle } from "konsta/react";
import { useEffect, useState } from "react";
import ListLayout from "../../atoms/cards/ListLayout";

function NFTPayment() {
  const { payment, changePaymentToken, isEdit, tokenError, setPaidInfoErrors } = useCreateEventStore((state) => ({
    payment: state.eventData?.paid_event,
    changePaymentToken: state.changePaymentToken,
    isEdit: Boolean(state.edit?.eventHash),
    tokenError: state.paid_info_errors.token_id,
    setPaidInfoErrors: state.setPaidInfoErrors,
  }));
  const tokensQuery = trpc.events.listPaymentTokens.useQuery();
  const tokens = tokensQuery.data ?? [];
  const selectedToken = tokens.find((token) => token.token_id === payment.token_id);

  useEffect(() => {
    if (!isEdit && !payment.token_id && tokens.length > 0) {
      changePaymentToken(tokens[0].token_id);
    }
  }, [changePaymentToken, isEdit, payment.token_id, tokens]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const tokenId = Number(event.target.value);
    changePaymentToken(tokenId);
    setPaidInfoErrors("token_id", []);
  };

  return (
    <ListItem
      title="Payment Token"
      footer={
        <>
          <p>Select which token attendees will use to pay for tickets.</p>
          <ListInput
            outline
            dropdown
            disabled={tokensQuery.isLoading || isEdit || tokens.length === 0}
            name="payment_token"
            type="select"
            value={selectedToken?.token_id ?? ""}
            onChange={handleChange}
            placeholder="Select token"
            error={tokenError?.[0]}
          >
            {!selectedToken && (
              <option value="" disabled>
                {tokensQuery.isLoading ? "Loading tokens..." : "Select token"}
              </option>
            )}
            {tokens.length === 0 && !tokensQuery.isLoading && (
              <option value="" disabled>
                No tokens available
              </option>
            )}
            {tokens.map((token) => (
              <option
                key={token.token_id}
                value={token.token_id}
                className="text-black"
              >
                {token.symbol}
              </option>
            ))}
          </ListInput>
        </>
      }
    />
  );
}

function PaymentAmount() {
  const { payment, changePaymentAmount, paid_info_errors, setPaidInfoErrors } = useCreateEventStore((state) => ({
    payment: state.eventData?.paid_event,
    changePaymentAmount: state.changePaymentAmount,
    paid_info_errors: state.paid_info_errors,
    setPaidInfoErrors: state.setPaidInfoErrors,
  }));
  const tokensQuery = trpc.events.listPaymentTokens.useQuery();
  const tokens = tokensQuery.data ?? [];
  const selectedToken = tokens.find((token) => token.token_id === payment.token_id);
  const tokenSymbol = selectedToken?.symbol ?? "token";

  const [inputError, setInputError] = useState("");

  return (
    <ListInput
      outline
      required
      title="Price"
      pattern="[+\-]?(?:0|[1-9]\d*)(?:\.\d{1,3})?"
      inputMode="decimal" // Allows decimals on mobile devices
      placeholder={`Payment amount in ${tokenSymbol}`}
      value={payment.payment_amount?.toString() || ""} // Display as a string
      onChange={paymentAmountInputHandler}
      onBlur={paymentAmountInputHandler}
      error={inputError || paid_info_errors.payment_amount?.[0]}
    />
  );

  function paymentAmountInputHandler(e: any) {
    const amount = e.target.value;
    changePaymentAmount(amount);
    amount && setPaidInfoErrors("payment_amount", []);
    if (!e.target.validity.valid) {
      if (e.target.validity.valueMissing) {
        setInputError("Payment amount is required.");
      } else if (e.target.validity.patternMismatch) {
        setInputError("Invalid format: please enter a number with up to 3 decimal places (minimum = 0.001).");
      } else {
        setInputError("Invalid payment amount.");
      }
    } else {
      setInputError("");
    }
  }
}

function PaymentsRecipient() {
  const { eventData, setEventData, recipient_error_messages } = useCreateEventStore((state) => ({
    eventData: state.eventData,
    setEventData: state.setEventData,
    recipient_error_messages: state.paid_info_errors.payment_recipient_address,
  }));

  const handleInputChange = (value: string) => {
    setEventData({
      paid_event: {
        ...eventData.paid_event,
        payment_recipient_address: value || undefined,
      },
    });
  };

  return (
    <ListItem
      title="Recipient"
      footer={
        <>
          {/* Text Input for Wallet Address */}
          <ListInput
            outline
            required
            style={{
              marginInline: "-16px",
            }}
            label="Wallet Address"
            placeholder="Enter wallet address"
            value={eventData.paid_event?.payment_recipient_address || ""}
            onChange={(e) => handleInputChange(e.target.value)}
            error={recipient_error_messages?.length && recipient_error_messages?.[0]}
          />
        </>
      }
    />
  );
}

/**
 * Whether the nft is soulbound or just normal nft. (NFT or cSBT)
 */
function TicketType() {
  const { paymentInfo, changeTicketType, isEdit } = useCreateEventStore((state) => ({
    paymentInfo: state.eventData?.paid_event,
    changeTicketType: state.changeTicketType,
    isEdit: Boolean(state.edit?.eventHash),
    eventTicketType: state.eventData.paid_event.ticket_type,
  }));

  const ticketType = paymentInfo.ticket_type;

  return (
    <ListItem
      title="Ticket Type"
      className={cn(isEdit && "cursor-not-allowed opacity-50")}
      footer={
        <>
          <p>
            Ticket details cannot be changed after event is created. Ticked will be minted as NFT (Transferable) or cSBT
            (Soul-Bound, users can not transfer or sell the tickets).
          </p>
          <Segmented
            strong
            aria-disabled={isEdit}
          >
            <SegmentedButton
              strong
              onClick={(e) => {
                e.preventDefault();
                if (!isEdit) changeTicketType("NFT");
              }}
              active={ticketType === "NFT"}
              itemType="button"
              className={cn(ticketType === "NFT" && "text-black font-extrabold")}
            >
              NFT
            </SegmentedButton>
            <SegmentedButton
              strong
              active={ticketType === "TSCSBT"}
              onClick={(e) => {
                e.preventDefault();
                if (!isEdit) changeTicketType("TSCSBT");
              }}
              itemType="button"
              className={cn(ticketType === "TSCSBT" && "text-black font-extrabold")}
            >
              cSBT
            </SegmentedButton>
          </Segmented>
        </>
      }
    />
  );
}

function NFTImage() {
  const { changeNFTImage, paid_info_errors, nft_image, isEdit } = useCreateEventStore((state) => ({
    changeNFTImage: state.changeNFTImage,
    paid_info_errors: state.paid_info_errors,
    nft_image: state.eventData.paid_event.nft_image_url,
    isEdit: Boolean(state.edit?.eventHash),
  }));
  const { payment } = useCreateEventStore((state) => ({ payment: state.eventData.paid_event }));
  const label = payment.ticket_type === "TSCSBT" ? "cSBT" : "NFT";

  return (
    <UploadImageFile
      infoText={`This image is used as the ${label} ticket`}
      changeText="Change Ticket Image"
      disabled={isEdit}
      triggerText="Upload Ticket Image"
      onImageChange={changeNFTImage}
      defaultImage={nft_image}
      isError={Boolean(paid_info_errors.nft_image_url?.[0])}
    />
  );
}

function NFTVideo() {
  const { changeNFTVideo, paid_info_errors, nft_video, isEdit } = useCreateEventStore((state) => ({
    changeNFTVideo: state.changeNFTVideo,
    paid_info_errors: state.paid_info_errors,
    nft_video: state.eventData.paid_event.nft_video_url,
    isEdit: Boolean(state.edit?.eventHash),
  }));
  const { payment } = useCreateEventStore((state) => ({ payment: state.eventData.paid_event }));
  const label = payment.ticket_type === "TSCSBT" ? "cSBT" : "NFT";

  return (
    <UploadVideoFile
      infoText={`This video is used as the ${label} ticket`}
      changeText="Change Ticket Video"
      triggerText="Upload Ticket Video"
      onVideoChange={changeNFTVideo}
      defaultVideo={nft_video}
      disabled={isEdit}
      isError={Boolean(paid_info_errors.nft_image_url?.[0])}
    />
  );
}

function TicketMedia() {
  const { ticketType } = useCreateEventStore((state) => ({
    ticketType: state.eventData.paid_event.ticket_type,
  }));

  return (
    <div className="flex flex-col gap-4 pt-0 p-4">
      <NFTImage />
      {ticketType === "TSCSBT" && <NFTVideo />}
    </div>
  );
}

function NFTInfo() {
  const { payment, changeTitle, changeDescription, paid_info_errors, isEdit } = useCreateEventStore((state) => ({
    payment: state.eventData?.paid_event,
    changeTitle: state.changeNFTTitle,
    changeDescription: state.changeNFTDescription,
    paid_info_errors: state.paid_info_errors,
    isEdit: Boolean(state.edit?.eventHash),
  }));

  const ticketLabel = payment.ticket_type === "TSCSBT" ? "cSBT" : "NFT";

  return (
    <>
      <TicketType />
      <ListInput
        outline
        required
        placeholder={`Title used for ${ticketLabel} ticket`}
        title="Ticket Title"
        inputClassName={cn(isEdit && "cursor-not-allowed opacity-50")}
        value={payment.nft_title}
        onChange={(e) => changeTitle(e.target.value)}
        info={`You will *not* be able to change this information about your ${ticketLabel} collection later after event creation.`}
        disabled={isEdit}
        error={paid_info_errors.nft_title?.[0]}
      />
      <ListInput
        outline
        required
        placeholder={`Description used for ${ticketLabel} ticket`}
        inputClassName={cn(isEdit && "cursor-not-allowed opacity-50")}
        info={`You will not be able to change this information about your ${ticketLabel} collection later after event creation.`}
        title="Ticket Description"
        value={payment.nft_description}
        onChange={(e) => changeDescription(e.target.value)}
        disabled={isEdit}
        error={paid_info_errors.nft_description?.[0]}
      />
      <Capacity />
      <TicketMedia />
    </>
  );
}

function Capacity() {
  const { capacity, setEventData, paid_info_errors, isEdit, bought_capacity, eventData } = useCreateEventStore((state) => ({
    capacity: state.eventData?.capacity,
    setEventData: state.setEventData,
    paid_info_errors: state.paid_info_errors,
    isEdit: Boolean(state.edit?.eventHash),
    bought_capacity: state.eventData.paid_event.bought_capacity,
    eventData: state.eventData,
  }));

  const ticketLabel = eventData?.paid_event?.ticket_type === "TSCSBT" ? "cSBT" : "NFT";

  return (
    <>
      <ListInput
        outline
        inputMode="number"
        type="number"
        error={paid_info_errors.capacity?.[0]}
        value={capacity}
        onChange={(e) => {
          const value = e.target.value;
          const numValue = Number(value);
          setEventData({ capacity: value === "" ? undefined : numValue >= 1 ? numValue : 1 });
        }}
        label="Capacity"
        required
        info={`Number of users who can buy your Ticket${eventData?.paid_event?.ticket_type === "NFT" ? ` 0.06 TON for each ${ticketLabel} (minting fee)` : ""}.`}
      />

      {isEdit && (
        <ListItem
          title="Bought Capacity"
          footer="The maximum capacity you can change without extra payment is the bought capacity. If the input capacity exceeds this, you'll need to pay for the extra."
          after={<b className="font-extrabold">{bought_capacity}</b>}
        />
      )}
    </>
  );
}

/* ---------------------------------
 * ----- ☀️  MAIN COMPONENT ☀️  ------
 * ---------------------------------
 * The default export and this is used to combine all other above ones
 */
const PaidEventCreationInputs = () => {
  const { payment, toggleIsPaidEvent, editOptions, eventData } = useCreateEventStore((state) => ({
    payment: state.eventData?.paid_event,
    toggleIsPaidEvent: state.togglePaidEvent,
    editOptions: state.edit,
    eventData: state.eventData,
  }));

  const disablePaidToggle = Boolean(editOptions?.eventHash);

  return (
    <ListLayout title="Paid Event">
      <ListItem
        title="Is Paid"
        after={
          <Toggle
            checked={payment?.has_payment}
            onChange={() => {
              toggleIsPaidEvent();
            }}
            disabled={disablePaidToggle}
            className={cn({
              "opacity-50": disablePaidToggle,
            })}
          />
        }
        footer={<p>Ticket details cannot be changed after event is created.</p>}
      />
      {payment.has_payment && (
        <>
          <NFTPayment />
          <PaymentAmount />
          <PaymentsRecipient />
          <NFTInfo />
        </>
      )}
    </ListLayout>
  );
};

export default PaidEventCreationInputs;
