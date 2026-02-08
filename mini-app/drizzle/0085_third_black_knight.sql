DROP view event_details_search_list;
CREATE VIEW "public"."event_details_search_list" AS  SELECT e.event_id,
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
                                                            e.city_id,
                                                            e.has_payment,
                                                            e.has_registration,
                                                            e.has_approval,
                                                            e.category_id,
                                                            city.title AS city,
                                                            e.country_id,
                                                            country.title AS country,
                                                            e.participation_type,
                                                            organizer.user_id AS organizer_user_id,
                                                            organizer.first_name AS organizer_first_name,
                                                            organizer.last_name AS organizer_last_name,
                                                            organizer.username AS organizer_username,
                                                            organizer.photo_url AS organizer_photo_url,
                                                            COALESCE(organizer.org_channel_name, organizer.first_name::character varying) AS organizer_channel_name,
                                                            COALESCE(organizer.org_image, organizer.photo_url::character varying) AS organizer_image,
                                                            organizer.org_bio AS organizer_bio,
                                                            organizer.org_x_link AS organizer_x_link,
                                                            organizer.org_support_telegram_user_name AS organizer_support_telegram_user_name,
                                                            ( SELECT count(t.id) AS count
                                                              FROM tickets t
                                                              WHERE t.event_uuid = e.event_uuid) AS reserved_count,
                                                            ( SELECT count(v.id) AS count
                                                              FROM visitors v
                                                              WHERE v.event_uuid = e.event_uuid) AS visitor_count,
                                                            min_tickets.id AS ticket_id,
                                                            min_tickets.title AS ticket_title,
                                                            min_tickets.description AS ticket_description,
                                                            min_tickets.price AS ticket_price,
                                                            min_tickets.ticket_image,
                                                            min_tickets.payment_type
                                                     FROM events e
                                                              LEFT JOIN users organizer ON e.owner = organizer.user_id
                                                              LEFT JOIN giata_city city ON e.city_id = city.id
                                                              LEFT JOIN giata_city country ON e.country_id = country.id
                                                              LEFT JOIN LATERAL ( SELECT et.id,
                                                                                         et.title,
                                                                                         et.description,
                                                                                         et.price,
                                                                                         et.ticket_image,
                                                                                         et.payment_type
                                                                                  FROM event_payment_info et
                                                                                  WHERE et.event_uuid = e.event_uuid
                                                                                  ORDER BY et.price
                                                                                  LIMIT 1) min_tickets ON true;-- Custom SQL migration file, put you code below! --
