# Telegram Bot Service

The **Telegram Bot** (`ontonbot/telegram-bot`) manages the direct interaction with users via Telegram chat.

## 1. Core Functions
- **Notifications**: Sending tickets, reminders, and reward alerts to users.
- **Commands**: Handling `/start`, `/help`, and event-specific deep links.
- **Support**: forwarding user queries or providing automated FAQs.

## 2. Architecture
- **Framework**: Likely **grammY** or **Telegraf** (Node.js).
- **Structure**:
    - `composers/`: Reusable command/handler modules (e.g., `start.composer.ts`).
    - `handlers/`: logic for specific callback queries or text inputs.
    - `cronJobs/`: Local scheduled tasks (e.g., cleanup).

## 3. Integration
- Communicates with **Mini-App** via Database or API to fetch user/event context.
- Uses **RabbitMQ** (via `workers` in other services) to receive "Send Message" jobs.
