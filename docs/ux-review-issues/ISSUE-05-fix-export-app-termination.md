# [UX/Interaction] Fix Sudden Mini App Termination on Excel Guest List Export

**Labels:** `bug`, `Design`, `softFix`  
**Components:** `mini-app/src/app/_components/Event/RegistrationGuestList.tsx`  
**Milestone:** Quick Wins / Quality of Life  
**Target:** Mobile Telegram Mini App (TMA)

---

## 1. Problem Statement
When an event organizer taps the "Download List Excel" MainButton in the TMA guest list, the entire Mini App abruptly terminates and vanishes. Without prior explanation, users perceive this unexpected window exit as an application crash or failure.

---

## 2. Current Implementation Analysis
In [`RegistrationGuestList.tsx`](file:///Users/mahdifarimani/Documents/AntiGravity/ONTON2026/ontonbot/mini-app/src/app/_components/Event/RegistrationGuestList.tsx#L383-L404):
```typescript
const exportVisitorList = trpc.telegramInteractions.requestExportFile.useMutation({
  onSuccess: () => {
    webApp?.HapticFeedback.impactOccurred("soft");
    webApp?.close(); // <-- FORCED TERMINATION WITHOUT EXPLANATION
  },
});

useMainButton(
  () => {
    exportVisitorList.mutate({
      event_uuid: params.hash,
    });
  },
  "Download List Excel",
  {
    isLoading: exportVisitorList.isLoading,
    disabled: exportVisitorList.isLoading,
  }
);
```

### Usability Flaws:
1. **Violation of User Control & Freedom**: The app forcibly closes without asking the user.
2. **Missing Feedback Loop**: The user is not told *why* the app closed (i.e., that the Excel `.xlsx` file is being delivered via bot DM).
3. **Broken Workflow**: If the organizer was in the middle of reviewing attendees or wanted to continue operations, their session is destroyed.

---

## 3. Proposed Solution

### A. Keep Mini App Open
Remove `webApp?.close()` from the mutation `onSuccess` callback.

### B. Display In-App Success State
Render an informative notification modal or toast:
```
┌──────────────────────────────────────────────────┐
│              📊 Export Generated!                │
│                                                  │
│  Your Excel attendee list has been sent directly │
│  to your chat with @ontonbot.                    │
│                                                  │
│   [ Open Bot Chat ]          [ Stay in App ]     │
└──────────────────────────────────────────────────┘
```
* **"Open Bot Chat"**: Calls `webApp?.openTelegramLink(`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}`)`.
* **"Stay in App"**: Dismisses the notification and allows the organizer to continue managing the event.

---

## 4. Acceptance Criteria
- [ ] Mini App does NOT close automatically when exporting the attendee list.
- [ ] An explicit confirmation toast/dialog appears explaining that the document was delivered via Telegram bot DM.
- [ ] An optional button allows jumping directly to the bot chat to download the file.
- [ ] Eliminates false user crash reports related to Excel export.
