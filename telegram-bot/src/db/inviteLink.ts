/* -------------------------------------------------------------------------- */
/* getOrCreateSingleInviteLinkForUserAndChat => DB approach to re-use invites*/
/* -------------------------------------------------------------------------- */
import {MyContext} from "../types/MyContext";
import {pool} from "./db";
import {logger} from "../utils/logger";
import {sleep} from "../utils/utils";

async function createInviteLinkWithRetry(
    api: MyContext["api"],
    chatId: number,
    maxRetries = 8
) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await api.createChatInviteLink(chatId,  { member_limit: 1, name: "One-time link"  });
        } catch (err: any) {
            const isRateLimit = err?.error_code === 429 || err?.statusCode === 429;
            if (!isRateLimit || attempt === maxRetries - 1) {
                throw err;                                // ⇠ bubble up if not 429 or out of retries
            }

            // Figure out how long to wait
            const retryAfterSecs =
                err?.parameters?.retry_after ?? 2 ** attempt; // 1, 2, 4 s
            const delayMs = retryAfterSecs * 1_000;

            logger.warn(
                `429 received, retrying in ${delayMs} ms (attempt ${attempt + 1}/${maxRetries})`
            );
            await sleep(delayMs);
        }
    }
    /* istanbul ignore next */
    throw new Error("unreachable");
}

export async function getOrCreateSingleInviteLinkForUserAndChat(
    api: MyContext["api"],
    userId: number,
    chatId: number
): Promise<string> {
    // 1) See if we already stored a link
    const client = await pool.connect();
    let existingLink: string | null = null;
    try {
        const checkRes = await client.query(
            `SELECT invite_link
         FROM user_invite_links
        WHERE user_id=$1 AND chat_id=$2
        LIMIT 1`,
            [userId, chatId]
        );
        if (checkRes.rowCount) {
            existingLink = checkRes.rows[0].invite_link;
            logger.info(
                `Reusing existing invite link for user=${userId} chat=${chatId}: ${existingLink}`
            );
        }
    } finally {
        client.release();
    }
    if (existingLink) return existingLink;

    // 2) Create a new link, with retry handling
    await sleep(300); // tiny “cool-down” you already had
    const linkObj = await createInviteLinkWithRetry(
        api,
        chatId,

        8 // maxRetries
    );
    const newLink = linkObj.invite_link;
    logger.info(
        `Created new invite link for user=${userId} chatId=${chatId}: ${newLink}`
    );

    // 3) Persist it
    const client2 = await pool.connect();
    try {
        await client2.query(
            `INSERT INTO user_invite_links (user_id, chat_id, invite_link)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, chat_id) DO NOTHING`,
            [userId, chatId, newLink]
        );
    } finally {
        client2.release();
    }
    return newLink;
}
