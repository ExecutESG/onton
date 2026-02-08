import { trpc } from "@/app/_trpc/client";
import useWebApp from "@/hooks/useWebApp";
import { getErrorMessages } from "@/lib/error";
import { cn, fileToBase64 } from "@/lib/utils";
import { Block, BlockTitle, Sheet } from "konsta/react";
import { CircleArrowUp } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, KButton } from "./button";

/**
 * Props for the UploadImageFile component.
 */
type UploadFileProps = {
  /**
   * The text to display on the trigger button.
   */
  triggerText: React.ReactNode;

  /**
   * The text to display below the trigger button, providing additional information.
   */
  infoText: React.ReactNode;

  /**
   * The text to display on the change button, shown after an image has been uploaded.
   */
  changeText: React.ReactNode;

  /**
   * An optional callback function called when an image is uploaded, passing the uploaded image URL as an argument.
   */
  onImageChange?: (_img_url: string) => void;

  /**
   * An optional boolean indicating whether an error has occurred.
   */
  isError?: boolean;

  /**
   * An optional callback function called when the upload is complete, passing the uploaded image URL as an argument.
   */
  onDone?: (_img_url: string) => void;

  /**
   * An optional default image URL to display before an image is uploaded.
   */
  defaultImage?: string;
  /**
   * The text to display in the drawer description.
   */
  drawerDescriptionText?: string;

  disabled?: boolean;
};

/**
 * A component for uploading an image file.
 *
 * @param {UploadFileProps} props - The component props.
 * @return {JSX.Element} The JSX element representing the component.
 */
export const UploadImageFile = (props: UploadFileProps): JSX.Element => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const webApp = useWebApp();
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);

  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const uploadImage = trpc.files.uploadImage.useMutation({
    onSuccess: (data) => {
      setImagePreview(data.imageUrl);
      props.onImageChange?.(data.imageUrl);
    },
  });

  useEffect(() => {
    if (isSheetOpen) {
      webApp?.MainButton.hide();
    } else {
      webApp?.MainButton.show();
    }
  }, [isSheetOpen]);

  useEffect(() => {
    // Set the initial image preview when the component mounts
    setImagePreview(props?.defaultImage);
  }, [props?.defaultImage]);

  const handleSubmit = async () => {
    const fileInput = imageInputRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      return;
    }

    const file = fileInput.files[0];

    const image = (await fileToBase64(file)) as string;

    uploadImage.mutate({
      image,
      subfolder: "event",
    });
  };

  return (
    <>
      <Button
        className={cn(
          "w-full h-auto bg-primary/10 flex flex-col border border-cn-primary gap-3.5 border-dashed rounded-xl p-3",
          props.isError ? "border-red-300 bg-red-400/10" : "border-cn-primary",
          props.disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={(e) => {
          e.preventDefault();
          !props.disabled && setIsSheetOpen(true);
        }}
        type="button"
        variant={props.isError ? "destructive" : "outline"}
      >
        {imagePreview ? (
          <div className="flex gap-4 items-center justify-start w-full">
            <Image
              alt="upload file"
              className="rounded-xl"
              src={imagePreview}
              width={80}
              height={80}
            />
            <p className="font-semibold flex items-center gap-2 text-lg">
              <CircleArrowUp className="w-5" />
              {props.changeText}
            </p>
          </div>
        ) : (
          <>
            <p className="font-semibold flex items-center gap-2 text-lg">
              <CircleArrowUp className="w-5" />
              {props.triggerText}
            </p>
            {props.infoText && <p className="text-cn-muted-foreground text-sm w-full text-balance">{props.infoText}</p>}
          </>
        )}
      </Button>
      {createPortal(
        <Sheet
          opened={isSheetOpen}
          onBackdropClick={() => setIsSheetOpen(false)}
          className={cn("w-full")}
        >
          <BlockTitle>Upload Image</BlockTitle>
          <Block className="space-y-2">
            {!imagePreview && <p>{props.drawerDescriptionText || "Upload an image from your device"}</p>}
            {imagePreview && (
              <Image
                src={imagePreview}
                width={400}
                height={400}
                alt="event image"
                draggable="false"
                className="w-full rounded-xl h-auto"
              />
            )}
            {uploadImage.error && (
              <div className="text-red-500 text-sm w-full text-balance mt-2">
                {getErrorMessages(uploadImage.error.message).map((errMessage, idx: number) => (
                  <p key={idx}>{errMessage}</p>
                ))}
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              name="image"
              accept="image/*"
              onChange={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              id="event_image_input"
              className="hidden"
            />
            <KButton
              itemType="button"
              clear
              disabled={uploadImage.isLoading}
              className="flex items-center gap-2"
              onClick={(e) => {
                e.preventDefault();
                // click on upload input
                imageInputRef.current?.click();
              }}
            >
              <CircleArrowUp className="w-5" />
              <span>{imagePreview ? "Change Image" : "Upload Image"}</span>
            </KButton>
            {imagePreview && (
              <KButton
                className="w-16 h-10 mx-auto rounded-full"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSheetOpen(false);
                  typeof props?.onDone === "function" && props.onDone(imagePreview);
                }}
              >
                Done
              </KButton>
            )}
          </Block>
        </Sheet>,
        document.body
      )}
    </>
  );
};
