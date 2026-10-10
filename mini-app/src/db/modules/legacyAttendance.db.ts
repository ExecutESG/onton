import { db } from "@/db/db";
import { rewards, RewardDataTyepe } from "@/db/schema/rewards";
import { visitors } from "@/db/schema/visitors";
import { events } from "@/db/schema/events";
import { desc, eq } from "drizzle-orm";

export type LegacyBadgeKind = "legacy_onchain" | "legacy_record";

export interface LegacyAttendanceItem {
  rewardId: string;
  visitorId: number;
  userId: number;
  eventUuid: string;
  rewardType: string;
  rewardData: RewardDataTyepe | any;
  status: string;
  tonSocietyStatus: string;
  createdAt: Date;
  updatedAt: Date | null;
  eventTitle: string | null;
  eventDescription: string | null;
  eventImage: string | null;
  eventRewardImage: string | null;
  eventStartDate: number | null;
  eventEndDate: number | null;
  eventLocation: string | null;
  eventParticipationType: "in_person" | "online" | null;
  sbtCollectionAddress: string | null;
  kind: LegacyBadgeKind;
}

export interface LegacyAttendanceOptions {
  cursor?: string | null;
  limit?: number;
}

export interface LegacyAttendanceResult {
  items: LegacyAttendanceItem[];
  nextCursor: string | null;
  totalCount: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function determineLegacyKind(
  tonSocietyStatus: string,
  data: any
): LegacyBadgeKind {
  let parsedData = data;
  if (typeof data === "string") {
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = {};
    }
  }

  const hasOnchainStatus = tonSocietyStatus === "CLAIMED" || tonSocietyStatus === "RECEIVED";
  const hasSbtAddress = Boolean(parsedData?.sbt_address && String(parsedData.sbt_address).trim() !== "");
  const hasMaterializedAddress = Boolean(
    parsedData?.materialized_sbt_address && String(parsedData.materialized_sbt_address).trim() !== ""
  );

  if (hasOnchainStatus || hasSbtAddress || hasMaterializedAddress) {
    return "legacy_onchain";
  }
  return "legacy_record";
}

export async function findUserLegacyAttendance(
  userId: number,
  options?: LegacyAttendanceOptions
): Promise<LegacyAttendanceResult> {
  const rows = await db
    .select({
      rewardId: rewards.id,
      rewardType: rewards.type,
      rewardData: rewards.data,
      status: rewards.status,
      tonSocietyStatus: rewards.tonSocietyStatus,
      createdAt: rewards.created_at,
      updatedAt: rewards.updatedAt,
      visitorId: visitors.id,
      userId: visitors.user_id,
      eventUuid: visitors.event_uuid,
      eventTitle: events.title,
      eventDescription: events.description,
      eventImage: events.image_url,
      eventRewardImage: events.tsRewardImage,
      eventStartDate: events.start_date,
      eventEndDate: events.end_date,
      eventLocation: events.location,
      eventParticipationType: events.participationType,
      sbtCollectionAddress: events.sbt_collection_address,
    })
    .from(rewards)
    .innerJoin(visitors, eq(rewards.visitor_id, visitors.id))
    .leftJoin(events, eq(visitors.event_uuid, events.event_uuid))
    .where(eq(visitors.user_id, userId))
    .orderBy(desc(rewards.created_at))
    .execute();

  const mappedRows: LegacyAttendanceItem[] = rows.map((r) => ({
    ...r,
    kind: determineLegacyKind(r.tonSocietyStatus, r.rewardData),
  }));

  // Deduplicate per (user_id, event_uuid):
  // If multiple rows exist for the same event, keep on-chain; otherwise keep latest record
  const grouped = new Map<string, LegacyAttendanceItem[]>();
  for (const row of mappedRows) {
    const key = row.eventUuid || row.rewardId;
    const group = grouped.get(key) || [];
    group.push(row);
    grouped.set(key, group);
  }

  const deduplicated: LegacyAttendanceItem[] = [];
  for (const [, group] of grouped) {
    group.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(b.rewardId).localeCompare(String(a.rewardId));
    });

    const onchainRow = group.find((r) => r.kind === "legacy_onchain");
    if (onchainRow) {
      deduplicated.push(onchainRow);
    } else {
      deduplicated.push(group[0]);
    }
  }

  // Deterministic sort across all deduplicated items: createdAt desc, then rewardId desc
  deduplicated.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return String(b.rewardId).localeCompare(String(a.rewardId));
  });

  const totalCount = deduplicated.length;
  let startIndex = 0;

  if (options?.cursor) {
    let targetId: string | null = null;
    try {
      const decoded = JSON.parse(Buffer.from(options.cursor, "base64").toString("utf-8"));
      targetId = String(decoded.id || decoded);
    } catch {
      targetId = options.cursor;
    }

    const idx = deduplicated.findIndex((item) => String(item.rewardId) === targetId);
    if (idx >= 0) {
      startIndex = idx + 1;
    } else {
      // Stale or invalid cursor: halt pagination without infinite looping
      return {
        items: [],
        nextCursor: null,
        totalCount,
      };
    }
  }

  const limit = options?.limit !== undefined ? options.limit : 20;
  const items = limit > 0 ? deduplicated.slice(startIndex, startIndex + limit) : deduplicated.slice(startIndex);

  let nextCursor: string | null = null;
  if (limit > 0 && startIndex + limit < deduplicated.length && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({
        id: lastItem.rewardId,
        createdAt: lastItem.createdAt ? new Date(lastItem.createdAt).toISOString() : null,
      })
    ).toString("base64");
  }

  return {
    items,
    nextCursor,
    totalCount,
  };
}

export interface RewardWithVisitor {
  rewardId: string;
  visitorId: number;
  userId: number;
  eventUuid: string;
  data: RewardDataTyepe | any;
  status: string;
  tonSocietyStatus: string;
  type: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export async function findRewardWithVisitor(rewardId: string): Promise<RewardWithVisitor | null> {
  if (!rewardId || !UUID_REGEX.test(rewardId)) {
    return null;
  }

  const rows = await db
    .select({
      rewardId: rewards.id,
      visitorId: visitors.id,
      userId: visitors.user_id,
      eventUuid: visitors.event_uuid,
      data: rewards.data,
      status: rewards.status,
      tonSocietyStatus: rewards.tonSocietyStatus,
      type: rewards.type,
      createdAt: rewards.created_at,
      updatedAt: rewards.updatedAt,
    })
    .from(rewards)
    .innerJoin(visitors, eq(rewards.visitor_id, visitors.id))
    .where(eq(rewards.id, rewardId))
    .limit(1)
    .execute();

  return rows[0] || null;
}

export async function updateRewardData(rewardId: string, data: any) {
  if (!rewardId || !UUID_REGEX.test(rewardId)) {
    return null;
  }

  const rows = await db
    .update(rewards)
    .set({
      data,
      updatedAt: new Date(),
      updatedBy: "system",
    })
    .where(eq(rewards.id, rewardId))
    .returning()
    .execute();

  return rows[0] || null;
}

export const legacyAttendanceDB = {
  findUserLegacyAttendance,
  findRewardWithVisitor,
  updateRewardData,
  determineLegacyKind,
};

export default legacyAttendanceDB;
