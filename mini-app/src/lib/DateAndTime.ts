export const isValidTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (ex) {
    return false;
  }
};
export const formatDate = (date: number): string => {
  const eventDate = new Date(date * 1000);
  return eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
export const formatDateTime = (date: number): string => {
  const eventDate = new Date(date * 1000);
  return eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    timeZone: "UTC",
  });
};
export const formatDateRange = (start: number, end: number, _timezone?: string): string => {
  if (!start || !end) return "Date not available";

  const startDate = new Date(start * 1000);
  const endDate = new Date(end * 1000);

  const startOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const endOptions = sameDay ? {} : startOptions;
  return `${startDate.toLocaleDateString("en-US", startOptions)}${
    sameDay ? "" : ` - ${endDate.toLocaleDateString("en-US", endOptions)}`
  } `;
};

// Helper to format time without seconds and using lowercase am/pm
export const formatTime = (date: Date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return minutes === 0 ? `${hours}${period}` : `${hours}:${minutes < 10 ? "0" : ""}${minutes}${period}`;
};

export const timestampToIsoString = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toISOString();
};
