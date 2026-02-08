import { trpc } from "@/app/_trpc/client";
import useWebApp from "@/hooks/useWebApp";
import { wait } from "@/lib/utils";
import { LoaderIcon } from "lucide-react";
import Image from "next/image";
import shareIcon from "./share.svg";

interface TournamentShareProps {
  tournamentId: number | undefined;
}

export default function TournamentShareButton({ tournamentId }: TournamentShareProps) {
  const WebApp = useWebApp();
  if (!tournamentId) return null;
  const initData = WebApp?.initData || "";
  const hapticFeedback = WebApp?.HapticFeedback;

  // 1) Our tRPC mutation
  const shareTournamentMutation = trpc.telegramInteractions.requestShareTournament.useMutation();

  // 2) The share handler
  const share = async () => {
    if (!initData) return;

    // Fire the mutation
    await shareTournamentMutation.mutateAsync({ tournamentId });

    // Optionally open the bot, show haptic, wait, then close
    WebApp?.openTelegramLink(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`);
    hapticFeedback?.impactOccurred("medium");
    await wait(500);
    WebApp?.close();
  };

  return (
    <button
      className="w-8 h-8 bg-[#efeff4] rounded-md p-2 flex col-start-12 items-center justify-center"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        share();
      }}
      disabled={shareTournamentMutation.isLoading}
      title="Share this tournament"
    >
      {shareTournamentMutation.isLoading ? (
        <LoaderIcon className="animate-spin text-blue-600 w-4 h-4" />
      ) : (
        <Image
          src={shareIcon}
          width={16}
          height={16}
          alt="Share tournament"
        />
      )}
    </button>
  );
}
