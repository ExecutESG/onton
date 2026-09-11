# [UX/Flow] Re-architect Attendee Event Page Layout & Defer Web3 Onboarding

**Labels:** `Design`, `enhancement`  
**Components:** `mini-app/src/app/_components/Event/EventPageSections.tsx`, `mini-app/src/app/_components/organisms/ConnectWallet.tsx`  
**Milestone:** Event Experience v2  
**Target:** Attendee Mobile TMA

---

## 1. Problem Statement
The event landing page (`EventPageSections.tsx`) places platform monetization (Genesis Onion airdrop banners) and crypto infrastructure (SBT collection links to GetGems) ahead of the primary conversion goal: registering for or purchasing an event ticket. Non-crypto-native Telegram users encounter confusing blockchain terminology and exit before finding the registration form.

---

## 2. Current Implementation Analysis
In [`EventPageSections.tsx`](mini-app/src/app/_components/Event/EventPageSections.tsx#L554-L582):
```tsx
export const EventSections = () => {
  return (
    <div className="flex flex-col gap-3 p-4 mx-auto max-w-xl w-full ...">
      <EventHeader />
      <EventDescription />
      <OnionBanner />          {/* Distraction: Promotional Banner */}
      <EventPassword />
      <ManageEventButton />
      <OrganizerCard />
      <SbtCollectionLink />    {/* Distraction: External GetGems NFT link */}
      <ConnectWalletCard />    {/* Friction: Wallet connection before RSVP */}
      <EventRegistrationStatus />
      <SupportButtons />
      <MainButtonHandler />
    </div>
  );
};
```

### Usability Flaws:
1. **Inverted Hierarchy**: The registration form is buried at items 8–9.
2. **Web3 Tax**: Users are asked to connect a TON wallet (`ConnectWalletCard`) before they even know if their registration will be approved or if the event is free.
3. **Outbound Leakage**: Tapping the SBT link opens external marketplace `getgems.io`, breaking user focus.

---

## 3. Proposed Solution

### A. Inverted Pyramid Information Architecture
Re-order components on the event page to follow standard ticketing conventions:
1. **Event Header**: Image, Title, Date/Time, Location, Price badge (`Free` or `X TON`).
2. **Registration / Ticket CTA**: Sticky or primary action right below header.
3. **About / Event Details**: Speaker lineup, agenda, venue map.
4. **Organizer Profile**: Organizer name, verified badge, support button.
5. **Add-ons / Rewards (Collapsed by default)**: Proof-of-Attendance badge details.

### B. Progressive Web3 Disclosure
* **Free Events**: Allow 1-tap Telegram RSVP without requiring a TON wallet. Auto-populate name and Telegram username from `Telegram.WebApp.initDataUnsafe`.
* **Post-Registration Upsell**: Once registered, present an optional card:
  > *"Want to receive an official Proof-of-Attendance NFT badge at the door? Connect your TON wallet anytime before the event ends."*

### C. Relocate Platform Promotional Banners
* Move the `OnionBanner` to the bottom of the page or into post-confirmation / discovery screens.

---

## 4. Visual Wireframe

```
CURRENT ORDER                         PROPOSED ORDER
┌─────────────────────────┐          ┌─────────────────────────┐
│ Event Header & Image    │          │ Event Header & Image    │
├─────────────────────────┤          ├─────────────────────────┤
│ About Text              │          │ Date, Venue & Price     │
├─────────────────────────┤          ├─────────────────────────┤
│ [Genesis Onion Banner]  │          │ [ REGISTER / BUY CTA ]  │
├─────────────────────────┤          ├─────────────────────────┤
│ SBT NFT (GetGems link)  │          │ About & Agenda Details  │
├─────────────────────────┤          ├─────────────────────────┤
│ Connect TON Wallet Card │          │ Organizer Info          │
├─────────────────────────┤          ├─────────────────────────┤
│ Registration Form       │          │ (Optional) Claim SBT    │
└─────────────────────────┘          └─────────────────────────┘
```

---

## 5. Acceptance Criteria
- [ ] Registration CTA is visible above the fold on mobile viewports (e.g., iPhone 13/14/15 390px width).
- [ ] Attendees can register for free events with 0 crypto wallet prompts.
- [ ] External GetGems link is removed from the primary event path.
- [ ] Registration completion rate increases and bounce rate decreases.
