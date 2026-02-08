import Typography from "@/components/Typography";
import { Button } from "@/components/ui/button";
import { TokenCampaignNftCollections } from "@/db/schema";
import { cn } from "@/utils";
import Image from "next/image";
import { useRef, useState } from "react";
import { Swiper as SwiperType } from "swiper";
import "swiper/css";
import { Swiper, SwiperSlide } from "swiper/react";
import useSound from "use-sound";
import { customToast } from "../../GenesisOnions.utils";
import { useSpin } from "../../hooks/useSpin";
import { useUserCampaign } from "../../hooks/useUserCampaign";
import { CountdownTimer } from "../CountdownTimer";

import sound1 from "../../_assets/sounds/mixkit-air-in-a-hit-2161.wav";
import sound2 from "../../_assets/sounds/mixkit-cinematic-glass-hit-suspense-677.wav";
interface Props {
  onEligibilityCheckFailed: () => void;
  onInsufficientBalance: () => void;
  onSpinStart: () => void;
  onSpinEnd: (result: TokenCampaignNftCollections) => void;
}

export const RaffleCarousel = ({ onEligibilityCheckFailed, onInsufficientBalance, onSpinStart, onSpinEnd }: Props) => {
  const [play1] = useSound(sound1);
  const [play2] = useSound(sound2);
  const swiperRef = useRef<SwiperType>();
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const { slides, isLoadingCollections, isErrorCollections, spin } = useSpin();
  const {
    userSpinStats,
    isLoadingUserSpinStats,
    isErrorUserSpinStats,
    refetchUserSpinStats,
    isEligible,
    isLoadingEligibility,
    isErrorEligibility,
    refetchEligibility,
  } = useUserCampaign();

  const waitForTransition = () => {
    return new Promise<void>((resolve, reject) => {
      const swiper = swiperRef.current;
      if (!swiper) {
        reject("Swiper instance not available");
        return;
      }

      // Add timeout as fallback
      const timeout = setTimeout(() => {
        swiper.off("transitionEnd", onTransitionEnd);
        resolve();
      }, 1000); // 1 second timeout

      const onTransitionEnd = () => {
        clearTimeout(timeout);
        swiper.off("transitionEnd", onTransitionEnd);
        resolve();
      };

      swiper.on("transitionEnd", onTransitionEnd);
    });
  };

  const spinRaffle = async () => {
    if (!swiperRef.current || isSpinning || !slides?.length) return;

    onSpinStart();
    setIsSpinning(true);

    const selectedIndex = await spin();

    if (typeof selectedIndex === "undefined") throw new Error("No proper result received!");

    const selectedSlide = slides[selectedIndex];

    try {
      // Fast spinning phase
      const fastSpinDuration = 150;
      swiperRef.current.params.speed = fastSpinDuration;

      for (let i = 0; i < Math.floor(slides.length * 0.7); i++) {
        play1();
        swiperRef.current.slideTo(i % slides.length);
        await waitForTransition();
      }

      // Slowing down phase
      const slowDownDuration = 300;
      for (let i = 0; i < 5; i++) {
        swiperRef.current.params.speed = slowDownDuration * (i + 1);
        swiperRef.current.slideTo((selectedIndex - 4 + i) % slides.length);
        play1();
        await waitForTransition();
      }

      // Final slide
      swiperRef.current.params.speed = 500;
      swiperRef.current.slideTo(selectedIndex);
      play2();
      window.Telegram.WebApp.HapticFeedback.impactOccurred("rigid");
      await waitForTransition();

      refetchUserSpinStats();
      if (selectedSlide) onSpinEnd(selectedSlide);
    } catch (error) {
      console.error("Error during spin:", error);
      // Fallback to setting result if transition fails
    } finally {
      setIsSpinning(false);
    }
  };

  const remainingSpins = userSpinStats?.remaining ?? 0;

  const scrollToTop = () => {
    const div = document.querySelector("body>div");

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      div?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const handleButtonClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isErrorEligibility) {
      refetchEligibility();
      customToast.error("Error checking eligibility. Please try again.");
      return;
    }

    if (isEligible === false) {
      onEligibilityCheckFailed();
      return;
    }
    if (remainingSpins > 0) {
      scrollToTop();
      spinRaffle();
    } else {
      onInsufficientBalance();
    }
  };

  if (isLoadingCollections) return null;
  if (isErrorCollections) return <div>Error loading slides! Please try again.</div>;

  return (
    <div className="flex flex-col gap-4 relative z-10 w-full max-w-full overflow-hidden">
      <div className="raffle-container max-w-full">
        <Swiper
          onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          slidesPerView={2.3}
          centeredSlides={true}
          spaceBetween={0}
          speed={200}
          initialSlide={1}
          draggable={false}
          allowTouchMove={false}
        >
          {slides?.map((item, index) => (
            <SwiperSlide
              key={index}
              data-id={item.id}
            >
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 transform transition-all duration-300",
                  activeIndex === index ? "scale-100" : "scale-[.88]"
                )}
              >
                {item.image && (
                  <Image
                    width={240}
                    height={240}
                    src={item.image}
                    alt={item.name ?? ""}
                    className="w-full h-full object-cover object-center rounded-2lg"
                  />
                )}
                <Typography
                  variant="footnote"
                  weight="normal"
                >
                  {item.name}
                </Typography>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <div className="px-4 flex flex-col gap-4">
        <Typography
          variant="caption1"
          weight="normal"
          className="px-15 text-center"
        >
          Spin the wheel, unwrap Genesis ONION NFTs, and collect your $ONION airdrop.
        </Typography>

        <CountdownTimer title="Limited Time Offer! Ends in" />

        <div className="flex flex-col gap-3">
          <Typography
            variant="subheadline1"
            className="flex gap-1 justify-center items-end font-semibold"
          >
            You have{" "}
            <Typography
              variant="headline"
              className="text-gold-light"
            >
              {remainingSpins}
            </Typography>{" "}
            spins left!
          </Typography>

          <Button
            onClick={handleButtonClick}
            type="button"
            size="lg"
            disabled={
              isSpinning || isLoadingUserSpinStats || isErrorUserSpinStats || isLoadingEligibility || isErrorEligibility
            }
            isLoading={isSpinning}
            className="w-full btn-gradient btn-shine md:w-96 px-8 py-3 rounded-lg text-white font-semibold text-lg transition-all transform focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 hover:bg-orange hover:animate-none after:bottom-0 before:top-0 relative overflow-hidden isolate"
          >
            <Typography
              variant="headline"
              weight="semibold"
            >
              {remainingSpins === 0 ? "Get More Spins" : "Spin to win!"}
            </Typography>
          </Button>
        </div>
      </div>
    </div>
  );
};
