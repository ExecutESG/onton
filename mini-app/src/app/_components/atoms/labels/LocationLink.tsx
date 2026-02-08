"use client";

import Labels from "@/app/_components/atoms/labels/index";
import useWebApp from "@/hooks/useWebApp";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { BsLink45Deg } from "react-icons/bs";

const normalizeURL2 = (url: string) => {
  // remove protocol from the url, remove www if any, keep the rest of it, limit to 20 characters
  const cleanedUrl = url.replace(/(^\w+:|^)\/\//, "").replace(/www\./, "");
  return cleanedUrl.length > 20 ? cleanedUrl.slice(0, 20) + "..." : cleanedUrl;
};

type Props = {
  location: string;
  className?: string; // Allow passing a custom class for the Link container
};

const WebsiteLink = ({ location, className }: Props) => {
  const webApp = useWebApp();

  return (
    <Link
      href={"#"}
      onClick={() => {
        webApp?.openLink(location);
      }}
      className={cn(
        "flex items-center justify-center bg-gray-700 text-gray-200 hover:bg-gray-600 hover:text-gray-100 active:bg-gray-800 active:text-gray-300 px-4 py-3 rounded-xl w-full",
        className
      )}
    >
      <BsLink45Deg className="mr-2" />
      <Labels.Label className="truncate font-sm max-w-xs">Event Link: {normalizeURL2(location)}</Labels.Label>
    </Link>
  );
};

export default WebsiteLink;
