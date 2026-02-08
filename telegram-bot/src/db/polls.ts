import { pool } from "./pool";
import {logger} from "../utils/logger";

// 1) createPollInDb => inserts poll + answers, returns pollId
export async function createPollInDb(
    createdBy: number | undefined,
    question: string,
    answers: string[],
    deadline: Date | undefined,
    isMultiple: boolean
): Promise<number> {
    const client = await pool.connect();
    try {
        const pollInsert = await client.query(
            `INSERT INTO polls (question, created_by, vote_deadline, multiple_choice)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [question, createdBy || 0, deadline || null, isMultiple]
        );
        const pollId = pollInsert.rows[0].id;

        for (const ans of answers) {
            await client.query(
                `INSERT INTO poll_answers (poll_id, answer_text)
                 VALUES ($1, $2)`,
                [pollId, ans]
            );
        }
        return pollId;
    } finally {
        client.release();
    }
}

// 2) updatePollInDb => updates poll + answers
export async function updateUserVoteSingle(
    pollId: number,
    userId: number,
    answerId: number
) {
    const client = await pool.connect();
    try {
        // 1) Remove any existing answer(s) for this poll + user
        await client.query(
            `DELETE FROM poll_user_answers
       WHERE poll_id = $1 AND user_id = $2`,
            [pollId, userId]
        );

        // 2) Insert the newly chosen answer
        await client.query(
            `INSERT INTO poll_user_answers (poll_id, user_id, answer_id)
       VALUES ($1, $2, $3)`,
            [pollId, userId, answerId]
        );
    } finally {
        client.release();
    }
}

// 3) Multiple-choice => "toggle"
export async function updateUserVoteMultipleToggle(
    pollId: number,
    userId: number,
    answerId: number
) {
    const client = await pool.connect();
    try {
        // Check if row already exists => if so, remove it (unselect)
        const checkRes = await client.query(
            `SELECT 1 FROM poll_user_answers
             WHERE poll_id=$1 AND user_id=$2 AND answer_id=$3
             LIMIT 1`,
            [pollId, userId, answerId]
        );

        if (checkRes.rowCount > 0) {
            // Already selected => remove
            await client.query(
                `DELETE FROM poll_user_answers
         WHERE poll_id=$1 AND user_id=$2 AND answer_id=$3`,
                [pollId, userId, answerId]
            );
        } else {
            // Not selected => insert
            await client.query(
                `INSERT INTO poll_user_answers (poll_id, user_id, answer_id)
         VALUES ($1, $2, $3)`,
                [pollId, userId, answerId]
            );
        }
    } finally {
        client.release();
    }
}

export async function fetchUserSelectedAnswerIds(pollId: number, userId: number): Promise<number[]> {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT answer_id
       FROM poll_user_answers
       WHERE poll_id=$1 AND user_id=$2`,
            [pollId, userId]
        );
        return res.rows.map(r => r.answer_id);
    } finally {
        client.release();
    }
}
// 2) insertPollSent => create a row in poll_sent with state='waiting_for_send'
export async function insertPollSent(pollId: number, userId: number) {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO poll_sent (poll_id, user_id, state, retry_count)
       VALUES ($1, $2, 'waiting_for_send', 0)
       ON CONFLICT DO NOTHING`,
            [pollId, userId]
        );
    } finally {
        client.release();
    }
}

// 3) getPollInfoByAnswerId => returns poll_id, vote_deadline, question
export async function getPollInfoByAnswerId(answerId: number) {
    const client = await pool.connect();
    try {
        const ansRes = await client.query(
            `
      SELECT pa.poll_id, p.vote_deadline, p.question ,p.multiple_choice
      FROM poll_answers pa
      JOIN polls p ON p.id = pa.poll_id
      WHERE pa.id = $1
      `,
            [answerId]
        );
        if (!ansRes.rowCount) return null;
        return ansRes.rows[0];
    } finally {
        client.release();
    }
}

// 4) updateUserVote => record a user's chosen answer in poll_user_answers
export async function updateUserVote(
    pollId: number,
    userId: number,
    answerId: number
) {
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO poll_user_answers (poll_id, user_id, answer_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (poll_id, user_id)
         DO UPDATE SET answer_id = EXCLUDED.answer_id
      `,
            [pollId, userId, answerId]
        );
    } finally {
        client.release();
    }
}

// 5) setPollSentAnswered => mark poll_sent.state='answered'
export async function setPollSentAnswered(pollId: number, userId: number) {
    const client = await pool.connect();
    try {
        await client.query(
            `
      UPDATE poll_sent
      SET state = 'answered', updated_at = now()
      WHERE poll_id = $1
        AND user_id = $2
        AND state IN ('success','answered')
      `,
            [pollId, userId]
        );
    } finally {
        client.release();
    }
}

// 6) getAnswersByPollId => returns an array of { id, answer_text }
export async function getAnswersByPollId(pollId: number) {
    const client = await pool.connect();
    try {
        const ansRes = await client.query(
            `SELECT id, answer_text
       FROM poll_answers
       WHERE poll_id = $1
       ORDER BY id`,
            [pollId]
        );
        return ansRes.rows; // array of { id, answer_text }
    } finally {
        client.release();
    }
}

// 1) Fetch up to `limit` poll_sent rows waiting to send
export async function fetchPendingPollSends(limit = 50) {
    const client = await pool.connect();
    try {
        const sql = `
      SELECT poll_id, user_id, retry_count
      FROM poll_sent
      WHERE state = 'waiting_for_send'
        AND retry_count < 10
      ORDER BY updated_at ASC
      LIMIT $1
    `;
        const { rows } = await client.query(sql, [limit]);
        return rows; // Array<{ poll_id: number, user_id: number, retry_count: number }>
    } finally {
        client.release();
    }
}

// 2) Mark poll_sent as success
export async function markPollSentSuccess(
    pollId: number,
    userId: number,
    messageId: number
) {
    const client = await pool.connect();
    try {
        const sql = `
      UPDATE poll_sent
      SET state='success',
          message_id=$1,
          updated_at=NOW()
      WHERE poll_id=$2
        AND user_id=$3
    `;
        await client.query(sql, [messageId, pollId, userId]);
    } finally {
        client.release();
    }
}

// 3) Mark poll_sent as failed with final retry_count
export async function markPollSentFailed(
    pollId: number,
    userId: number,
    finalRetryCount: number
) {
    const client = await pool.connect();
    try {
        const sql = `
      UPDATE poll_sent
      SET state='failed',
          retry_count=$1,
          updated_at=NOW()
      WHERE poll_id=$2
        AND user_id=$3
    `;
        await client.query(sql, [finalRetryCount, pollId, userId]);
    } finally {
        client.release();
    }
}

// 4) Increment poll_sent retry_count
export async function incrementPollSentRetry(
    pollId: number,
    userId: number,
    newRetryCount: number
) {
    const client = await pool.connect();
    try {
        const sql = `
      UPDATE poll_sent
      SET retry_count=$1,
          updated_at=NOW()
      WHERE poll_id=$2
        AND user_id=$3
    `;
        await client.query(sql, [newRetryCount, pollId, userId]);
    } finally {
        client.release();
    }
}

// 5) getPollRow => returns the poll row (or null if not found)
export async function getPollRow(pollId: number) {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, question, vote_deadline, created_by
       FROM polls
       WHERE id=$1`,
            [pollId]
        );
        return res.rows[0] || null;
    } finally {
        client.release();
    }
}

// 6) getPollAnswers => returns array of answers
export async function getPollAnswers(pollId: number) {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, poll_id, answer_text
       FROM poll_answers
       WHERE poll_id=$1
       ORDER BY id`,
            [pollId]
        );
        return res.rows; // e.g. [{ id: number, poll_id: number, answer_text: string }, ...]
    } finally {
        client.release();
    }
}
