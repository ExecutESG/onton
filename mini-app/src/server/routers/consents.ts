/* ------------------------------------------------------------------ */
/*               consents – GDPR User Consents tRPC Router            */
/* ------------------------------------------------------------------ */

import { z } from "zod";
import {
  initDataProtectedProcedure,
  initDataProtectedProcedureAllowBanned,
  router,
} from "../trpc";
import {
  CONSENT_PURPOSES,
  ConsentPurpose,
  CURRENT_PRIVACY_POLICY_VERSION,
  getUserConsents,
  grantConsents,
  revokeConsent,
} from "@/db/modules/userConsents.db";

const consentPurposeSchema = z.enum(CONSENT_PURPOSES);

const grantInputSchema = z.object({
  purposes: z.array(consentPurposeSchema).min(1),
});

const revokeInputSchema = z.object({
  purpose: consentPurposeSchema,
});

export const consentsRouter = router({
  /**
   * Retrieves the current authenticated user's consent status across all purposes.
   */
  getMine: initDataProtectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.user_id;
    const records = await getUserConsents(userId);

    const activeRecords = records.filter(
      (r) => r.revoked_at === null && r.policy_version === CURRENT_PRIVACY_POLICY_VERSION
    );
    const activePurposes = activeRecords.map((r) => r.purpose as ConsentPurpose);

    const consents: Record<ConsentPurpose, boolean> = {
      audience_reach: activePurposes.includes("audience_reach"),
      sponsor_stats: activePurposes.includes("sponsor_stats"),
      attendance_verification_api: activePurposes.includes("attendance_verification_api"),
    };

    return {
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      activePurposes,
      consents,
      records,
    };
  }),

  /**
   * Grants consent for one or more purposes for the authenticated user.
   */
  grant: initDataProtectedProcedure
    .input(grantInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.user_id;
      const updated = await grantConsents(
        userId,
        input.purposes,
        CURRENT_PRIVACY_POLICY_VERSION
      );

      return {
        success: true,
        granted: input.purposes,
        records: updated,
      };
    }),

  /**
   * Revokes consent immediately for a specific purpose for the authenticated user.
   * In compliance with GDPR Article 7(3), even banned accounts can withdraw consent.
   */
  revoke: initDataProtectedProcedureAllowBanned
    .input(revokeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.user_id;
      const updated = await revokeConsent(userId, input.purpose);

      return {
        success: true,
        revoked: input.purpose,
        records: updated,
      };
    }),
});

export default consentsRouter;
