# Participant Telegram Mini App (TMA)

The **Participant TMA** (`ontonbot/newton/apps/participant-tma`) is the primary user interface for event attendees. It is a Telegram Mini App embedded directly into Telegram.

## 1. Technical Stack
- **Framework**: Next.js (App Router).
- **Styling**: TailwindCSS.
- **State Management**: Zustand? (Folder `store` present).
- **Telegram Integration**: Uses `@twa-dev/sdk` or similar for managing the WebApp viewport and theme.

## 2. Key Features
- **Event Discovery**: Browsing the feed of active events.
- **Ticketing & checkout**: Integration with TON Connect for wallet connection and payment.
- **My Tickets**: QR Code display for check-in.
- **Profile**: Viewing badges, points, and rewards.

## 3. Communication
- Calls the **Mini-App** backend API (likely via TRPC or REST hooks).
- Authenticates using `Telegram WebApp Data` (initData) which the backend validates.
