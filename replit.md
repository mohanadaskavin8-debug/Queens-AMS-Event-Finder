# Queen's University Campus Map

An interactive 3D campus map for discovering Queen's University events geographically. Buildings are color-highlighted by event status (happening now / today / this week), and clicking a building reveals its events with full details. Includes filtering, search, and add/edit/delete event management. This is a pilot.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (binds to the `PORT` env var; proxied at `/api`)
- `pnpm --filter @workspace/campus-map run dev` — run the web app (binds to `PORT`; served at `/`)
- `pnpm --filter @workspace/campus-map run typecheck` — typecheck the web artifact (use this, not `build`, from the shell)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only; see Gotchas — fails in non-TTY)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Web: React + Vite, TanStack Query, Tailwind + shadcn/ui
- Map: MapLibre GL JS (3D fill-extrusion); footprints from OpenStreetMap

## Where things live

- DB schema (source of truth): `lib/db/src/schema/buildings.ts`, `lib/db/src/schema/events.ts`
- API contract (source of truth): `lib/api-spec` (OpenAPI) → generated hooks/schemas in `lib/api-client-react/src/generated`
- API routes: `artifacts/api-server/src/routes/{buildings,events,health}.ts`
- Web app: `artifacts/campus-map/src`
  - `pages/map-view.tsx` — top-level orchestrator (state, data fetching, layout)
  - `components/campus-map.tsx` — MapLibre 3D map (extrusions, event highlight layer, markers, fly-to, day/night)
  - `components/{filter-bar,search-bar,upcoming-events-sidebar,event-panel,manage-event-dialog,event-form}.tsx`
  - `index.css` — theme tokens + glass/marker/animation styles
- Building footprints: `artifacts/campus-map/public/queens-buildings.geojson` (served statically, loaded by the map)

## Architecture decisions

- **Building footprints come from OpenStreetMap, not Qmulus.** The requested Qmulus API was unusable (token-gated behind @queensu.ca SSO, DNS resolution failed), so real OSM footprints are used for the campus buildings. 11 buildings have real footprints; a few are marker-only.
- **MapLibre GL (not Leaflet)** for true 3D fill-extrusion buildings and a premium look. WebGL is required — see Gotchas.
- **Event status is computed and drives color**: active now = green (#16a34a), today = gold (#F9A01B), this week = blue (#3b82f6), none = slate (#64748b). Queen's brand: blue #002452, gold #F9A01B.
- **Contract-first**: API shape is defined in OpenAPI; the server validates with generated Zod schemas and the client uses generated TanStack Query hooks. Regenerate with the codegen command after spec changes.
- The map degrades gracefully: if WebGL is unavailable, `campus-map.tsx` catches the init error and shows a "Map unavailable" fallback while the rest of the UI (search, filters, event lists) keeps working.

## Product

- Full-bleed 3D campus map with floating glass UI panels.
- Buildings highlighted by event status; click a building to see its events (name, organizer, date/times, description, registration link, room/location).
- Upcoming-events sidebar, status legend, day/night toggle, recenter control.
- Filtering by category (All / AMS / Club / Academic / Athletics) and time (Now / Today / Week).
- Search across events, organizers, and buildings.
- Add / edit / delete events.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **`pnpm --filter @workspace/db run push` prompts interactively and fails in a non-TTY shell.** When the schema requires a destructive change, drop the affected tables manually via `psql "$DATABASE_URL" -c 'DROP TABLE ... CASCADE'` and then run push, or seed via a generated SQL file piped to `psql`.
- **The map needs WebGL.** The agent screenshot tool runs headless Chrome with no GPU, so the map will show the "Map unavailable" fallback in screenshots even though it renders fine in a real browser. Do not treat that fallback in a screenshot as a bug.
- Verify the web artifact with `typecheck`, not `build` (build needs workflow-provided `PORT`/`BASE_PATH`).
- Access services via the shared proxy at `localhost:80` (e.g. `localhost:80/api/buildings`), never the internal service port.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
