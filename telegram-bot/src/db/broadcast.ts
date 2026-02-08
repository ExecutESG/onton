import { pool } from "./pool";

/* ---------- types ---------- */
export interface BroadcastMessageRow {
    broadcast_id: number;
    broadcaster_id: number;
    source_chat_id: number;
    source_message_id: number;
    broadcast_type: "event" | "csv";
    event_uuid?: string | null;
    title?: string | null;
    created_at: string;          // ISO
}
export interface BroadcastMessageInsert {
    broadcaster_id: number;
    source_chat_id: number;
    source_message_id: number;
    broadcast_type: "event" | "csv";
    event_uuid?: string | null;
    title?: string | null;
    message_text?: string | null;   // ⬅️ new
}
export type SendStatus = "pending" | "sent" | "failed";

/* ---------- inserts ---------- */
export async function createBroadcastMessage(data: BroadcastMessageInsert) {
    const {
        broadcaster_id,
        source_chat_id,
        source_message_id,
        broadcast_type,
        event_uuid,
        title,
        message_text,
    } = data;

    const res = await pool.query(
        `INSERT INTO broadcast_messages
       (broadcaster_id, source_chat_id, source_message_id,
        broadcast_type, event_uuid, title, message_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING broadcast_id`,
        [
            broadcaster_id,
            source_chat_id,
            source_message_id,
            broadcast_type,
            event_uuid,
            title,
            message_text,
        ],
    );
    return res.rows[0].broadcast_id as number;
}

const CHUNK = 5000;                // < 65 535 / 2  (room to spare)

export async function bulkInsertBroadcastUsers(
    broadcastId: number,
    userIds: string[],
): Promise<void> {
    if (!userIds.length) return;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        for (let i = 0; i < userIds.length; i += CHUNK) {
            const slice = userIds.slice(i, i + CHUNK);

            // ($1,$2),($1,$3)… structure for this slice
            const values: string[] = [];
            const params: any[] = [broadcastId]; // $1
            slice.forEach((uid, idx) => {
                values.push(`($1,$${idx + 2})`);
                params.push(uid);
            });

            const sql = `
        INSERT INTO broadcast_users (broadcast_id, user_id)
        VALUES ${values.join(",")}
      `;
            await client.query(sql, params);
        }

        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
}

/* ---------- status updates ---------- */
export async function markUserStatus(
    id: number,
    status: SendStatus,
    error?: string,
) {
    const sql = `
        UPDATE broadcast_users
        SET send_status = $2::broadcast_send_status,
            last_error  = $3,
            sent_at     = CASE WHEN $2::broadcast_send_status = 'sent' THEN now() ELSE NULL END
        WHERE id = $1
    `;
    await pool.query(sql, [id, status, error ?? null]);
}

/* ---------- fetch helpers ---------- */
export async function fetchUsersForBroadcast(
    broadcastId: number
): Promise<{ id: number; user_id: string }[]> {
    const sql = `
      SELECT id, user_id
      FROM broadcast_users
      WHERE broadcast_id = $1
        AND send_status  = 'pending'
  `;
    const res = await pool.query(sql, [broadcastId]);
    return res.rows;
}


/* ------------------------------------------------------------------ */
/* fetch rows needing work                                             */
/* ------------------------------------------------------------------ */
export async function fetchPendingBroadcastSends(limit = 100) {
    const sql = `
      SELECT
        u.id                  AS bu_id,
        u.user_id,
        u.retry_count,
        m.broadcast_id,
        m.broadcast_type,
        m.source_chat_id,
        m.source_message_id,
        m.message_text
        
      FROM broadcast_users u
      JOIN broadcast_messages m USING (broadcast_id)
      WHERE u.send_status = 'pending'
        AND u.retry_count < 10
      ORDER BY u.id DESC 
      LIMIT $1
  `;
    const res = await pool.query(sql, [limit]);
    return res.rows;
}

/* ------------------------------------------------------------------ */
/* status updates                                                      */
/* ------------------------------------------------------------------ */
export async function markBroadcastUserSent(
    buId: number,
    sentMessageId: number,
) {
    await pool.query(
        `UPDATE broadcast_users
       SET send_status = 'sent',
           sent_at     = NOW(),
           sent_message_id = $2
     WHERE id = $1`,
        [buId, sentMessageId],
    );
}

export async function markBroadcastUserFailed(
    buId: number,
    retry: number,
    error?: string,
    final = false,
) {
    const status = final ? 'failed' : 'pending';
    await pool.query(
        `UPDATE broadcast_users
       SET retry_count = $2,
           send_status = $3::broadcast_send_status,
           last_error  = $4
     WHERE id = $1`,
        [buId, retry, status, error ?? null],
    );
}

/* ------------------------------------------------------------------ */
/* helpers for finishing a broadcast                                  */
/* ------------------------------------------------------------------ */
export async function broadcastHasPendingUsers(broadcastId: number): Promise<boolean> {
    const { rows } = await pool.query(
        `SELECT 1
       FROM broadcast_users
      WHERE broadcast_id = $1
        AND send_status = 'pending'
      LIMIT 1`,
        [broadcastId],
    );
    return rows.length > 0;
}

export async function fetchBroadcastErrors(broadcastId: number) {
    const { rows } = await pool.query(
        `SELECT user_id, last_error
       FROM broadcast_users
      WHERE broadcast_id = $1
        AND send_status = 'failed'`,
        [broadcastId],
    );
    return rows;
}

export async function countBroadcastSuccess(broadcastId: number): Promise<number> {
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS cnt
       FROM broadcast_users
      WHERE broadcast_id = $1
        AND send_status = 'sent'`,
        [broadcastId],
    );
    return rows[0].cnt;
}

export async function getBroadcastMeta(broadcastId: number) {
    const { rows } = await pool.query(
        `SELECT source_chat_id, source_message_id
       FROM broadcast_messages
      WHERE broadcast_id = $1`,
        [broadcastId],
    );
    return rows[0];
}

