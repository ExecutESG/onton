/* ------------------------------------------------------------------ */
/*                  GDPR User Consent Public Interface                */
/* ------------------------------------------------------------------ */

export {
  hasConsent,
  getUserConsents,
  grantConsents,
  revokeConsent,
  CONSENT_PURPOSES,
  type ConsentPurpose,
  CURRENT_PRIVACY_POLICY_VERSION,
  type UserConsentRow,
  type UserConsentInsert,
} from "@/db/modules/userConsents.db";
