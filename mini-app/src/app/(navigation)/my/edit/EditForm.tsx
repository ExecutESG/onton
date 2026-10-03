"use client";
import telegramIcon from "@/app/_components/channels/telegram.svg";
import xPlatformIcon from "@/app/_components/channels/xplatform.svg";
import { trpc } from "@/app/_trpc/client";
import LoadableImage from "@/components/LoadableImage";
import { OntonExpandableInput, OntonInput } from "@/components/OntonInput";
import Typography from "@/components/Typography";
import channelAvatar from "@/components/icons/channel-avatar.svg";
import { getErrorMessages } from "@/lib/error";
import { Channel } from "@/types";
import { cn } from "@/utils";
import { useFormik } from "formik";
import { Button, Preloader } from "konsta/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import cameraIcon from "./camera.svg";

const xLinkDefault = "https://x.com/";

export default function EditForm({ data }: { data: Channel }) {
  const editApi = trpc.organizers.updateOrganizer.useMutation();
  const router = useRouter();

  // const imageInputRef = useRef<HTMLInputElement>(null);

  const trpcUtils = trpc.useUtils();
  const initialImage = data.org_image || data.photo_url || "";
  const { errors, touched, values, handleChange, handleSubmit, isSubmitting, getFieldProps, setFieldValue } = useFormik<{
    org_channel_name: string;
    org_support_telegram_user_name: string;
    org_x_link: string;
    org_bio: string;
    org_image: string;
  }>({
    initialValues: {
      org_channel_name: data.org_channel_name || "",
      org_support_telegram_user_name: data.org_support_telegram_user_name || "",
      org_x_link: data.org_x_link || xLinkDefault,
      org_bio: data.org_bio || "",
      org_image: initialImage,
    },
    validate(values) {
      const newErrors: any = {};

      if (!values.org_channel_name.trim()) {
        newErrors.org_channel_name = "Channel name cannot be empty.";
      }

      if (
        values.org_support_telegram_user_name !== "" &&
        !/^@[a-zA-Z0-9_]{5,32}$/.test(values.org_support_telegram_user_name.trim())
      ) {
        newErrors.org_support_telegram_user_name = "Must start with @ and be 5-32 characters long.";
      }

      const xLink = (values.org_x_link.trim() === xLinkDefault ? "" : values.org_x_link.trim()).toLowerCase();

      if (xLink && !/^https?:\/\/[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}\/[a-zA-Z0-9_]{1,}$/.test(xLink)) {
        newErrors.org_x_link = "Invalid X handle URL. It should be like https://x.com/ontonlive";
      }
      return newErrors;
    },
    async onSubmit(values) {
      const newVals = { ...values };
      if (newVals.org_x_link === xLinkDefault) {
        newVals.org_x_link = "";
      }
      if (newVals.org_image.startsWith("blob:")) {
        newVals.org_image = null as any;
      }

      await editApi.mutateAsync(newVals);
      toast.success("Information updated successfully.");
      trpcUtils.users.syncUser.invalidate(undefined, { refetchType: "all" });
      goBack();
    },
  });

  const uploadApi = trpc.files.uploadImage.useMutation();

  // const [prevImg, setPrevImg] = useState(initialImage)
  const [isUploading, setUploading] = useState(false);
  const uploadImage = async (files: FileList | null) => {
    uploadApi.reset(); // reset the error
    const file = files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setFieldValue("org_image", url);

    let base64Img;
    try {
      base64Img = await toBase64(file);
    } catch (e) {
      toast.error("Unable to encode image. Please try another image.");
      return;
    }
    setUploading(true);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const response = await uploadApi.mutateAsync({
        image: base64Img,
        subfolder: "channels",
      });
      setFieldValue("org_image", response.imageUrl);
    } catch (e) {
      console.log(e);
      toast.error("Unable to upload image. Please try again.");
    } finally {
      // setFieldValue("org_image", prevImg)
      setUploading(false);
    }
  };

  const goBack = () => {
    router.replace("/my");
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="w-full max-w-xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={goBack}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center text-gray-700 dark:text-gray-200"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <Typography
              variant="title2"
              bold
            >
              Editing Profile
            </Typography>
            <Typography
              variant="footnote"
              className="text-gray-500"
            >
              You can edit your information and manage how it is shown to the participants.
            </Typography>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative group w-28 h-28 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800 shadow-sm flex items-center justify-center">
            {isUploading && (
              <div className="absolute z-20 inset-0 bg-black/40 flex items-center justify-center">
                <Preloader size="w-8 h-8" />
              </div>
            )}
            {uploadApi.error && (
              <div className="absolute z-20 inset-0 bg-red-500/80 text-white p-2 text-xs flex items-center justify-center text-center">
                {getErrorMessages(uploadApi.error?.message).join(", ")}
              </div>
            )}
            <LoadableImage
              src={values.org_image || channelAvatar.src}
              width={112}
              height={112}
              className="w-full h-full object-cover"
              wrapperClassName="w-full h-full"
              alt="Avatar"
            />
            <label className="absolute inset-0 z-10 hidden md:flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Image
                src={cameraIcon}
                width={24}
                height={24}
                alt="Change"
                className="brightness-0 invert"
              />
              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={(e) => {
                  uploadImage(e.target.files);
                }}
                className="sr-only"
              />
            </label>
          </div>

          <label className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 rounded-full cursor-pointer transition-colors">
            <Image
              src={cameraIcon}
              width={14}
              height={14}
              alt=""
            />
            Edit Photo
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={(e) => {
                uploadImage(e.target.files);
              }}
              className="sr-only"
            />
          </label>
        </div>

        <OntonInput
          className="mb-3"
          label="Channel Name"
          error={(errors.org_channel_name && touched.org_channel_name && errors.org_channel_name) || undefined}
          {...getFieldProps("org_channel_name")}
        />
        <OntonInput
          className="mb-3"
          label="Telegram Handle"
          error={
            (errors.org_support_telegram_user_name &&
              touched.org_support_telegram_user_name &&
              errors.org_support_telegram_user_name) ||
            undefined
          }
          startAdornment={
            <div className="p-4 bg-[#EEEEF0] !rounded-[10px]">
              <Image
                src={telegramIcon}
                width={16}
                height={16}
                alt="X"
              />
            </div>
          }
          {...getFieldProps("org_support_telegram_user_name")}
        />
        <OntonInput
          className="mb-3"
          label="X Handle"
          error={(errors.org_x_link && touched.org_x_link && errors.org_x_link) || undefined}
          startAdornment={
            <div className="p-4 bg-[#EEEEF0] !rounded-[10px]">
              <Image
                src={xPlatformIcon}
                width={16}
                height={16}
                alt="X"
              />
            </div>
          }
          {...getFieldProps("org_x_link")}
        />
        <OntonExpandableInput
          label="Bio"
          name="org_bio"
          value={values.org_bio}
          onChange={handleChange}
        />
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-neutral-800">
          <Button
            className="py-5 mb-3 !rounded-[10px]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={isSubmitting}
          >
            Save Changes
          </Button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goBack();
            }}
            className="w-full rounded-[10px] px-4 py-2 border-2 border-[#007AFF] text-[#007aff] font-semibold uppercase text-sm"
          >
            Discard
          </button>
        </div>
      </div>
    </form>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}
