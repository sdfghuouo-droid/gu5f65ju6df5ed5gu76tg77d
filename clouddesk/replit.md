# CloudDesk — Remote Device Management

A professional ops dashboard for managing Windows/Linux machines remotely. Lets admins view all fleet machines at a glance, send PowerShell/shell commands, browse remote filesystems, and monitor CPU/RAM/Disk in real time.

## Run & Operate

- `pnpm --filter @workspace/clouddesk run dev` — run the frontend (port assigned by artifact)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui (dark ops theme)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/clients.ts` — clients table (machines)
- `lib/db/src/schema/commands.ts` — commands table (shell history)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/clouddesk/src/` — React frontend (pages + components)

## Architecture decisions

- **Heartbeat polling model**: Agents (Windows scripts) register once, then poll `/api/agents/heartbeat` every few seconds sending live metrics and receiving pending commands to execute. Results are posted back via `/api/agents/command-result`.
- **Token auth for agents**: Each registered client gets a UUID token stored in the DB; agents must send it with every heartbeat/result call.
- **agentToken never exposed**: The `agentToken` field is stripped from all client responses to the frontend.
- **Offline/maintenance fast-fail**: Commands sent to offline/maintenance machines are immediately marked `failed` rather than queued indefinitely.
- **File listing**: First build returns static mock filesystem structure; real browsing happens via shell commands in the Console tab.

## Product

- Dashboard: fleet stats (total/online/offline/alerting/maintenance), system health indicators
- Clients list: searchable/filterable table with CPU/RAM/Disk bars, status dots, last seen, Export CSV, List/Grid toggle
- Client detail: Overview (metrics), Console (PowerShell terminal), Files (filesystem browser)
- Settings: placeholder

## Agent Installation (Windows)

Agents register by POSTing to `/api/clients/register` with `{ hostname, username, os, agentVersion, ipAddress }`. They receive a `{ clientId, token }` and must store both locally. Then poll `/api/agents/heartbeat` every 10s with live metrics and execute any returned pending commands.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, re-run codegen before anything else.
- Orval TS2308 collision: operations with BOTH path params AND query params get `<OpPascal>Params` generated in both `api.ts` and `types/` — remove query params from nested routes to avoid this.
- `Cross2Icon` does not exist in lucide-react v5+; use `X` instead.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
