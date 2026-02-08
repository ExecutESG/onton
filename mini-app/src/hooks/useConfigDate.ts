import { useConfig } from "@/context/ConfigContext";
import { getTimeLeft } from "@/lib/time.utils";
import { useEffect, useMemo, useState } from "react";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  endDate: Date | null;
  isEnded: boolean;
};

export const useConfigDate = (configKey: string) => {
  const config = useConfig();
  const endDateString = config[configKey];

  const defaultValues: TimeLeft | null = useMemo(() => {
    const endDate = endDateString ? new Date(endDateString) : null;
    if (!endDate) return null;
    const { days, hours, minutes, seconds } = getTimeLeft(endDate);

    return {
      days,
      hours,
      minutes,
      seconds,
      endDate,
      isEnded: days <= 0 && hours <= 0 && minutes <= 0 && seconds <= 0,
    };
  }, [endDateString]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(defaultValues);

  useEffect(() => {
    const endDate = endDateString ? new Date(endDateString) : null;
    if (!endDate) return;

    const updateTimer = () => {
      const { days, hours, minutes, seconds } = getTimeLeft(endDate);
      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        endDate,
        isEnded: days <= 0 && hours <= 0 && minutes <= 0 && seconds <= 0,
      });
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [endDateString]);

  return timeLeft;
};
