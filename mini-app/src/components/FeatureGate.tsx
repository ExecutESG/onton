"use client";

import DataStatus from "@/app/_components/molecules/alerts/DataStatus";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/context/ConfigContext";
import useWebApp from "@/hooks/useWebApp";
import Link from "next/link";
import React from "react";
import Typography from "./Typography";

interface FeatureGateProps {
  featureName: string;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ featureName, children }) => {
  const config = useConfig();
  const isFeatureDisabled = config && config[featureName];

  const webApp = useWebApp();

  if (isFeatureDisabled) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center max-w-md p-4 text-center bg-white">
        <div>
          <DataStatus
            status="temp_unavailable"
            size="lg"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Typography variant="title2">🚧 Temporarily Unavailable</Typography>
          <Typography
            variant="callout"
            className="text-balance font-normal"
          >
            Looks like this part isn&apos;t working right now. We&apos;re on it and things should be back to normal soon!
          </Typography>

          <Typography
            variant="callout"
            className="text-balance font-normal"
          >
            Thanks for your patience 💙
          </Typography>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href="/">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
            >
              Explore ONTON
            </Button>
          </Link>
          <Button
            variant="info"
            size="lg"
            onClick={(e) => {
              e.preventDefault();
              webApp?.openTelegramLink("https://onton.com/support");
            }}
            className="w-full"
          >
            Need Help?
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
