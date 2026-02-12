# Live Smoke Test Guide

## Overview
This script (`mini-app/scripts/create-live-event.ts`) is designed to verify the stability of the **Live Development Environment**. It performs an end-to-end test by:
1.  **Authenticating** via a permanent API Key (bypassing `initData` expiration).
2.  **creating a real Event** on the backend.
3.  **Verifying** the response.

## Prerequisites
- **Node.js**: Ensure `tsx` is installed (`npm install -g tsx` or use `npx`).
- **API Key**: The script uses a pre-generated API Key assigned to an Admin/Organizer.
    - Key: `9b4812dc-14b2-49d0-90cd-21014cb6d69b` (Hardcoded fallback or set via `SMOKE_TEST_API_KEY`).

## How to Run

### 1. From Local Machine (Targeting Remote Dev)
If the `APITesting` branch (or `dev`) with the API Key support has been deployed to `app.dev.onton.live`:

```bash
cd mini-app
npx tsx scripts/create-live-event.ts
```

### 2. Output
- **Success**:
  ```
  ✅ REQUEST SUCCESSFUL
  --------------------------------------------------
  🎉 Event Created ID: ...
  🔗 Link: ...
  ```
- **Failure**:
  ```
  ❌ REQUEST FAILED
  Status: 401 (or 500)
  ```

## Troubleshooting
- **401 Unauthorized**:
    - Ensure the `context.ts` update supporting API Keys is **deployed**.
    - Verify the API Key exists in the remote database (`user_custom_flags`).
- **Connection Error**:
    - The script targets `https://app.dev.onton.live`. Ensure the VPN/Internet is active and the site is reachable.

## Notes
- The created events are **Real**. Periodic cleanup of the database might be required if run frequently.
- The script uploads a placeholder image from `telegra.ph` to avoid Minio complexities during the smoke test.
