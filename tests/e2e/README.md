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

## Scheduled Execution & CI
Tests run automatically every 6 hours via [`.github/workflows/scheduled-smoke-tests.yml`](../../.github/workflows/scheduled-smoke-tests.yml).
If tests fail, an automated alert is sent to the Telegram deployment logs channel.
