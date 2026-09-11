# [UX/TMA] Offline Pass & Direct Telegram Chat Delivery for Check-In QR Codes

**Labels:** `feature`, `Design`, `Critical`  
**Components:** `mini-app/src/server/routers/registrant.ts`, `telegram-bot/src/controllers/`, `mini-app/src/app/events/[hash]/registrant/[reg_id]/qr/page.tsx`  
**Milestone:** Event Experience v2  
**Target:** Telegram Bot & Mobile TMA

---

## 1. Problem Statement
At event venues located in basements, hotel convention centers, or crowded halls, cellular data reception is frequently poor. Attendees standing at the check-in desk cannot open the Telegram Mini App to retrieve their check-in QR code (`/events/[hash]/registrant/[reg_id]/qr`), causing confusion, line blockages, and manual verification headaches for organizers.

---

## 2. Current Implementation Analysis
In [`registrant.ts`](file:///Users/mahdifarimani/Documents/AntiGravity/ONTON2026/ontonbot/mini-app/src/server/routers/registrant.ts#L141-L153):
```typescript
if (opts.input.status === "approved") {
  const share_link = `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${event_uuid}`;
  const approved_message = `✅ Your request has been approved for the event : <b>${event.title}</b> \n${share_link}`;

  await telegramService.sendEventPhoto({
    event_id: event.event_uuid,
    user_id: user_id,
    message: approved_message,
  });
}
```

### Usability Flaws:
1. **No Direct Ticket Delivery**: The approval message only contains a generic link back to the event main page (`startapp=${event_uuid}`).
2. **Multi-Step Retrieval Required**:
   * Tap bot link ➔ Wait for TMA to boot ➔ Fetch event data ➔ Scroll down ➔ Tap "Check In" button ➔ Render QR page.
3. **Zero Offline Capability**: If there is no cellular signal at the venue door, the Mini App fails to load and the attendee cannot show proof of ticket.

---

## 3. Proposed Solution

### A. Bot Delivers High-Res Ticket QR Code Image in Chat
When an attendee is approved (`status === "approved"`):
1. Generate the ticket QR code server-side (using `qrcode` + `sharp`).
2. Send a Telegram photo message directly to the user in their 1-on-1 chat with `@ontonbot`:
   * **Photo**: Clean, high-contrast QR code branded with the event title and attendee name.
   * **Caption**:
     > 🎟️ **Your Ticket for [Event Title]**  
     > 👤 **Attendee:** Alex Mercer  
     > 📍 **Venue:** Grand Ballroom, 4th Floor  
     > ⏰ **Doors Open:** 09:00 AM  
     > *Tip: Save this QR code image to your photo gallery for fast offline check-in!*

### B. Offline Caching in TMA (Service Worker / LocalStorage)
* Cache the attendee’s approved ticket payload (`registrant_uuid`, `event_uuid`, event title) in `localStorage`.
* When navigating to the QR screen while offline (`navigator.onLine === false`), render the QR code immediately using the cached UUID instead of failing network calls.

### C. Apple Wallet / Google Wallet Pass Generation (Future-Proofing)
* Provide a direct link under the ticket: *"Add to Apple Wallet / Google Wallet"*.

---

## 4. Acceptance Criteria
- [ ] Approved registrants receive an explicit ticket photo containing their check-in QR code directly in Telegram chat.
- [ ] No internet connection is needed once the image is saved in the chat or photos.
- [ ] TMA QR page renders successfully from offline storage when device has no network connectivity.
- [ ] Screen auto-enhances contrast/brightness when viewing the check-in QR code in TMA.
