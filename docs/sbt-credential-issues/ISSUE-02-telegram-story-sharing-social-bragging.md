# 📱 Social Bragging: Telegram Story Sharing & Dynamic Canvas Cards for Event Badges

## 📌 Overview & Objective
One of the highest-leverage viral acquisition loops for ONTON is attendee "social proof" and bragging rights. When attendees receive a soulbound event badge or tournament award, they should be able to share it directly to their **Telegram Story** with one tap, driving viral traffic back to ONTON events.

---

## 🔍 Existing Codebase References
* `newton/apps/participant-tma/components/ticket/ShareTicketButton.tsx`: Basic share button.
* `mini-app/src/components/csbt/CsbtClaimCard.tsx`: Claim success hook (`onClaimSuccess`).
* `@tma.js/sdk-react` / `@tma.js/sdk`: Support for `shareToStory` Telegram Mini App method.

---

## 🛠️ Scope of Work & Detailed Implementation

### 1. Dynamic Story Graphic Renderer
* Build an Edge API route (`/api/og/badge/[id]`) using `@vercel/og` or `satori` to render high-contrast 1080x1920 (9:16) vertical story graphics:
  * Event banner & high-res badge artwork.
  * Attendee Telegram handle/avatar.
  * Gold "Verified Attendee / Winner" badge stamp.
  * ONTON watermarking and clean branding.

### 2. One-Tap Telegram Story Integration
* Implement a `ShareToStoryButton` using the Telegram WebApp API:
  ```ts
  if (tmaUtils?.shareToStory) {
    tmaUtils.shareToStory(mediaUrl, {
      text: `Just collected my official soulbound badge for ${eventTitle}! 🎟️✨`,
      widget_link: {
        url: `https://t.me/theontonbot?startapp=event_${eventUuid}`,
        name: "View Event on ONTON"
      }
    });
  }
  ```
* Fallback to native Telegram chat share (`t.me/share/url`) if client Telegram version doesn't support Stories.

### 3. Share Trigger Points
* Auto-prompt "Share your accomplishment to Story" immediately following successful cSBT/SBT claim in `CsbtClaimCard`.
* Persistent "Share to Story" action on ticket check-in and Badge Inspector modal.

---

## ✅ Acceptance Criteria
* [ ] Clicking "Share to Story" opens Telegram's native Story editor with the rendered badge graphic.
* [ ] Story includes a clickable deep-link widget back to `@theontonbot`.
* [ ] Fallback modal with copyable link and standard share dialog works for desktop/older Telegram clients.

