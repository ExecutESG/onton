import { pool } from "./pool";
import { generateRandomHash } from "../helpers/generateRandomHash";

export interface AffiliateLinkRow {
  id: number;
  link_hash: string;
  title: string;
  group_title: string;
  item_type: string;
  item_id?: number;
}

/**
 * Create multiple affiliate links in a single transaction
 */
export async function createAffiliateLinks(params: {
  eventId: number;
  userId: number;
  itemType: string;
  baseTitle: string;
  count: number;
}) {
  const { eventId, userId, itemType, baseTitle, count } = params;

  const links: AffiliateLinkRow[] = [];
  let groupTitle: string | null = null;
  let firstLinkId: number | null = null;

  const client = await pool.connect();
  try {
    for (let i = 0; i < count; i++) {
      const singleLinkTitle = `${baseTitle}-${i + 1}`;
      const linkHash = generateRandomHash(8);

      const insertQuery = `
          INSERT INTO affiliate_links ("Item_id", "item_type", "creator_user_id", "link_hash",
                                       "total_clicks", "total_purchase", "active", "affiliator_user_id",
                                       "created_at", "updated_at", "title", "group_title")
          VALUES ($1, $2, $3, $4, 0, 0, true, $5, CURRENT_DATE, NULL, $6, $7)
          RETURNING id, link_hash, title, group_title
      `;

      if (i === 0) {
        // First link => no group_title yet
        const result = await client.query(insertQuery, [
          eventId,
          itemType,
          userId,
          linkHash,
          userId,
          singleLinkTitle,
          "",
        ]);
        const newLink = result.rows[0];
        firstLinkId = newLink.id;
        groupTitle = baseTitle;

        // Update the first row with final groupTitle
        await client.query(
          `UPDATE affiliate_links
           SET "group_title"=$1
           WHERE "id" = $2`,
          [groupTitle, firstLinkId],
        );

        links.push({
          id: newLink.id,
          link_hash: newLink.link_hash,
          title: singleLinkTitle,
          group_title: groupTitle,
          item_type: itemType,
          item_id: eventId,
        });
      } else {
        // For subsequent links, use the existing groupTitle
        const result = await client.query(insertQuery, [
          eventId,
          itemType,
          userId,
          linkHash,
          userId,
          singleLinkTitle,
          groupTitle,
        ]);
        const newLink = result.rows[0];
        links.push({
          id: newLink.id,
          link_hash: newLink.link_hash,
          title: newLink.title,
          group_title: newLink.group_title,
          item_type: itemType,
          item_id: eventId,
        });
      }
    }
  } finally {
    client.release();
  }

  return { links, groupTitle: groupTitle || "" };
}


export async function getAffiliateLinksByItemId(itemId: number | string) {
  const client = await pool.connect();
  try {
    const sql = `
        SELECT id,
               link_hash,
               title,
               group_title,
               "total_clicks"   AS clicks,
               "total_purchase" AS purchases,
               "item_type"      AS itemType,
               "Item_id"        AS itemId
        FROM affiliate_links
        WHERE "Item_id" = $1
        ORDER BY id ASC
    `;
    const { rows } = await client.query(sql, [itemId]);
    return rows;
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------- */
/* getOrCreateSingleAffiliateLink => for affiliate placeholders              */
/* -------------------------------------------------------------------------- */
export async function getOrCreateSingleAffiliateLink(
    userId: number,
    itemType: string,
    baseTitle: string,
    groupTitle: string,
) {
  const client = await pool.connect();
  try {
    const sqlCheck = `
      SELECT id, link_hash, title, group_title
      FROM affiliate_links
      WHERE "item_type" = $1
        AND "Item_id" = 0
        AND "affiliator_user_id" = $2
      LIMIT 1
    `;
    const resCheck = await client.query(sqlCheck, [itemType, userId]);
    if (resCheck.rowCount > 0) {
      // If found => update groupTitle if needed
      const existingLink = resCheck.rows[0];
      if (existingLink.group_title !== groupTitle) {
        await client.query(
            `UPDATE affiliate_links
             SET "group_title"=$1
             WHERE "id"=$2`,
            [groupTitle, existingLink.id],
        );
      }
      return {
        id: existingLink.id,
        link_hash: existingLink.link_hash,
        title: existingLink.title,
        group_title: groupTitle,
      };
    }
  } finally {
    client.release();
  }

  // Not found => create new
  const creation = await createAffiliateLinks({
    eventId: 0,
    userId,
    itemType,
    baseTitle,
    count: 1,
  });
  const newLink = creation.links[0];

  // Update group_title
  const client2 = await pool.connect();
  try {
    await client2.query(
        `UPDATE affiliate_links
         SET "group_title"=$1
         WHERE "id"=$2`,
        [groupTitle, newLink.id],
    );
  } finally {
    client2.release();
  }

  return {
    id: newLink.id,
    link_hash: newLink.link_hash,
    title: newLink.title,
    group_title: groupTitle,
  };
}
