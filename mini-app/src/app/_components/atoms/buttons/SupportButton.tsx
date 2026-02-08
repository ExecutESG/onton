"use client";

import Typography from "@/components/Typography";
import { TG_SUPPORT_GROUP } from "@/constants";
import useWebApp from "@/hooks/useWebApp";
import { sleep } from "@/utils";
import React from "react";
import CustomButton from "../../Button/CustomButton";
import CustomCard from "../cards/CustomCard";

interface SupportButtonsProps {
  orgSupportTelegramUserName?: string | null;
}

const SupportButtons: React.FC<SupportButtonsProps> = ({ orgSupportTelegramUserName }) => {
  const webApp = useWebApp();
  const hapticfeedback = webApp?.HapticFeedback;

  // trim @ from the start of the username if provided
  const trimmedOrgSupport = orgSupportTelegramUserName?.replace(/^@/, "");

  return (
    <CustomCard
      title={"Support"}
      defaultPadding
    >
      <Typography
        variant="body"
        weight="normal"
        className="mb-2"
      >
        Do you have issues with SBT or payment?
      </Typography>
      <CustomButton
        variant="outline"
        fontWeight={"semibold"}
        onClick={(e) => {
          hapticfeedback?.impactOccurred("medium");
          webApp?.openTelegramLink(TG_SUPPORT_GROUP);
        }}
      >
        ONTON Support
      </CustomButton>
      {trimmedOrgSupport && (
        <>
          <Typography
            variant="body"
            weight="normal"
            className="my-2"
          >
            Do you have questions about the event?
          </Typography>
          <CustomButton
            variant="outline"
            fontWeight={"semibold"}
            onClick={(e) => {
              hapticfeedback?.impactOccurred("medium");
              webApp?.openTelegramLink(`https://t.me/${trimmedOrgSupport}`);
              sleep(100).then(() => {
                webApp?.close();
              });
            }}
          >
            Organizer Support
          </CustomButton>
        </>
      )}
    </CustomCard>
  );
};

export default SupportButtons;
