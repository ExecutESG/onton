import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { TokenCampaignNftCollections } from "@/db/schema";
import { cn } from "@/utils";
import Image from "next/image";
import Confetti from "react-confetti";

interface Props {
  prize?: TokenCampaignNftCollections;
  onClose: () => void;
}

export const Prize = ({ prize, onClose }: Props) => {
  const isOpen = !!prize;

  return (
    <div
      className={cn(
        "w-screen h-screen fixed top-0 left-0 grid place-items-center bg-gradient-radial from-navy-mid to-navy z-50 text-white transition-opacity duration-500",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      onClick={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {isOpen && (
        <>
          <Confetti
            width={window.innerWidth - 20}
            numberOfPieces={100}
            className="place-self-center z-[1000] absolute top-0"
          />

          <div
            className={cn(
              "flex flex-col transition-all duration-500 items-center transform w-full",
              isOpen ? "translate-y-0 opacity-100 scale-100" : "translate-y-full opacity-0 scale-30"
            )}
          >
            {prize.image && (
              <div className="bg-[url('/rounded-pattern.svg')] bg-repeat-x w-full flex justify-center py-4">
                <Image
                  src={prize.image}
                  width={300}
                  height={300}
                  alt="Prize!"
                  className="rounded-2lg mb-2"
                />
              </div>
            )}

            <Typography
              variant="title3"
              weight="bold"
              className="mb-5"
            >
              {prize.name}
            </Typography>

            <Typography
              variant="body"
              weight="normal"
              className="mb-2"
            >
              Congrats! you acquired a {prize.name} ONION
            </Typography>

            <div className="px-4 w-full h-12">
              <Button
                className="flex-1 h-full bg-orange hover:bg-orange/80 w-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
              >
                <Typography
                  variant="body"
                  weight="medium"
                >
                  Keep Collecting
                </Typography>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
