import { cn } from "@/utils";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import CalendarIcon from "./icons/navigation/calendar-icon";
import PeopleIcon from "./icons/navigation/people-icon";
import PlayIcon from "./icons/navigation/play-icon";
import UserIcon from "./icons/navigation/user-icon";
import Typography from "./Typography";
import { useUserStore } from "@/context/store/user.store";
import { useLoginStore } from "@/context/store/login.store";

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
  const { user } = useUserStore();
  const { openLogin } = useLoginStore();

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
    <div className="flex flex-col md:flex-row min-h-screen bg-ios-light-surface dark:bg-ios-dark-surface">
      {/* Desktop Left Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:left-0 md:top-0 md:h-screen md:border-r md:border-gray-200 dark:md:border-gray-800 md:bg-white dark:md:bg-ios-dark-surface z-[1000] p-4 gap-6">
        <div className="flex items-center gap-2 px-2 py-4">
          <span className="text-xl font-bold text-primary">ONTON</span>
        </div>
        <div className="flex flex-col gap-1">
          {tabs.map((tab) => {
            const isMyOnton = tab.title === "My ONTON";
            const showLogin = isMyOnton && !user;
            const displayTitle = showLogin ? "Login" : tab.title;

            return (
              <div
                key={tab.title}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-[#6D6D72] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                  !showLogin && tab.urls.includes(pathname) && "text-primary bg-primary/10 hover:bg-primary/10"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  if (showLogin) {
                    openLogin();
                  } else {
                    router.push(tab.urls[0]);
                  }
                }}
              >
                <div className="w-6 h-6 flex items-center justify-center">{tab.icon}</div>
                <span className="text-sm font-medium">{displayTitle}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 p-4 overflow-y-auto isolate pb-[calc(68px+1rem+var(--tg-safe-area-inset-bottom))] md:pb-8 md:pl-72">
        {props.children}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed left-0 bottom-0 w-full md:hidden">
        <div
          className="flex-1 w-full flex bg-white items-center justify-between px-4 gap-4 z-[1000]"
          style={{ height: navHeight }}
        >
          {tabs.map((tab) => {
            const isMyOnton = tab.title === "My ONTON";
            const showLogin = isMyOnton && !user;
            const displayTitle = showLogin ? "Login" : tab.title;

            return (
              <div
                key={tab.title}
                className={cn(
                  "flex-1 flex flex-col gap-0.5 items-center justify-center cursor-pointer text-[#6D6D72]",
                  !showLogin && tab.urls.includes(pathname) && "text-primary"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  if (showLogin) {
                    openLogin();
                  } else {
                    router.push(tab.urls[0]);
                  }
                }}
              >
                {tab.icon}
                <Typography
                  weight="normal"
                  variant="footnote"
                  truncate
                >
                  {displayTitle}
                </Typography>
              </div>
            );
          })}
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
