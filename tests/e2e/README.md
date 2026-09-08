# End-to-End (E2E) & Smoke Testing Suite

This directory contains automated browser and API smoke tests for the ONTON platform using **Playwright**.

## Running Tests Locally

```bash
cd tests/e2e
npm install
npx playwright install chromium

# Run smoke tests targeting Dev (https://app.dev.onton.live)
npm test

# Run smoke tests targeting Production
BASE_URL=https://onton.app npm test

# Run in headed mode
npm run test:headed
```

## Test Coverage

- **Platform Smoke & Health Tests (`smoke.spec.ts`)**:
  - Landing page HTTP 200 and root DOM checks
  - Next.js static asset bundle integrity
  - Direct root platform API ping
- **Core User Journeys (`user-journeys.spec.ts`)**:
  - **Event Discovery**: Navigation to public events, verifying banners, titles, host/organizer details, and ticket price options on desktop and mobile viewports.
  - **Guest Flow & RSVP Protection**: Gated RSVP/registration flows for unauthenticated guests, verifying the `WebLoginSheet` modal opens with Telegram, TonConnect, and Web2 Google options.
  - **TonConnect UI**: Validating TonConnect button rendering and wallet selection modal (`tc-root`) lifecycle without unhandled console or page exceptions.
  - **Public API**: Direct `GET /api/client/v1/public/ping` returning HTTP 200 with server uptime, timestamp, and commit SHA metadata.

## Scheduled Execution & CI
Tests run automatically every 6 hours via [`.github/workflows/scheduled-smoke-tests.yml`](../../.github/workflows/scheduled-smoke-tests.yml).
If tests fail, an automated alert is sent to the Telegram deployment logs channel.
