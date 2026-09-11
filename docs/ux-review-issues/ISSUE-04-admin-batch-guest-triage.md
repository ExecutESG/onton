# [UX/Admin] Batch Triage & Fast-Action Filters in TMA Guest Management

**Labels:** `Design`, `enhancement`  
**Components:** `mini-app/src/app/_components/Event/RegistrationGuestList.tsx`  
**Milestone:** Event Operations v2  
**Target:** Mobile Telegram Mini App (TMA)

---

## 1. Problem Statement
Organizers managing events with 100+ registrants must manually approve or reject applicants one-by-one. The TMA guest list lacks batch selection, multi-action controls, and live count badges. Approving 50 guests requires 50 individual button taps and 50 sequential network requests.

---

## 2. Current Implementation Analysis
In [`RegistrationGuestList.tsx`](file:///Users/mahdifarimani/Documents/AntiGravity/ONTON2026/ontonbot/mini-app/src/app/_components/Event/RegistrationGuestList.tsx#L105-L122):
```tsx
footerContent = hasPayment ? null : (
  <div className="flex space-x-2">
    <Button
      variant="danger"
      icon={<X size={18} />}
      label="Reject"
      onClick={handleRejectClick}
      isLoading={isDeclining}
    />
    <Button
      variant="success"
      icon={<Check size={19} />}
      label="Approve"
      onClick={handleApproveClick}
      isLoading={isApproving}
    />
  </div>
);
```

### Usability Flaws:
1. **Single-Item Mutations**: Each tap triggers an isolated `processRegistrantRequest` mutation followed by a list refetch.
2. **Fatigue & Mis-clicks**: Small neighboring "X" and "Checkmark" buttons on mobile screens invite accidental rejections.
3. **No Batch Selection**: No way to "Approve All Verified" or select 20 applicants at once.
4. **No Segmented Count Badges**: Organizers cannot see at a glance how many attendees are in `Pending`, `Approved`, or `Checked In`.

---

## 3. Proposed Solution

### A. Segmented Status Header with Live Counters
Replace the nested filter sheet with an accessible top segmented control:
```
[ All (150) ]  [ Pending (45) ]  [ Approved (95) ]  [ Checked In (10) ]
```

### B. Batch Action Mode for Pending Registrants
When the organizer is on the **Pending** tab:
1. Provide a **"Select Mode"** or multi-select checkbox beside each registrant item.
2. Provide a floating bottom action dock:
   * **[ Select All (45) ]**
   * **[ Approve Selected (N) ]** (Primary Green Button)
   * **[ Reject Selected (N) ]** (Destructive Button with optional reason prompt)

### C. Backend Batch Mutation
* Add a batch TRPC endpoint `trpc.registrant.batchProcessRegistrantRequests` accepting `{ event_uuid, user_ids: number[], status: "approved" | "rejected" }`.
* Execute updates in a single database transaction with optimistic UI response.

---

## 4. Acceptance Criteria
- [ ] Organizer can switch between status tabs with a single tap, seeing live counts in each badge.
- [ ] Organizer can select multiple registrants and approve them with one confirmation tap.
- [ ] Optimistic UI instantly moves selected registrants to "Approved" while background request processes.
- [ ] Reduces admin time required to triage 50 applicants from >3 minutes to <15 seconds.
