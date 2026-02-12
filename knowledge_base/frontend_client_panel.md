# Client Web Panel

The **Client Web Panel** (`ontonbot/client-web-panel`) is the dashboard for Event Organizers.

## 1. Technical Stack
- **Framework**: Next.js (Pages Router).
- **State Management**: Redux.
- **Localization**: `i18n.js` support.

## 2. Key Features
- **Event Creation Wizard**: Forms for setting up events, ticket tiers, and uploading media.
- **Analytics**: Viewing sales, attendance numbers, and revenue.
- **Attendee Management**: Manual check-in tools or lists.

## 3. Integration
- Connects to **Mini-App** backend via REST/TRPC.
- Requires "Organizer" role login (likely via Wallet or Social Auth).
