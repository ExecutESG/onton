# Background Workers

Workers handle asynchronous tasks to ensure the main application remains responsive. They are located in `mini-app/src/workers` and executed as cron jobs or queue consumers.

## 1. Worker Types

### Payment & Order Processing
**File**: `cronJobSchedulerPayment.ts`
- **Role**: Periodically checks for `created` orders that have expired or need status updates.
- **Integration**: May cross-reference with `nft-manager` transaction data to mark orders as `PAID`.

### Rewards Distribution
**File**: `cronJobSchedulerReward.ts`
- **Role**: Distributes Tokens or SBTs to users after they attend an event.
- **Trigger**: Post-event completion or successful scanning of a ticket.

### Proof of Attendance (POA)
**File**: `poaWorker.ts`
- **Role**: Manages the specific logic for verifying and minting POA assets.

### General Maintenance
**File**: `cronJobSchedulerOrdinary.ts`
- **Role**: Cleanup tasks, sending reminder emails/notifications.

## 2. Infrastructure
- **Scheduling**: Uses `node-cron` or similar library within the `mini-app` container.
- **Queues**: Likely uses **RabbitMQ** for decoupling heavy jobs (like image processing or mass notifications) from these schedulers.
