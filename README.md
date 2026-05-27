# Museum Map

AI-powered multilingual museum discovery, map exploration, and trip planning for museums and art galleries around the world.

## Live Demo

Production: https://museummap.app

The public demo can be browsed without a login. Features that save user-specific data, such as saved museums, collections, reviews, and trip plans, require login.

## Current Status

| Metric | Value |
| --- | --- |
| Production URL | https://museummap.app |
| Public Museums & Galleries | 3,840+ |
| Museum Photo Cache Coverage | 100% public museum coverage, with placeholder fallback |
| Artworks | 900+ |
| MM Stories | 120+ |
| Supported Locales | 13: KO, EN, JA, DE, FR, ES, PT, ZH-CN, ZH-TW, DA, FI, SV, ET |
| Current App Version | 1.6.1 |
| Public Repo Type | Sanitized evaluation copy |

## Evaluation Guide

Recommended paths for reviewers:

1. Open https://museummap.app.
2. Search for a city, country, or museum name from the main map.
3. Open a museum detail panel and inspect photos, visitor information, reviews, related stories, and directions.
4. Try the AI recommendation panel with natural-language prompts such as "modern art museums in Seoul" or "family-friendly museums in Paris".
5. Visit MM Story and artwork detail pages.
6. Switch language between Korean, English, Japanese, German, French, and Spanish.

## Test Account

Core browsing, search, map exploration, stories, and artwork pages do not require username/password credentials.

Authentication is configured through NextAuth and Google OAuth in production. A dedicated reviewer account can be provided privately if the hackathon review flow requires logged-in actions.

## Why This Repository Is Public-Safe

This repository is a sanitized public evaluation copy of the private production repository. It includes:

- Application source code under `src/`
- Prisma schema under `prisma/schema.prisma`
- Public static assets under `public/`
- Design, architecture, feature, API, and policy documentation under `docs/`
- A public development log summarizing production fixes and verification work

It intentionally excludes:

- `.env`, `.env.local`, `.env.vercel`, and Vercel project metadata
- Supabase, Google, Gemini, Serper, AWS, NextAuth, and admin secrets
- Generated Prisma client output
- Local build artifacts, logs, scratch files, and one-off database backfill scripts
- Private operational notes that contain deployment-only context

The private production repository remains the source of truth for deployment operations, private environment configuration, raw collection logs, and data-maintenance scripts.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI, shadcn/ui-inspired components |
| Database | PostgreSQL, Supabase, Prisma ORM, PostGIS |
| Map | MapLibre GL |
| AI | Google Gemini API |
| Auth | NextAuth.js v4 |
| Storage | AWS S3 and Supabase Storage patterns |
| Hosting | Vercel |

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

For full database-backed local execution, provide PostgreSQL/Supabase credentials with PostGIS enabled and run:

```bash
npx prisma generate
npm run build
```

The production database and private environment variables are not included in this public copy.

## Project Structure

```text
src/app/        Next.js App Router pages and API routes
src/components/ React components for map, museum detail, layout, and UI
src/hooks/      Translation, comparison, and client-side helpers
src/lib/        Prisma, i18n, AI, storage, image, auth, and utility code
prisma/         Public schema only
public/         Static assets
docs/           Public-safe architecture, design, API, and development docs
```

## Documentation

- `docs/design-system.md` - visual system and UI standards
- `docs/ui-guide.md` - component and interaction guidance
- `docs/features.md` - product feature inventory
- `docs/architecture.md` - technical architecture
- `docs/user-flows.md` - core user flows
- `docs/public-development-log.md` - sanitized development and production verification log
- `docs/openapi.yaml` - API reference
- `docs/museum-photo-policy.md` - public image and attribution policy
- `docs/cost-optimization-policy.md` - AI/API cost controls

## Built With AI

This project was built and iterated with AI coding tools, including Claude Code and Codex, across frontend implementation, data quality tooling, production debugging, and documentation.
