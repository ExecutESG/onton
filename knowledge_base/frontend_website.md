# Website (onton.live)

> Last verified against dev: 2026-10-03

`website/` is the public Next.js site (package `onton-landing-page`). It runs in local compose (profile `full`) and in both server compose files. On staging, Caddy serves it at `dev.onton.live`.

## 1. Routes (`website/src/app/`)

| Route | Purpose |
|---|---|
| `blog` | Markdown blog |
| `events` | Event directory |
| `csbt` | cSBT explainer |
| `resources` | Resources |
| `privacy`, `tos` | Legal pages |
| `api/content` | Content API |
| `feed.xml` | RSS feed |
| `sitemap`, `robots` | SEO |

## 2. Content (`website/src/content/`)

Markdown files for:
- blog posts
- events (e.g. `bitcoin-conference-2026.md`)
- glossary

The CMS, event directory and blog were added in commit 8b69d4d8.

## 3. Run locally

- `cd website && yarn dev` (port `PORT_WEB_SITE`).
- Lint: `yarn lint`.
