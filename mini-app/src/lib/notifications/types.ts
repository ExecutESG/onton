export type NotificationChannel = "email" | "telegram" | "push" | "in_app";

export interface NotificationRecipient {
  userId: number | string;
  email?: string | null;
  telegramId?: number | string | null;
  name?: string | null;
  preferredChannel?: NotificationChannel;
}

export interface EventTicketDetails {
  ticketName?: string;
  ticketCode?: string;
  ticketPrice?: string | number;
  qrCodeUrl?: string;
  quantity?: number;
}

export interface EventTicketNotification {
  eventUuid: string;
  eventTitle: string;
  eventSubtitle?: string;
  eventDescription?: string;
  startDate?: Date | number | string | null;
  endDate?: Date | number | string | null;
  location?: string | null;
  bannerUrl?: string | null;
  organizerName?: string | null;
  recipient: NotificationRecipient;
  ticket?: EventTicketDetails;
}

export interface OrganizerTicketSaleNotification {
  eventUuid: string;
  eventTitle: string;
  buyerName: string;
  amount: string | number;
  currency: string;
  ticketTierName?: string | null;
  registeredCount: number;
  capacity?: number | null;
  recipient: NotificationRecipient;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  recipientId: string | number;
  messageId?: string;
  fallbackUsed?: boolean;
  error?: string;
}

