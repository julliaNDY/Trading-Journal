# Source Tree

Vue rapide de l'organisation du repo (structure reelle).

## Racine

- `src/` : code applicatif (App Router).
- `prisma/` : schema Prisma + migrations.
- `docs/` : documentation (roadmap, architecture, stories).
- `scripts/` : scripts ops/maintenance.
- `public/` : assets statiques.
- `messages/` : i18n JSON (fr/en).

## `src/` (App Router)

```
src/
  app/
    (auth)/              # login, register, forgot-password
    (dashboard)/         # pages app proteges
    (public)/            # pages publiques
    actions/             # server actions
    api/                 # route handlers (API)
    auth/                # callbacks auth
    layout.tsx           # root layout
    page.tsx             # landing (racine)
    globals.css          # styles globaux
    middleware.ts        # auth + i18n
  components/
    ui/                  # shadcn/ui
    layout/              # sidebar, topbar, footer
    charts/              # charts
    audio/               # voice notes
    coach/               # AI coach UI
  hooks/                 # hooks react
  i18n/                  # config i18n
  lib/                   # utilitaires, prisma, auth, supabase
  services/              # logique metier (import, stats, broker)
  types/                 # types partages
```

## Pages importantes

- `src/app/(dashboard)/dashboard` : KPIs + equity + charts.
- `src/app/(dashboard)/journal` : journal quotidien.
- `src/app/(dashboard)/trades` : liste et detail trades.
- `src/app/(dashboard)/comptes` : comptes + brokers.
- `src/app/(public)` : pages marketing.

## Services cles

- `src/services/import-service.ts` : import CSV.
- `src/services/trade-service.ts` : CRUD trades + serialization.
- `src/services/stats-service.ts` : stats globales.
- `src/services/broker/` : broker sync (Tradovate, IBKR).
- `src/services/transcription-service.ts` : transcription audio.
- `src/services/summary-service.ts` : resume IA.
- `src/services/storage-service.ts` : uploads local.

## Data access

- `src/lib/prisma.ts` : Prisma client singleton.
- `src/lib/supabase/` : clients Supabase server/client.

## Tests

- `src/services/__tests__/` : tests Vitest (services).
- `src/hooks/__tests__/` : tests hooks.
