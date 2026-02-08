import { eventPayment, eventPayment as tickets } from "@/db/schema/eventPayment";
import { eventTokens } from "@/db/schema/eventTokens";
import { events } from "@/db/schema/events";
import { giataCity } from "@/db/schema/giataCity";
import { users } from "@/db/schema/users";
import { visitors } from "@/db/schema/visitors";
import { sql } from "drizzle-orm";
import { bigint, boolean, integer, pgView, text, timestamp, uuid } from "drizzle-orm/pg-core";

// this view is used to get the event details with the ticket and visitor count
export const event_details_search_list = pgView("event_details_search_list", {
  eventId: bigint("event_id", { mode: "number" }),
  eventUuid: uuid("event_uuid"),
  title: text("title"),
  description: text("description"),
  startDate: bigint("start_date", { mode: "number" }),
  endDate: bigint("end_date", { mode: "number" }),
  type: text("type"),
  societyHub: text("society_hub"),
  societyHubID: bigint("society_hub_id", { mode: "number" }),
  imageUrl: text("image_url"),
  location: text("location"),
  subtitle: text("subtitle"),
  ticketToCheckIn: boolean("ticketToCheckIn"),
  timezone: text("timezone"),
  website: text("website"),
  createdAt: timestamp("created_at"),
  hidden: boolean("hidden"),
  participationType: text("participation_type"),
  organizerUserId: bigint("organizer_user_id", { mode: "number" }),
  organizerFirstName: text("organizer_first_name"),
  organizerLastName: text("organizer_last_name"),
  organizerUsername: text("organizer_username"),
  organizerChannelName: text("organizer_channel_name"),
  organizerImage: text("organizer_image"),
  organizerBio: text("organizer_bio"),
  organizerXLink: text("organizer_x_link"),
  organizerSupportTelegramUsername: text("organizer_support_telegram_user_name"),
  reservedCount: bigint("reserved_count", { mode: "number" }),
  visitorCount: bigint("visitor_count", { mode: "number" }),
  ticketId: bigint("ticket_id", { mode: "number" }),
  ticketTitle: text("ticket_title"),
  ticketDescription: text("ticket_description"),
  ticketPrice: text("ticket_price"),
  ticketImage: text("ticket_image"),
  hasPayment: boolean("has_payment"),
  hasRegistration: boolean("has_registration"),
  hasApproval: boolean("has_approval"),
  paymentType: text("payment_type"),
  paymentTokenId: integer("payment_token_id"),
  categoryId: integer("category_id"),
  // ticketCount: integer("ticket_count"),
}).as(sql`
  SELECT
    e.event_id,
    e.event_uuid,
    e.title,
    e.description,
    e.start_date,
    e.end_date,
    e.type,
    e.society_hub,
    e.society_hub_id,
    e.image_url,
    e.location,
    e.subtitle,
    e."ticketToCheckIn",
    e.timezone,
    e.website,
    e.created_at,
    e.hidden,
    e.participation_type,
    e.country_id,
    e.city_id,   
    e.category_id,
    country.title AS country,
    city.title AS city,
    organizer.user_id AS organizer_user_id,
    organizer.first_name AS organizer_first_name,
    organizer.last_name AS organizer_last_name,
    organizer.username AS organizer_username,
    organizer.photo_url AS organizer_photo_url,
    COALESCE(organizer.org_channel_name, ((COALESCE(organizer.first_name, ''::text)  ' '::text)  COALESCE(organizer.last_name, ''::text))::character varying) AS organizer_channel_name,
    COALESCE(organizer.org_image, organizer.photo_url::character varying) AS organizer_image,
    organizer.org_bio AS organizer_bio,
    organizer.org_x_link AS organizer_x_link,
    organizer.org_support_telegram_user_name AS organizer_support_telegram_user_name,
    (SELECT count(t.id) AS count
     FROM ${tickets} t
     WHERE t.event_uuid::uuid = e.event_uuid) AS reserved_count,
    (SELECT count(v.id) AS count
     FROM ${visitors} v
     WHERE v.event_uuid = e.event_uuid) AS visitor_count,
    min_tickets.id AS ticket_id,
    min_tickets.title AS ticket_title,
    min_tickets.description AS ticket_description,
    min_tickets.price AS ticket_price,
    min_tickets.ticket_image,
    min_tickets.payment_type,
    min_tickets.payment_token_id
  FROM
    ${events} e
  LEFT JOIN
    ${users} organizer ON e.owner = organizer.user_id
  LEFT JOIN 
    ${giataCity} city ON e.city_id = city.id
  LEFT JOIN 
    ${giataCity} country ON e.country_id = country.id
  LEFT JOIN
    LATERAL (SELECT et.id,
                    et.title,
                    et.description,
                    et.price,
                    et.ticket_image,
                    tok.symbol AS payment_type,
                    et.token_id AS payment_token_id
             FROM ${eventPayment} et
             JOIN ${eventTokens} tok ON tok.token_id = et.token_id
             WHERE et.event_uuid = e.event_uuid
             ORDER BY et.price
             LIMIT 1) min_tickets ON true
`);
