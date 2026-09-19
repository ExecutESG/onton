# [UX/TMA] Rapid Continuous QR Scanner Mode for Event Door Check-In

**Labels:** `Design`, `enhancement`, `Critical`  
**Components:** `mini-app/src/app/_components/Event/ScanRegistrantQRCode.tsx`  
**Milestone:** Event Operations v2  
**Target:** Mobile Telegram Mini App (TMA)

---

## 1. Problem Statement
At in-person events, door check-in officers face severe throughput bottlenecks. The current QR scanner displays a native blocking modal dialog (`webApp.showPopup`) on every scan and closes the camera stream. With 100+ attendees arriving within 30 minutes, this multi-tap loop creates physical doorway queues of 20+ minutes.

---

## 2. Current Implementation Analysis
In [`ScanRegistrantQRCode.tsx`](mini-app/src/app/_components/Event/ScanRegistrantQRCode.tsx#L18-L46):
```typescript
const checkInRegistrant = trpc.registrant.checkinRegistrantRequest.useMutation({
  onSuccess: (data) => {
    webApp?.showPopup({
      title: "Check-In Success ✅",
      message: data.message,
    });
  },
  onError: (error) => {
    webApp?.showPopup({
      title: "Check-In Failed ❌",
      message: error.message,
    });
  },
});

const handleOnClick = () => {
  webApp?.showScanQrPopup({ text: "Check-In Registrant" }, (registrant_uuid) => {
    checkInRegistrant.mutate({ event_uuid: params.hash, registrant_uuid });
  });
};
```

### Bottlenecks:
1. **Blocking Alert (`showPopup`)**: Requires a physical finger tap on "OK" to dismiss.
2. **Scanner Dismissal**: Telegram's native popup scanner automatically closes when a QR code is matched, dumping the officer back into the Guest List.
3. **Double Latency**: Re-tapping "Scan QR Code" takes 1.5–2.0s of UI animation time.

---

## 3. Proposed Solution

### A. Continuous Camera Feed
* Keep the scanner active between scans using a dedicated full-screen camera overlay or continuous TMA camera session.
* Provide an on-screen **"Close Scanner"** button so the admin controls when to exit.

### B. Non-Blocking Heads-Up Display (HUD)
Replace `showPopup` with an animated status banner at the bottom of the camera viewfinder:
* **Success**: Green banner with attendee name (`"Alex Mercer - Checked In"`), attendee counter increment (`"Checked in: 48 / 120"`), and single soft haptic pulse (`webApp.HapticFeedback.notificationOccurred("success")`).
* **Already Used**: Yellow banner (`"Ticket Already Used at 09:14 AM"`), distinct double-vibration (`"warning"`).
* **Invalid/Unregistered**: Red banner (`"Invalid Ticket / Unapproved Registrant"`), error haptic pulse (`"error"`).

### C. Debounce Guard
* Implement a 2.0-second scan debounce on the same `registrant_uuid` to avoid accidental repeated readings while holding the camera over a badge.

---

## 4. UI/UX Flow Specification
```
[ Viewfinder Active ] ──( Scan QR )──> [ Background TRPC Call ]
       │                                         │
       ▼                                         ▼
[ Keep Camera Open ] <──( Success )──── [ Green Toast HUD + Haptic Pulse ]
       │                                  "Alex Mercer (48/120)"
       │
       ▼
[ Ready for Next Attendee in < 1.0s ]
```

---

## 5. Acceptance Criteria
- [ ] Scanning an attendee QR code does NOT show a blocking modal dialog.
- [ ] Successful check-in emits a light success haptic pulse and updates an on-screen attendee count.
- [ ] Duplicate or invalid ticket displays an error toast with warning haptic pulse without freezing or closing the camera.
- [ ] Average check-in time per attendee reduced from ~12.5 seconds to < 2.0 seconds.
