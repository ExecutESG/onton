"use client";
import { useState, useEffect } from "react";
import { useConfig } from "@/context/ConfigContext";
import Image from "next/image";
import GenesisOnionHead from "./../_assets/images/onion-genesis-merge-haed.svg";
import { ONIONConnectWallet } from "./ONIONConnectWallet";
import { formatPadNumber } from "@/lib/utils";
import { getTimeLeft } from "@/lib/time.utils";

export const Header = () => {
  const config = useConfig();
  const endDateString = config["campeign_merge_date"];

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const endDate = endDateString ? new Date(endDateString) : null;
    if (!endDate) return;
    const updateTimer = () => {
      const { days, hours, minutes, seconds } = getTimeLeft(endDate);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [endDateString]);

  return (
    <div className="flex justify-between px-4 py-3 items-center gap-2 bg-navy-dark">
      <div className="text-xs">
        <Image
          src={GenesisOnionHead}
          alt="Secure Your $ONION Airdrop Now"
        />
        <div className="text-white sansation-bold text-sm">
          {formatPadNumber(timeLeft.days)} : {formatPadNumber(timeLeft.hours)} : {formatPadNumber(timeLeft.minutes)} :{" "}
          {formatPadNumber(timeLeft.seconds)}
        </div>
      </div>
      <ONIONConnectWallet />
    </div>
  );
};
