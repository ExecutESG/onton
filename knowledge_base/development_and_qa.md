# Onton Platform: Development & QA Process

This document outlines the developer onboarding process, local setup, and the Quality Assurance (QA) standards for the `ontonbot` repository.

## 1. Local Development Setup

The platform is managed as a monorepo. To set up a local development environment:

### Prerequisites
- Docker Desktop
- Node.js (v18+)
- `yarn` or `pnpm` (depending on the target sub-package)

### Initial Setup
1.  **Environment Configuration**: Copy `.env.example` to `.env`.
2.  **Orchestration**: Launch the full ecosystem using Docker Compose:
    ```bash
    docker compose --profile full up -d
    ```
3.  **Local DNS**: Configure local mappings to `127.0.0.1` as defined in `hosts.txt` (see `deployment_and_infrastructure.md` for details).

## 2. Quality Assurance (QA) Process

The QA process is integrated into the development workflow through automated testing, linting, and manual verification.

### Automated Testing
- **Framework**: Jest.
- **Location**: Test files are located in `mini-app/__tests__/*.test.ts(x)`.
- **Execution**: Run `npx jest` (or `yarn test` in specific sub-packages).
- **Standards**: External services (Redis, MinIO, Postgres) must be mocked in unit tests to avoid network I/O side effects.

### Code Quality & Standards
- **Linting**: ESLint and Prettier are configured per application.
- **Naming Conventions**:
    - React components: `PascalCase`.
    - Files/Directories: `kebab-case` or `lowercase`.
    - Env keys: `UPPER_SNAKE_CASE`.
- **Validation**: Environment variables should be validated via `devops/CheckoutEnv.sh`.

### Pull Request (PR) Requirements
Before a PR is merged, the following must be verified:
1.  **Build Check**: `docker compose --profile full up -d` must pass locally.
2.  **Lint Check**: All linters and formatters must pass.
3.  **Documentation**: PRs should include purpose, screenshots for UI changes, and specific run instructions.

## 3. Communication Patterns

- **Message Broker**: RabbitMQ is used for heavy background tasks (emails, blockchain indexing, notifications).
- **ORMs**:
    - Drizzle (Core DB / `mini-app`)
    - Prisma (NFT Manager)

## 4. Technical Workflows (Feb 2026)

### Work-in-Progress Synchronization
A specific workflow is used to sync local development with remote updates while preserving uncommitted work:
1.  **Stash**: `git stash` to save local modifications (e.g., UI refinements, experimental logic).
2.  **Pull**: `git pull origin main` to fetch and merge upstream changes (e.g., new documentation, dependency updates).
3.  **Pop**: `git stash pop` to re-apply local changes.
*This was used in February 2026 to integrate new onboarding docs while preserving Society Hub refactoring.*

### Society Hub Optionalization
Architecture update to make the `society_hub` association optional across the event lifecycle:
- **Server Routers**: `mini-app/src/server/routers/events.ts` modified to handle nullable `hub` fields and optional verification checks.
- **Validation Schemas**: Zod schemas in `mini-app/src/zodSchema/` updated to allow `.optional()` or `.nullable()` for hub-related fields.
- **Frontend Components**: Removed mandatory selections (e.g., `TonHubPicker` in `BasicEventInputs.tsx`) to support events without an associated hub.
- **Types**: `EventDataSchema` in `types.ts` updated for optionality.

## 5. Incident History & Recovery

### Major Restoration Event (Oct-Nov 2025)
Research into the repository's artifacts reveals a period of significant instability in late 2025, culminating in a manual rebuild and data restoration.

- **Timeline Evidence**:
    - **October 21, 2025**: GitHub Action logs show several failing `staging` workflows, likely marking the onset of the incident.
    - **November 22, 2025**: Successful commits such as "fix: turn metabase back" suggest services were being restored after a long downtime.
- **Recovery Artifacts**: The `Misc/Scripts` directory contains dozens of utility scripts used for emergency data extraction and restoration:
    - **Database Recovery**: `ssh_pg_restore_v3.py` (multiple attempts), `ssh_download_recovery.py`, `ssh_import_recovery.py`.
    - **Emergency Cleanup**: `ssh_emergency_cleanup.py`, `ssh_find_disk_hog.py`.
    - **Restoration Debugging**: `ssh_debug_restore_failure.py`.
- **Inferred Cause**: Likely a catastrophic server or database failure that required manual extraction from old disk volumes/backups and a stage-by-stage service recovery.

## 6. Proposed Improvements
- **Release & QA Protocol**: Formalize a document defining staging procedures and automated testing gates before production deployment.
- **Backup Automation**: Transition from manual emergency scripts to a robust, planned backup system (see `deployment_and_infrastructure.md`).

## 7. Platform Limitations

### Browser-based Automated Testing
As of February 2, 2026, automated interaction with `web.telegram.org` (used for live Mini-App testing) is restricted by internal safety policies. 
- **Impact**: UAT (User Acceptance Testing) must be performed manually or through non-Telegram-dependent staging URLs.
- **Alternative**: Focus on backend logic verification via Jest and local build checks.
