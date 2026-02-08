"use client";

import useWebApp from "@/hooks/useWebApp";
import { cn } from "@/lib/utils";
import { Block, BlockTitle, Sheet } from "konsta/react";
import { CircleArrowUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, KButton } from "./button";

type UploadFileProps = {
  triggerText: React.ReactNode;
  infoText: React.ReactNode;
  changeText: React.ReactNode;
  onVideoChange?: (video_url: string) => void;
  isError?: boolean;
  onDone?: (video_url: string) => void;
  disabled?: boolean;
  defaultVideo?: string;
  drawerDescriptionText?: string;
};

export const UploadVideoFile = (props: UploadFileProps) => {
  const webApp = useWebApp();
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [videoPreview, setVideoPreview] = useState<string | undefined>(props.defaultVideo);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Local states to handle uploading logic
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setError(null);

    // Basic validations
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be under 5 MB");
      return;
    }

    if (file.type !== "video/mp4") {
      setError("Only MP4 format is allowed");
      return;
    }

    try {
      // Prepare multipart/form-data
      const formData = new FormData();
      formData.append("video", file);
      formData.append("subfolder", "event");

      setIsUploading(true);

      // Get Telegram initData (assuming webApp?.initData exists)
      const initData = webApp?.initData || "";

      // Send request, adding initData in headers
      const res = await fetch(
        // Update with your real route:
        process.env.NEXT_PUBLIC_APP_BASE_URL + "/api/files/upload-video",
        {
          method: "POST",
          body: formData,
          headers: {
            "x-init-data": initData,
          },
        }
      );

      if (!res.ok) {
        let msg = "Failed to upload video.";
        try {
          const errJson = await res.json();
          msg = errJson.message || msg;
        } catch (_) {
          // ignore JSON parse errors
        }
        throw new Error(msg);
      }

      const data = await res.json();
      // e.g. { videoUrl: "..." }
      const updatedUrl = `${data.videoUrl}?t=${Date.now()}`;
      setVideoPreview(updatedUrl);
      props.onVideoChange?.(updatedUrl);

      // Clear the file input
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to upload video. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Hide the Telegram WebApp MainButton while the bottom sheet is open
  useEffect(() => {
    if (isSheetOpen) {
      webApp?.MainButton.hide();
    } else {
      webApp?.MainButton.show();
    }
  }, [isSheetOpen, webApp]);

  return (
    <>
      <Button
        className={cn(
          "w-full h-auto flex flex-col gap-3.5 border border-dashed rounded-xl p-3 bg-primary/10",
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
        {videoPreview ? (
          <div className="flex gap-4 items-center justify-start w-full">
            <video
              key={videoPreview}
              width="80"
              height="80"
              autoPlay
              loop
              muted
              playsInline
              className="rounded-xl"
            >
              <source
                src={videoPreview}
                type="video/mp4"
              />
            </video>
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
          onBackdropClick={(e) => {
            e.preventDefault();
            setIsSheetOpen(false);
          }}
          className={cn("w-full")}
        >
          <BlockTitle>Upload Video</BlockTitle>
          <Block className="space-y-2">
            {!videoPreview && <p>{props.drawerDescriptionText || "Upload an MP4 video from your device (max 5 MB)"}</p>}

            {videoPreview && (
              <video
                key={videoPreview}
                controls
                width="100"
                height="100"
                className="w-full h-auto"
              >
                <source
                  src={videoPreview}
                  type="video/mp4"
                />
              </video>
            )}

            {/* Error messages */}
            {error && <div className="text-red-500 text-sm w-full text-balance mt-2">{error}</div>}

            <input
              ref={videoInputRef}
              type="file"
              name="video"
              accept="video/mp4"
              onChange={handleFileChange}
              id="event_video_input"
              className="hidden"
            />

            <KButton
              itemType="button"
              clear
              className="w-full h-12.5 flex items-center gap-2"
              disabled={isUploading || props.disabled}
              onClick={(e) => {
                e.preventDefault();
                videoInputRef.current?.click();
              }}
            >
              <CircleArrowUp className="w-5" />
              <span>{videoPreview ? "Change Video" : "Upload Video"}</span>
            </KButton>

            {videoPreview && (
              <KButton
                className="w-16 h-10 mx-auto rounded-full mt-4"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSheetOpen(false);
                  if (props.onDone) props.onDone(videoPreview);
                }}
                itemType="button"
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
