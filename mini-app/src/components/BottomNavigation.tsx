import { cn } from "@/utils";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import CalendarIcon from "./icons/navigation/calendar-icon";
import PeopleIcon from "./icons/navigation/people-icon";
import PlayIcon from "./icons/navigation/play-icon";
import UserIcon from "./icons/navigation/user-icon";
import Typography from "./Typography";

interface Tab {
  title: string;
  icon: JSX.Element;
  urls: string[];
}

const tabs: Tab[] = [
  {
    title: "Events",
    icon: <CalendarIcon />,
    urls: ["/"],
  },
  {
    title: "Channels",
    icon: <PeopleIcon />,
    urls: ["/channels"],
  },
  {
    title: "Play2Win",
    icon: <PlayIcon />,
    urls: ["/play-2-win"],
  },
  {
    title: "My ONTON",
    icon: <UserIcon />,
    urls: ["/my", "/my/points"],
  },
];

export default function BottomNavigation(props: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Prefetch routes for faster navigation
  useEffect(() => {
    for (const tab of tabs) {
      for (const url of tab.urls) {
        router.prefetch(url, {
          kind: PrefetchKind.FULL,
        });
      }
    }
  }, [router]);

  // Return children if current pathname doesn't exist in any tab's urls
  if (!tabs.some((tab) => tab.urls.includes(pathname))) {
    return <>{props.children}</>;
  }

  // Calculate navigation height including safe area
  const navHeight = "68px";

  return (
    <div className="flex flex-col min-h-screen bg-ios-light-surface dark:bg-ios-dark-surface">
      <div
        className="flex-1 p-4 overflow-y-auto isolate"
        style={{
          paddingBottom: `calc(${navHeight} + 1rem + var(--tg-safe-area-inset-bottom))`,
        }}
      >
        {props.children}
      </div>
      <div className="fixed left-0 bottom-0 w-full">
        <div
          className="flex-1 w-full flex bg-white items-center justify-between px-4 gap-4 z-[1000]"
          style={{ height: navHeight }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.title}
              className={cn(
                "flex-1 flex flex-col gap-0.5 items-center justify-center cursor-pointer text-[#6D6D72]",
                tab.urls.includes(pathname) && "text-primary"
              )}
              onClick={(e) => {
                e.preventDefault();
                router.push(tab.urls[0]);
              }}
            >
              {tab.icon}
              <Typography
                weight="normal"
                variant="footnote"
                truncate
              >
                {tab.title}
              </Typography>
            </div>
          ))}
        </div>
        <div
          className="h-[var(--tg-safe-area-inset-bottom)] bg-white/75"
          style={{
            backdropFilter: "blur(50px)",
          }}
        />
      </div>
    </div>
  );
}
