"use client";

import DataStatus from "@/app/_components/molecules/alerts/DataStatus";
import { Button } from "@/components/ui/button";
import useWebApp from "@/hooks/useWebApp";
import Link from "next/link";
import React from "react";
import Typography from "./Typography";

interface NotFoundProps {
  dummy?: string;
}

export const NotFound: React.FC<NotFoundProps> = () => {
  const webApp = useWebApp();

  return (
    <div className="flex flex-col gap-6 items-center justify-center max-w-md p-4 text-center bg-white h-screen">
      <div>
        <DataStatus
          status="searching"
          size="lg"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Typography variant="title2">🧩 Page Not Found</Typography>
        <Typography
          variant="callout"
          className="text-balance font-normal"
        >
          Oops — we couldn&apos;t find that page. It might&apos;ve moved, or maybe it never existed at all.
        </Typography>
        <Typography
          variant="callout"
          className="text-balance font-normal"
        >
          Let&apos;s get you back on track 🚀
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
            e.stopPropagation();
            webApp?.openTelegramLink("https://onton.com/support");
          }}
          className="w-full"
        >
          Need Help?
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
