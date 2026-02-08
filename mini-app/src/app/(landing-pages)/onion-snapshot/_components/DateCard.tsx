"use client";

import CustomCard from "@/app/_components/atoms/cards/CustomCard";
import CustomSheet from "@/app/_components/Sheet/CustomSheet";
import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { useConfigDate } from "@/hooks/useConfigDate";
import useWebApp from "@/hooks/useWebApp";
import { isTelegramUrl } from "@tonconnect/ui-react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DateCardProps = {
  iconSrc: string;
  title: string;
  endDateKey?: string;
  date?: string;
  description?: string;
  link?: string;
  linkText?: string;
  linkAfter?: string;
  linkTextAfter?: string;
  showCountdown?: boolean;
  status?: React.ReactNode;
};

const DateCard = ({
  iconSrc,
  title,
  endDateKey,
  date,
  description,
  link,
  linkText = "More",
  linkAfter,
  linkTextAfter,
  showCountdown = false,
  status,
}: DateCardProps) => {
  const webapp = useWebApp();
  const router = useRouter();

  const timeLeft = useConfigDate(endDateKey || "");
  const formattedDate =
    timeLeft?.endDate?.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) || date;

  const handleLinkClilck = (link: string) => {
    if (!link) {
      // open a modal
      return;
    }

    if (link?.startsWith("/")) {
      router.push(link);
    } else {
      if (isTelegramUrl(link)) {
        webapp?.openTelegramLink(link);
      } else {
        webapp?.openLink(link, {
          try_instant_view: true,
        });
      }
    }
  };

  useEffect(() => {
    if (link?.startsWith("/")) {
      router.prefetch(link);
    }
  }, [webapp, link]);

  return (
    <>
      <CustomCard defaultPadding>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center gap-1">
              <div className="flex gap-2 items-start">
                <div className="h-10 w-10">
                  <Image
                    src={iconSrc}
                    width={40}
                    height={40}
                    alt={title}
                  />
                </div>
                <div className="flex flex-col">
                  <Typography variant="title3">{title}</Typography>
                  {formattedDate && (
                    <Typography
                      variant="footnote"
                      weight="medium"
                    >
                      {formattedDate}
                    </Typography>
                  )}
                </div>
              </div>
              {(linkAfter && !timeLeft) || link ? (
                <Button
                  variant="link"
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClilck((timeLeft || !endDateKey) && link ? link : linkAfter || "");
                  }}
                  className="flex items-center align-middle text-primary p-0"
                >
                  <Typography weight="medium">{!timeLeft ? linkTextAfter : linkText}</Typography>
                  <ChevronRight
                    size={16}
                    strokeWidth={2}
                  />
                </Button>
              ) : (
                <ItemModal
                  linkText={linkText}
                  title={title}
                  iconSrc={iconSrc}
                  description={description}
                  subtitle={"On " + (date || formattedDate || "")}
                />
              )}
            </div>
          </div>
          {showCountdown && timeLeft && (
            <div className="flex items-center justify-center gap-1 bg-brand-bg">
              <span className="text-lg">⏳</span>
              <Typography
                variant="headline"
                weight="semibold"
              >
                {timeLeft.days || timeLeft.hours || timeLeft.minutes || timeLeft.seconds}
              </Typography>
              <Typography
                variant="caption2"
                weight="medium"
              >
                {timeLeft.days ? "Days" : timeLeft.hours ? "Hours" : timeLeft.minutes ? "Minutes" : "Seconds"} Left
              </Typography>
            </div>
          )}
          {status && <div className="flex items-center justify-center gap-1 bg-[#EFEFF4] py-1">{status}</div>}
        </div>
      </CustomCard>
    </>
  );
};

const ItemModal = ({
  title,
  linkText,
  iconSrc,
  description,
  subtitle,
}: {
  title: string;
  linkText: string;
  iconSrc: string;
  description?: string;
  subtitle?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        variant="link"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="flex items-center align-middle text-primary p-0"
      >
        <Typography weight="medium">{linkText}</Typography>
        <ChevronRight
          size={16}
          strokeWidth={2}
        />
      </Button>
      <CustomSheet
        title={title}
        opened={isOpen}
        onClose={() => setIsOpen(false)}
        hideClose
        hideTitle
      >
        <div className="flex flex-col gap-5 text-center items-center justify-center">
          <div className="flex flex-col gap-2 items-center justify-center">
            <Image
              src={iconSrc}
              width={80}
              height={80}
              alt={title}
            />
            <Typography
              variant="title1"
              weight="bold"
            >
              {title}
            </Typography>
            <Typography
              variant="footnote"
              weight="medium"
            >
              {subtitle}
            </Typography>
          </div>
          {description && (
            <Typography
              variant="headline"
              weight="normal"
              className="leading-[25px] tracking-tight"
            >
              {description}
            </Typography>
          )}
          <Button
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="w-full"
            size="lg"
          >
            Close
          </Button>
        </div>
      </CustomSheet>
    </>
  );
};

export default DateCard;
