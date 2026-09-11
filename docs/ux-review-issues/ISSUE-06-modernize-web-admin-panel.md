# [UX/Web] Modernize Event Admin Dashboard with Analytics & Safe Printing

**Labels:** `Design`, `enhancement`  
**Components:** `client-web-panel/pages/dashboard/index.js`, `client-web-panel/components/MyCompo/Guests/GuestList.js`, `client-web-panel/pages/index.js`  
**Milestone:** Web Operations v2  
**Target:** Desktop Client Web Panel

---

## 1. Problem Statement
The Web Management Panel (`client-web-panel`) provides minimal operational feedback for desktop organizers. The dashboard is an uncurated grid with no aggregate metrics or event status filters. Check-in operations rely on unstyled `window.open` popups and native `window.confirm` alerts that modern desktop browsers routinely suppress. In addition, sensitive environment data is being logged to the client console.

---

## 2. Current Implementation Analysis
1. **Raw UI & No Metrics** in [`dashboard/index.js`](file:///Users/mahdifarimani/Documents/AntiGravity/ONTON2026/ontonbot/client-web-panel/pages/dashboard/index.js#L12-L28):
   * Shows plain `<p>Loading...</p>` and `<p>Error loading events</p>`.
   * Unfiltered grid of cards with no sorting by date, status (Draft / Live / Completed), or ticket counts.
2. **Blocking Native Dialogs & Popup Blockers** in [`GuestList.js`](file:///Users/mahdifarimani/Documents/AntiGravity/ONTON2026/ontonbot/client-web-panel/components/MyCompo/Guests/GuestList.js#L122-L173):
   * `window.confirm(t("common.ticket_already_used") + " \n " + t("common.want_to_print_again"))` pauses JavaScript execution.
   * `window.open('', '', 'height=600,width=800')` creates an unstyled HTML print popup that is frequently blocked by Chrome/Safari/Brave popup blockers.
3. **Information Leak** in [`client-web-panel/pages/index.js`](file:///Users/mahdifarimani/Documents/AntiGravity/ONTON2026/ontonbot/client-web-panel/pages/index.js#L7-L8):
   * `console.log(process.env.NEXT_PUBLIC_BACKEND_URL_CLIENT); console.log(process.env)` dumps runtime environment variables to the browser console.

---

## 3. Proposed Solution

### A. Dashboard Overview Metrics
* Add a top metrics strip on `/dashboard`:
  * **Active Events** | **Total Registrations** | **Check-in Attendance Rate** | **Total Revenue**
* Add tabbed segmentation: `Upcoming & Live` | `Past Events` | `Drafts`.

### B. Professional In-App Check-In & Badge Printing
* Replace `window.confirm()` with a Material-UI `<Dialog>` component for re-printing used tickets.
* Replace `window.open` ticket printing with a hidden `<iframe>` or `@media print` CSS stylesheet:
  * Triggers print dialog smoothly without opening blank windows or getting blocked by popup blockers.
  * Formats badges cleanly with standard thermal badge dimensions (e.g. 4x3 in / 100x75 mm).

### C. Security & Cleanliness Clean-up
* Remove `console.log(process.env)` from `pages/index.js`.
* Truncate raw wallet addresses with a one-click copy button rather than full-length links.

---

## 4. Acceptance Criteria
- [ ] Dashboard displays high-level event and attendee analytics.
- [ ] Events are grouped into Live, Upcoming, and Past tabs.
- [ ] Ticket check-in and re-print dialogs use non-blocking MUI modal dialogs.
- [ ] Print layout prints directly without spawning popup windows.
- [ ] Zero environment logs in client browser console.
