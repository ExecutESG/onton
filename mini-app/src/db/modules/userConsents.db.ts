/* ------------------------------------------------------------------ */
/*          userConsents.db – GDPR User Consents Database Module       */
/* ------------------------------------------------------------------ */

import { db } from "@/db/db";
import {
  user_consents,
  UserConsentRow,
  UserConsentInsert,
  CONSENT_PURPOSES,
  ConsentPurpose,
  CURRENT_PRIVACY_POLICY_VERSION,
} from "@/db/schema/userConsents";
import { and, eq, isNull, desc } from "drizzle-orm";

export {
  CONSENT_PURPOSES,
  type ConsentPurpose,
  CURRENT_PRIVACY_POLICY_VERSION,
  type UserConsentRow,
  type UserConsentInsert,
};

/**
 * Checks whether an active (unrevoked) consent exists for a user and purpose.
 * Optionally verifies against a specific privacy policy version.
 *
 * @param userId - Target user ID (number or bigint)
 * @param purpose - Purpose to check
 * @param policyVersion - Policy version filter (defaults to CURRENT_PRIVACY_POLICY_VERSION)
 * @returns boolean indicating if valid consent is active
 */
export async function hasConsent(
  userId: number | bigint,
  purpose: ConsentPurpose,
  policyVersion: string = CURRENT_PRIVACY_POLICY_VERSION
): Promise<boolean> {
  const numericUserId = Number(userId);
  if (!numericUserId || isNaN(numericUserId)) {
    return false;
  }

  const effectivePolicyVersion = policyVersion || CURRENT_PRIVACY_POLICY_VERSION;

  const conditions = [
    eq(user_consents.user_id, numericUserId),
    eq(user_consents.purpose, purpose),
    isNull(user_consents.revoked_at),
    eq(user_consents.policy_version, effectivePolicyVersion),
  ];

  const record = await db.query.user_consents.findFirst({
    where: and(...conditions),
  });

  return Boolean(record);
}

/**
 * Retrieves all consent records for a user.
 *
 * @param userId - Target user ID
 * @returns Array of UserConsentRow records
 */
export async function getUserConsents(
  userId: number | bigint
): Promise<UserConsentRow[]> {
  const numericUserId = Number(userId);
  if (!numericUserId || isNaN(numericUserId)) {
    return [];
  }

  return await db.query.user_consents.findMany({
    where: eq(user_consents.user_id, numericUserId),
    orderBy: [desc(user_consents.granted_at)],
  });
}

/**
 * Grants consent for one or more purposes for a user under the given policy version.
 * If consent previously existed (even if revoked), it reactivates it with revoked_at = null.
 *
 * @param userId - Target user ID
 * @param purposes - List of purposes to grant
 * @param policyVersion - Privacy policy version (defaults to CURRENT_PRIVACY_POLICY_VERSION)
 */
export async function grantConsents(
  userId: number | bigint,
  purposes: ConsentPurpose[],
  policyVersion: string = CURRENT_PRIVACY_POLICY_VERSION
): Promise<UserConsentRow[]> {
  const numericUserId = Number(userId);
  if (!numericUserId || isNaN(numericUserId) || purposes.length === 0) {
    return [];
  }

  const uniquePurposes = Array.from(new Set(purposes));
  const now = new Date();

  const valuesToInsert: UserConsentInsert[] = uniquePurposes.map((purpose) => ({
    user_id: numericUserId,
    purpose,
    policy_version: policyVersion || CURRENT_PRIVACY_POLICY_VERSION,
    granted_at: now,
    revoked_at: null,
  }));

  const inserted = await db
    .insert(user_consents)
    .values(valuesToInsert)
    .onConflictDoUpdate({
      target: [
        user_consents.user_id,
        user_consents.purpose,
        user_consents.policy_version,
      ],
      set: {
        revoked_at: null,
        granted_at: now,
      },
    })
    .returning();

  return inserted;
}

/**
 * Revokes consent immediately for a specific purpose for a user.
 * Sets revoked_at = now() for all active records of that purpose.
 *
 * @param userId - Target user ID
 * @param purpose - Purpose to revoke
 */
export async function revokeConsent(
  userId: number | bigint,
  purpose: ConsentPurpose
): Promise<UserConsentRow[]> {
  const numericUserId = Number(userId);
  if (!numericUserId || isNaN(numericUserId)) {
    return [];
  }

  const now = new Date();
  const updated = await db
    .update(user_consents)
    .set({ revoked_at: now })
    .where(
      and(
        eq(user_consents.user_id, numericUserId),
        eq(user_consents.purpose, purpose),
        isNull(user_consents.revoked_at)
      )
    )
    .returning();

  return updated;
}

export const userConsentsDB = {
  hasConsent,
  getUserConsents,
  grantConsents,
  revokeConsent,
};

export default userConsentsDB;
