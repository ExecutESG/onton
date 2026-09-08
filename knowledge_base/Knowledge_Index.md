# ONTON2026 Knowledge Base Index

This index tracks the documentation required to fully understand, maintain, and extend the ONTON platform.

## 01. Architecture & Infrastructure
- [x] **[Core Interactions](./onton_core_interactions.md)**: High-level map of user flows (Onboarding, Payments, etc.).
- [x] **[System Overview](./overview.md)**: High-level architecture, service breakdown, and core patterns.
- [x] **[Deployment Pipeline](./deployment_pipeline.md)**: CI/CD, GitHub Actions, and environment strategy.
- [x] **[Deployment & Infrastructure](./deployment_and_infrastructure.md)**: Live server details, SSL/Caddy config.
- [x] **[Development & QA](./development_and_qa.md)**: Local setup, testing standards, and PR guidelines.
- [x] **[Database Schema & Information Architecture](./database_schema.md)**: Split-DB pattern, Drizzle schemas.
- [x] **[System Audit](./SYSTEM_AUDIT.md)**: Architectural map, tech stack, and module breakdown.
- [x] **[Developer Guide](./DEVELOPER_GUIDE.md)**: Onboarding, code structure, and contribution guidelines.
- [x] **[Project Goals](./PROJECT_GOALS.md)**: Quarterly business roadmap and OKRs.
- [x] **[Prioritized Tasks (Markdown)](./TASKS.md)**: Ranked technical to-do list based on business impact.
- [x] **[Prioritized Tasks (HTML)](./TASKS.html)**: Visual roadmap for stakeholders.

## 02. Backend Services
- [x] **[Mini-App Overview](./mini_app_overview.md)**: Comprehensive guide to the Next.js + tRPC core service.
- [x] **[Payment System](./payment_system_overview.md)**: Detailed breakdown of the ONTON Verify-then-Process payment flow.
- [x] **[Telegram Bot Overview](./telegram_bot_overview.md)**: Guide to the Grammy-based bot service.
- [x] **[Backend Services (Legacy)](./backend_mini_app.md)**: Older reference docs.
- [x] **[NFT Manager Service](./backend_nft_manager.md)**: Blockchain interaction logic.
- [x] **[Background Workers](./backend_workers.md)**: RabbitMQ consumers and job scheduling.

## 03. Frontend Applications
- [x] **[Participant TMA](./frontend_participant_tma.md)**: Next.js/React structure.
- [x] **[Client Web Panel](./frontend_client_panel.md)**: Organizer dashboard.
- [x] **[Website](./frontend_website.md)**: Public landing page.

## 04. Key Workflows & Logic
- [x] **[Authentication](./workflow_auth.md)**: TON Connect & Telegram Auth.
- [x] **[Event Lifecycle](./workflow_event_lifecycle.md)**: Creation to Completion.
- [x] **[Ticketing & Payments (Logic)](./workflow_ticketing.md)**: Business logic for ticketing.
- [x] **[NFT Minting](./workflow_nft_minting.md)**: End-to-end minting flow.

## 05. DevOps & Maintenance
- [x] **[Disaster Recovery](./project_ownership_and_recovery.md)**: Emergency access and backups.
- [x] **[Manual DB Maintenance](./manual_db_maintenance.md)**: SQL operations.
- [x] **[Migration & Syncing](./migration_and_syncing.md)**: Syncing dev/prod environments.
