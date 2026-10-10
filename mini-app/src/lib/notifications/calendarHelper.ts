/**
 * Generates RFC 5545 compliant iCalendar (.ics) format strings
 * for email calendar invitations and mobile import.
 */

export interface CalendarEventParams {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startDate?: Date | number | string | null;
  endDate?: Date | number | string | null;
  url?: string;
  organizerEmail?: string;
}

const formatIcsDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const sanitizeIcsText = (text: string): string => {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
};

export const generateIcsContent = (params: CalendarEventParams): string => {
  const now = new Date();
  const start = params.startDate
    ? new Date(typeof params.startDate === "number" && params.startDate < 1e11 ? params.startDate * 1000 : params.startDate)
    : new Date(now.getTime() + 3600000);

  const end = params.endDate
    ? new Date(typeof params.endDate === "number" && params.endDate < 1e11 ? params.endDate * 1000 : params.endDate)
    : new Date(start.getTime() + 7200000); // 2 hours default

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ONTON Platform//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}@onton.live`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${sanitizeIcsText(params.summary)}`,
    params.description ? `DESCRIPTION:${sanitizeIcsText(params.description)}` : "",
    params.location ? `LOCATION:${sanitizeIcsText(params.location)}` : "",
    params.url ? `URL:${params.url}` : "",
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.filter(Boolean).join("\r\n");
};
