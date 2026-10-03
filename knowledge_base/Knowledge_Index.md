# ONTON Knowledge Base Index

Last verified against dev: 2026-10-03

Docs for understanding, running and extending ONTON 2.0 (branch `dev`, repo `ExecutESG/onton`). The agent context file is [`AGENTS.md`](../AGENTS.md).

## 01. Architecture & Infrastructure
| Doc | Scope |
|---|---|
| [AS-IS Technical Blueprint](./as_is_technical_blueprint.md) | Current architecture and topology |
| [TO-BE Technical Blueprint](./to_be_technical_blueprint.md) | Target architecture (plan, mostly not implemented) |
| [Architecture Blueprint & Evaluation](./architecture_blueprint.md) | Architecture audit and evaluation |
| [Core Interactions](./onton_core_interactions.md) | Map of main user flows |
| [System Overview](./overview.md) | Services and core patterns |
| [Database Schema](./database_schema.md) | Drizzle schemas and key tables |
| [System Audit](./SYSTEM_AUDIT.md) | Tech stack and module breakdown |
| [Developer Guide](./DEVELOPER_GUIDE.md) | Local setup and code structure |
| [Project Goals](./PROJECT_GOALS.md) | Business goals |
| [Prioritized Tasks](./TASKS.md) | Ranked technical to-do list |

## 02. Backend Services & Workers
| Doc | Scope |
|---|---|
| [Mini-App Overview](./mini_app_overview.md) | Next.js App Router + tRPC core service |
| [Backend Services (Legacy)](./backend_mini_app.md) | Older mini-app backend notes |
| [Payment System & Multi-Tier Ticketing](./payment_system_overview.md) | TON, USDT jetton and Telegram Stars payments; ticket tiers |
| [Background Workers](./backend_workers.md) | Cron schedulers, POA worker, socket, RabbitMQ queues |
| [Telegram Bot Overview](./telegram_bot_overview.md) | grammY bot, HTTP API, moderation composer |
| [Telegram Bot (Backend)](./backend_telegram_bot.md) | Bot service internals |
| [Bot Commands](./backend_bot_commands.md) | Command reference |
| [NFT Manager Service](./backend_nft_manager.md) | `newton/apps/nft-manager` (not deployed) |
| [Affiliate System](./affiliate_system.md) | Affiliate links and purchase counting |

## 03. Frontend Applications
| Doc | Scope |
|---|---|
| [Mini-App](./mini_app_overview.md) | Organizer and attendee experience, including `/ptma` rewrites |
| [Participant TMA](./frontend_participant_tma.md) | **Decommissioned**: source removed, 4 `/ptma` rewrites in `mini-app/next.config.js` |
| [Client Web Panel](./frontend_client_panel.md) | Legacy organizer panel (local compose only) |
| [Website](./frontend_website.md) | Public site, blog and event directory |

## 04. Key Workflows & Credentials
| Doc | Scope |
|---|---|
| [Authentication & Identity](./workflow_auth.md) | Auth chain, `user_identities`, TonProof, JWTs |
| [User Onboarding](./user_onboarding.md) | First-time user flow |
| [Event Creation](./event_creation.md) | `addEvent` / `updateEvent` rules |
| [Event Lifecycle](./workflow_event_lifecycle.md) | Creation to completion |
| [Check-in, PoA & Credentials](./checkin_and_poa.md) | Rotating pass tokens, PoA, SBT and cSBT proofs |
| [Ticketing & Payments (Logic)](./workflow_ticketing.md) | Order flow |
| [Reward Distribution](./reward_distribution.md) | SBT rewards and NFT tickets |
| [NFT Minting](./workflow_nft_minting.md) | Collection deploy and mint flow |

## 05. DevOps & Maintenance
| Doc | Scope |
|---|---|
| [Deployment Pipeline](./deployment_pipeline.md) | GitHub Actions CI/CD |
| [Deployment & Infrastructure](./deployment_and_infrastructure.md) | Hosts, compose files, Caddy |
| [Development & QA](./development_and_qa.md) | Local setup and testing |
| [Disaster Recovery](./project_ownership_and_recovery.md) | Emergency access and backups |
| [Manual DB Maintenance](./manual_db_maintenance.md) | Manual SQL and backup operations |
| [Migration & Syncing](./migration_and_syncing.md) | Syncing environments and applying SQL |
| [Secrets Management](./deployment/secrets_management.md) | Secret handling |
| [Smoke Test Guide](./deployment/smoke_test_guide.md) | Smoke tests |
| [Production Deployment Guide](../docs/PRODUCTION_DEPLOYMENT_GUIDE.md) | Deploy procedure |
| [Technical Onboarding](../docs/technical_onboarding.md) | New developer onboarding |
| [QA Persona Test Instructions](../docs/QA_PERSONA_TEST_INSTRUCTIONS.md) | QA testing manual |
| [E2E Tests](../tests/e2e/README.md) | Playwright suites |

## Visual (HTML) versions
[DEVELOPER_GUIDE](./DEVELOPER_GUIDE.html), [TASKS](./TASKS.html), [affiliate_system](./affiliate_system.html), [checkin_and_poa](./checkin_and_poa.html), [deployment_pipeline](./deployment_pipeline.html), [event_creation](./event_creation.html), [mini_app_overview](./mini_app_overview.html), [onton_core_interactions](./onton_core_interactions.html), [payment_system_overview](./payment_system_overview.html), [reward_distribution](./reward_distribution.html), [telegram_bot_overview](./telegram_bot_overview.html), [user_onboarding](./user_onboarding.html). The `.md` file is the source of truth if they differ.
