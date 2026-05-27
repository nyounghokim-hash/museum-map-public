# Museum Map

[한국어](./README.ko.md) | [Main README](./README.md)

Museum Map is a multilingual platform for discovering 3,840+ museums and art galleries worldwide, getting AI-powered recommendations, and planning museum trips.

## Live Demo

Production: https://museummap.app

Core browsing features, including map exploration, search, museum detail pages, MM Story, and artwork pages, can be reviewed without login. User-specific features such as saved museums, collections, reviews, and trip plans require authentication.

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

1. Open https://museummap.app.
2. Search for a city, country, or museum name from the main map.
3. Open a museum detail panel and inspect photos, visitor information, reviews, related stories, and directions.
4. Try AI recommendations with prompts such as "modern art museums in Seoul" or "family-friendly museums in Paris".
5. Visit MM Story and artwork detail pages.
6. Switch languages across Korean, English, Japanese, German, French, Spanish, and other supported locales.

## Test Account

Core exploration flows do not require username/password credentials.

Production authentication uses NextAuth and Google OAuth. A dedicated reviewer account can be provided privately if the hackathon review flow requires logged-in actions.

## Public-Safe Scope

This repository is a sanitized public evaluation copy of the private production repository.

Included:

- Application source code under `src/`
- Public Prisma schema at `prisma/schema.prisma`
- Static assets under `public/`
- Design system, feature, architecture, API, and policy documentation under `docs/`
- A sanitized public development and verification summary at `docs/public-development-log.md`

Excluded:

- `.env`, `.env.local`, `.env.vercel`, and Vercel project metadata
- Supabase, Google, Gemini, Serper, AWS, NextAuth, and admin secrets
- Generated Prisma client output
- Local build artifacts, raw logs, scratch files, and one-off database backfill scripts
- Private deployment-only operational notes

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

Full database-backed local execution requires PostgreSQL/Supabase credentials with PostGIS enabled.

```bash
npx prisma generate
npm run build
```

The production database and private environment variables are not included in this public copy.

## Built With AI

This project was built and iterated with Claude Code and Codex across frontend implementation, data quality tooling, production debugging, and documentation.
