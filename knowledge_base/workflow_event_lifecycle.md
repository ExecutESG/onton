# Event Lifecycle

## 1. Creation (Organizer)
- **Draft**: Organizer enters details (Title, Desc, Time).
- **Validation**:
    - **Society Hub**: Checks if organizer is eligible to post in a specific Hub.
    - **Assets**: Validates Image/Video dimensions.
- **Publish**: Event becomes visible in the feed.

## 2. Active Phase
- **Sales**: Users buy tickets.
- **Updates**: Organizer can send announcements (via Bot) to attendees.

## 3. Execution (Start of Event)
- **Check-In**: Organizer uses a scanner (in Client Panel or Verification App) to scan Attendee QR codes.
- **Status Update**: Ticket marked as `USED`.

## 4. Post-Event
- **Rewards**: System distributes SBTs/Points to users with `USED` tickets.
- **Analytics**: Final report on attendance vs sales.
