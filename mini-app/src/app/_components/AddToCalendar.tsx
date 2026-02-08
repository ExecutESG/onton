"use client";

import Divider from "@/components/Divider";
import { Block } from "konsta/react";
import { LucideCalendarPlus } from "lucide-react";
import * as React from "react";
import { AiFillYahoo } from "react-icons/ai";
import { PiMicrosoftOutlookLogoFill } from "react-icons/pi";
import { SiGooglecalendar } from "react-icons/si";
import CustomButton from "./Button/CustomButton";
import CustomSheet from "./Sheet/CustomSheet";

// Assuming shadcn drawer is structured like this

type Props = {
  title: string;
  startDate: number; // UTC timestamp in milliseconds
  endDate: number; // UTC timestamp in milliseconds
  description: string;
};

const formatDateToGoogleCalendar = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const AddToCalendar = ({ title, startDate, endDate, description }: Props) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const startFormatted = formatDateToGoogleCalendar(startDate);
  const endFormatted = formatDateToGoogleCalendar(endDate);

  const googleCalendarLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${startFormatted}/${endFormatted}&details=${encodeURIComponent(description)}`;

  const outlookLink = `https://outlook.live.com/owa/?path=/calendar/action/compose&rru=addevent&startdt=${new Date(
    startDate
  ).toISOString()}&enddt=${new Date(endDate).toISOString()}&subject=${encodeURIComponent(
    title
  )}&body=${encodeURIComponent(description)}`;

  const yahooLink = `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${encodeURIComponent(
    title
  )}&st=${new Date(startDate).toISOString()}&et=${new Date(endDate).toISOString()}&desc=${encodeURIComponent(description)}`;

  // Function to open the link using Telegram Web App API and close drawer
  const openInOSBrowser = (url: string) => {
    if (window.Telegram.WebApp) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, "_blank", "noopener noreferrer");
    }
    setIsOpen(false); // Close drawer after clicking link
  };

  return (
    <>
      <CustomButton
        variant="outline"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        icon={<LucideCalendarPlus />}
      >
        Add to Calendar
      </CustomButton>
      <CustomSheet
        opened={isOpen}
        onClose={() => setIsOpen(false)}
        title="Add to Calendar"
        defaultPadding={false}
      >
        <Block className="flex flex-col gap-2 justify-between">
          <div className="p-4 w-full flex flex-col gap-1">
            <CustomButton
              variant="link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openInOSBrowser(googleCalendarLink);
              }}
              fontWeight={"normal"}
              icon={<SiGooglecalendar />}
            >
              Add to Google Calendar
            </CustomButton>
            <Divider height={"1"} />
            <CustomButton
              variant="link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openInOSBrowser(outlookLink);
              }}
              icon={<PiMicrosoftOutlookLogoFill />}
              fontWeight={"normal"}
            >
              Add to Outlook Calendar
            </CustomButton>
            <Divider height={"1"} />
            <CustomButton
              variant="link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openInOSBrowser(yahooLink);
              }}
              icon={<AiFillYahoo />}
              fontWeight={"normal"}
            >
              Add to Yahoo Calendar
            </CustomButton>
          </div>
          {/* Close button at the bottom */}
          <CustomButton
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            Close
          </CustomButton>
        </Block>
      </CustomSheet>
    </>
  );
};

export default AddToCalendar;
