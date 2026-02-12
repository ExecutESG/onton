# Onton Platform Overview

The Onton platform (specifically the `ontonbot` repository) is a Telegram Mini-App focused on event management and social/on-chain interactions on the TON blockchain.

## Project Structure
- **Mini-App**: Located in `/mini-app`.
- **Frontend/App**: Next.js (React), Telegram Mini Apps (TMA)
- **Backend Services**: Node.js, Postgres (Primary DB), Redis (Cache), RabbitMQ (Queues)
- **Infrastructure**: Docker, Docker Compose, Caddy (Reverse Proxy)

## Architecture Overview
The system follows a microservices-like architecture orchestrated via Docker. It uses a **Split-Database Pattern** hosted on a single Postgres instance:
1. **Core DB (`mini-app`)**: Managed via **Drizzle ORM**.
2. **NFT DB (`nft-manager`)**: Managed via **Prisma ORM**.

For a detailed visual guide, refer to the project's internal `docs/architecture_and_design.md`.

## Documentation Resource Guide

Navigating the Onton platform requires a cross-reference between the repository's internal files and the supplementary knowledge base.

### 🏠 Repository Documentation (`/ontonbot/docs/`)
- `architecture_and_design.md`: Deep dive into domain models (Drizzle/Prisma schemas), Mermaid sequence diagrams for event flows, and service connectivity.
- `technical_onboarding.md`: Step-by-step developer setup guide, including environment configuration and production deployment workflows.

### 🧠 Knowledge Base Artifacts
- `deployment_and_infrastructure.md`: Live production server details (`65.109.212.86`), SSH key management, Caddy/SSL configuration, and backup automation details.
- `manual_db_maintenance.md`: Verified procedures for manual database dumps (2.6GB success metric), container selection, and secure scp downloads.
- `migration_and_syncing.md`: Patterns for Production-to-Dev environment replication and environment synchronization.
- `project_ownership_and_recovery.md`: High-level guide for disaster recovery, secret rotation, and infrastructure re-construction.
- `development_and_qa.md`: Local development standards, Jest testing patterns, and PR guidelines.
- `testing_and_use_cases.md`: Comprehensive list of actor-based use cases (Organizer, Participant) and functional verification checklists.

## Key Service Domains
- **Backend/API**: Integrated using TRPC routers (`src/server/routers`).
- **Validation**: Strict schema validation using Zod.
- **Infrastructure**: Containerized using Docker Compose.

## Core Technical Patterns

### 1. Hub Management (`society_hub`)
The platform allows events to be associated with "hubs".
- **Evolution**: Moving from required `society_hub` fields to optional/nullable fields to handle unverified organizers or hub-less events more gracefully.
- **Verification Logic**: Check if an organizer is "TS verified" before allowing them to post to specific hubs.

### 2. Rate Limiting
The platform implements specific rate limits for user actions (defined in `constants.ts`):
- **Image Uploads**: Standard windowed limits.
- **Video Uploads**: Standard windowed limits.
- **Password Attempts**: For event-specific access.

### 3. Event Management Workflow
- Multi-step event creation (General info, Rewards, etc.).
- Image and video asset management.
- Integration with TON blockchain for social features (references to "hubs" and "on-chain" IDs).

## Development & Maintenance
- **Local Dev & QA**: Guidelines for local setup and testing are in [Development & QA Process](./development_and_qa.md).
- **Deployment**: Live server details and deployment workflows are in [Deployment & Infrastructure](./deployment_and_infrastructure.md).
- **Ownership & Recovery**: Guidelines for taking full control and disaster recovery are in [Project Ownership & Recovery](./project_ownership_and_recovery.md).
- **Maintenance**: General repository maintenance (scripts, backups) is covered in the `antigravity_monorepo` KI.
