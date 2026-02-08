import { pool } from "./pool";
import { logger } from "../utils/logger";
import { redisTools } from "../lib/redisTools";

// The shape of an event row
export interface EventRow {
  event_id: number;
  event_uuid: string;
  title: string;
  owner: number;
  end_date: number;
  event_telegram_group?: number | null;
}

/** Get event by "event_id" */
export async function getEventById(id: number) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT *
       FROM events
       WHERE event_id = $1`,
      [id],
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

/** Get event by "event_uuid" */
export async function getEvent(uuid: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT *
       FROM events
       WHERE event_uuid = $1`,
      [uuid],
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}


/** For admin: fetch all upcoming "online" + "registration" events */
export async function getUpcomingOnlineRegEventsForAdmin(): Promise<EventRow[]> {
  const client = await pool.connect();
  try {
    const sql = `
        SELECT event_id, event_uuid, title, owner, end_date, event_telegram_group
        FROM events
        WHERE participation_type = 'online'
          AND has_registration = TRUE
          AND end_date > EXTRACT(EPOCH FROM now())
        ORDER BY end_date ASC
        LIMIT 100
    `;
    const res = await client.query(sql);
    return res.rows;
  } finally {
    client.release();
  }
}

/** For organizer: fetch only the user’s events that are upcoming, online, and have registration */
export async function getUpcomingOnlineRegEventsForOrganizer(userId: number): Promise<EventRow[]> {
  const client = await pool.connect();
  try {
    const sql = `
        SELECT event_id, event_uuid, title, owner, end_date, event_telegram_group
        FROM events
        WHERE participation_type = 'online'
          AND has_registration = TRUE
          AND end_date > EXTRACT(EPOCH FROM now())
          AND owner = $1
        ORDER BY end_date ASC
        LIMIT 100
    `;
    const res = await client.query(sql, [userId]);
    return res.rows;
  } finally {
    client.release();
  }
}

/** Update event_telegram_group in DB */
export async function updateEventTelegramGroup(eventId: number, groupId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE events
       SET event_telegram_group = $1
       WHERE event_id = $2`,
      [groupId, eventId],
    );
  } finally {
    client.release();
  }
}

/**
 * Toggle "hidden" status of an event by UUID.
 */
export async function hideCmd(event_uuid: string, hide: boolean): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE events
       SET hidden = $1
       WHERE event_uuid = $2`,
      [hide, event_uuid],
    );

    const result = await client.query(
      `SELECT event_id
       FROM events
       WHERE event_uuid = $1`,
      [event_uuid],
    );

    if (!result.rows.length) {
      logger.error(`hideCmd: No event found for UUID=${event_uuid}`);
      return;
    }

    const eventId = result.rows[0].event_id;

    // Invalidate cache
    await redisTools.deleteCache(`${redisTools.cacheKeys.event_uuid}${event_uuid}`);
    await redisTools.deleteCache(`${redisTools.cacheKeys.event_id}${eventId}`);
  } finally {
    client.release();
  }
}

export async function getUpcomingPaidEvents(isAdmin: boolean, userId: string) {
  let sqlQuery = `
      SELECT event_uuid, event_id, title, end_date
      FROM events
      WHERE  end_date >= EXTRACT(EPOCH FROM now() - INTERVAL '2 month')
        AND has_payment = true
      ORDER BY end_date ASC
      LIMIT 50
  `;
  let sqlParams: any[] = [];

  // If not admin, add ownership constraint
  if (!isAdmin) {
    sqlQuery = `
        SELECT event_uuid, event_id, title, end_date
        FROM events
        WHERE end_date >= EXTRACT(EPOCH FROM now() - INTERVAL '2 month')
          AND has_payment = true
          AND owner = $1
        ORDER BY end_date ASC
        LIMIT 50
    `;
    sqlParams = [userId];
  }

  const client = await pool.connect();
  try {
    const res = await client.query(sqlQuery, sqlParams);
    return res.rows;
  } finally {
    client.release();
  }
}
