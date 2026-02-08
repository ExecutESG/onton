"use client";

import { useUtils } from "@tma.js/sdk-react";
import { Button } from "@ui/base/button";
import QueryState from "@ui/components/blocks/QueryState";

export default function Page() {
  const tmaUtils = useUtils(true);

  return (
    <QueryState
      isError
      text="Event Hash Not Found"
      description="If you have been redirected here, please open the event via it's direct link"
    >
      <Button
        onClick={() => {
          tmaUtils?.openTelegramLink(
            `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=6acf01ed-3122-498a-a937-329766b459aa`
          );
        }}
        className="mt-6 px-2 text-white"
      >
        TON Gateway 2024
        {/* Change */}
      </Button>
    </QueryState>
  );
}
