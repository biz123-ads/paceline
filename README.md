# ProjectPulse (provisional name)

Track your SaaS or side project and plan the way to a goal: project details,
monthly numbers (MRR, customers, costs), and what it takes to reach a target
like "€10k MRR by next year" (customers needed, churn, price, runway).

Full MVP scope and decisions: [docs/mvp-spec.md](docs/mvp-spec.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Zod for validation, Dexie (IndexedDB) for local storage, Recharts for charts
- Vitest for tests

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (once) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |

## Layout

```
src/
  app/          Routes (/, /projects/new, /projects/[id], …/plan, …/data,
                …/details, /settings); each page renders a screen component
  components/   UI: screens/, project/, charts/, data/ (storage hooks), ui.tsx
  config/       App name and constants (rename the product in config/app.ts)
  domain/       Zod schemas and types: project, snapshot, goal, assumptions, bundle
  plan/         Plan engine: pure functions, measured values, tests
  lib/          Small helpers (months/periods, ids, formatting, sample project)
  storage/      Storage interfaces + local IndexedDB implementation
docs/           Specs and decisions
```

## Key rules

- **No accounts in v1.** Data lives in the user's browser. All reads and writes
  go through `src/storage` so a server-backed implementation can replace the
  local one when authentication arrives.
- **Money is integer cents**, in the project's currency. Never floats.
- **Months are `YYYY-MM` strings** (`src/lib/period.ts`).
- **Derive, don't store:** the plan and derived metrics are computed from
  snapshots, the goal and the levers, never saved.
- **Plan, not prediction:** real months and plan lines always look different
  (bars vs dashed lines); values that are not measured are labelled.
- IDs are UUIDs generated on the client.
