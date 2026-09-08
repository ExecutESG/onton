# ONTON Core Interactions

This document lists the major interaction steps within the ONTON platform. Each section represents a critical user flow that requires detailed analysis and documentation.

## 1. User Onboarding
*   **Actor:** New User (Participant/Organizer)
*   **Entry Point:** Telegram Bot (`/start`) or Mini App (`t.me/ontonbot/app`)
*   **Key Actions:**
    *   Telegram Authentication (Data extraction & validation)
    *   Wallet Connectivity (TON Connect)
    *   Profile Creation (Database record)
*   **Status:** Documented in [User Onboarding](user_onboarding.md).

## 2. Organizer Upgrade
*   **Actor:** Participant -> Organizer
*   **Actions:**
    *   Click "Become Organizer" in Profile/Dashboard.
    *   **Payment:** Send TON to system wallet with comment (See [Payment System](payment_system_overview.md)).
    *   **Verification:** Background worker confirms transaction.
    *   **Result:** User role updated to `organizer`.
*   **Status:** Documented in [Payment System Overview](payment_system_overview.md).

## 3. Event Creation
*   **Actor:** Organizer
*   **Actions:**
    *   **Draft:** Fill event details (Title, Date, Location/Link).
    *   **Configuration:** Set Quotas, Ticket Type (SBT/NFT), Price.
    *   **Publishing:** Make event visible to public.
    *   **Deploy:** (Optional) Deploy SBT collection specific to event.
*   **Status:** Documented in [Event Creation](event_creation.md).

## 4. Ticket Purchase
*   **Actor:** Participant
*   **Actions:**
    *   Select Event -> Click "Buy Ticket".
    *   **Order Generation:** Receive unique Order UUID.
    *   **Payment:** Transfer TON/Jetton with comment.
    *   **Fulfillment:** System detects payment and mints NFT Ticket.
*   **Status:** Documented in [Payment System Overview](payment_system_overview.md).

## 5. Event Check-in & Proof of Action (PoA)
*   **Actor:** Participant & Organizer
*   **Scenario A (Physical):**
    *   Organizer scans User's QR Code.
    *   System validates User's Ticket/Registration.
*   **Scenario B (Digital/Quest):**
    *   User submits "Proof of Action" (Image/Text/Link).
    *   Organizer (or AI/Community) validates submission.
*   **Status:** Documented in [Check-in & PoA](checkin_and_poa.md).

## 6. Reward Distribution
*   **Actor:** System (Automated)
*   **Actions:**
    *   Event ends -> Worker scans for "attended" users.
    *   **Minting:** System mints SBT/Reward tokens to attendees.
    *   **Notification:** Bot notifies users of rewards.
*   **Status:** Documented in [Reward Distribution](reward_distribution.md).

## 7. Affiliate & Referral
*   **Actor:** Affiliate / User
*   **Actions:**
    *   User generates referral link for an event.
    *   New user purchases ticket via link.
    *   System tracks sale and assigns commission/points.
*   **Status:** Documented in [Affiliate System](affiliate_system.md).
