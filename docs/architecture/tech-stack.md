# Tech Stack

Ce document resume la stack actuelle du repo et les cibles du projet Trading Path Journal.

## Stack actuelle (repo)

### Runtime et framework

- Node.js 20.x (recommande)
- Next.js 15.5.9 (App Router)
- React 18.3.1
- TypeScript 5.6.3 (strict)

### UI

- TailwindCSS 3.4.15
- shadcn/ui (Radix UI)
- lucide-react (icons)
- recharts 2.13.3
- lightweight-charts 5.1.0
- react-day-picker 8.10.1
- react-dropzone 14.2.9

### Data et services

- Prisma 5.22.0 (`@prisma/client`)
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- OpenAI SDK 6.15.0 (transcription/summaries)
- Papaparse 5.4.1 (import CSV)
- Stripe 20.1.1 (abonnements)
- Google Cloud Vision 5.3.4 (OCR)

### Build, lint, tests

- ESLint (next lint)
- Vitest 4.0.16
- tsx 4.19.2
- @next/bundle-analyzer (ANALYZE=true)

## Cibles et extensions (Trading Path Journal)

Ces elements sont definis dans `docs/architecture-trading-path-journal.md` :

- TimescaleDB (extension Postgres) pour time-series/ticks.
- Redis (Upstash) pour cache/queue (BullMQ).
- Vector DB (Qdrant/Pinecone) pour embeddings.
- Observabilite : Sentry + Vercel Analytics.
- Storage : Supabase Storage ou S3.
- i18n : next-intl (FR/EN).

## Notes

- Le README n'est pas a jour (ancienne stack MySQL/JWT). Se referer aux docs d'architecture/roadmap.
- Les dependances "cibles" doivent etre ajoutees seulement quand necessaires (phase 0/1).
