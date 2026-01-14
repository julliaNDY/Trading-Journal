# Coding Standards

## Objectif

Ces standards alignent le code sur les conventions existantes du repo pour garantir
lisibilite, coherence et maintenabilite.

## Langage et style

- TypeScript strict (voir `tsconfig.json`).
- Pas de `any` (sauf exceptions explicites et documentees).
- Types et interfaces en PascalCase.
- Constantes en UPPER_SNAKE_CASE.
- Fonctions et variables en camelCase.
- Composants React en PascalCase.
- Rester coherent avec le style du fichier existant (guillemets, points-virgules).

## Structure et architecture

- App Router (Next.js) avec `src/app/` comme point d'entree.
- Server Components par defaut. Ajouter `'use client'` uniquement si necessaire.
- Server Actions dans `src/app/actions/` avec `'use server'` en tete de fichier.
- Route handlers dans `src/app/api/`.
- Services metier dans `src/services/`.
- Utils et helpers dans `src/lib/`.

## Imports

- Utiliser l'alias `@/` (defini dans `tsconfig.json`).
- Separer les imports type avec `import type`.
- Eviter les chemins relatifs profonds.

## Validation et securite

- Valider les inputs avec Zod (voir `src/lib/validations.ts`).
- Verifier l'authentification via `getUser()` / `requireAuth()`.
- Ne jamais exposer de secrets cote client.
- Proteger les route handlers et server actions (auth, checks).

## Data access

- Utiliser `prisma` via `src/lib/prisma.ts` (singleton).
- Ne pas instancier Prisma directement.
- Preferer les select explicites pour limiter les colonnes renvoyees.

## Logging

- Utiliser `src/lib/logger.ts` (logger centralise).
- Eviter `console.*` en production (sauf debug ponctuel).

## UI et styles

- TailwindCSS + shadcn/ui.
- Utiliser `cn()` (de `src/lib/utils.ts`) pour composer les classes.
- Respecter les tokens CSS (colors, radii, etc.).

## Tests

- Tests unitaires avec Vitest.
- Nommer les fichiers `*.test.ts` / `*.test.tsx`.
- Cibler en priorite `src/services/` et `src/lib/`.

## Documentation

- Ajouter des commentaires courts quand la logique n'est pas evidente.
- Mettre a jour les docs d'architecture quand une decision technique majeure change.
